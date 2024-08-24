import ts from 'typescript';
import { FileService } from './FileService.js';
import { applyTextChanges } from './util/applyTextChanges.js';

const findFirstNodeOfKind = (root: ts.Node, kind: ts.SyntaxKind) => {
  let result: ts.Node | undefined;
  const visitor = (node: ts.Node) => {
    if (result) {
      return;
    }

    if (node.kind === kind) {
      result = node;
      return;
    }
    ts.forEachChild(node, visitor);
  };

  ts.forEachChild(root, visitor);

  return result;
};

const IGNORE_COMMENT = 'ts-remove-unused-skip';

const getLeadingComment = (node: ts.Node) => {
  const sourceFile = node.getSourceFile();
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

  if (!ranges) {
    return '';
  }

  return ranges.map((range) => fullText.slice(range.pos, range.end)).join('');
};

type SupportedNode =
  | ts.VariableStatement
  | ts.FunctionDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.ExportAssignment
  | ts.ExportSpecifier
  | ts.ClassDeclaration;

const isTargetWithIgnore = (node: ts.Node): node is SupportedNode => {
  if (
    ts.isExportAssignment(node) ||
    ts.isExportSpecifier(node) ||
    ts.isVariableStatement(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node)
  ) {
    if (getLeadingComment(node).includes(IGNORE_COMMENT)) {
      return true;
    }
  }
  return false;
};

const isTarget = (node: ts.Node): node is SupportedNode => {
  if (ts.isExportAssignment(node) || ts.isExportSpecifier(node)) {
    if (getLeadingComment(node).includes(IGNORE_COMMENT)) {
      return false;
    }

    return true;
  }

  if (
    ts.isVariableStatement(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node)
  ) {
    const hasExportKeyword = !!findFirstNodeOfKind(
      node,
      ts.SyntaxKind.ExportKeyword,
    );

    if (!hasExportKeyword) {
      return false;
    }

    if (getLeadingComment(node).includes(IGNORE_COMMENT)) {
      return false;
    }

    return true;
  }

  return false;
};

const findReferences = (node: SupportedNode, service: ts.LanguageService) => {
  if (ts.isVariableStatement(node)) {
    const variableDeclaration = findFirstNodeOfKind(
      node,
      ts.SyntaxKind.VariableDeclaration,
    );

    if (!variableDeclaration) {
      return undefined;
    }

    const references = service.findReferences(
      node.getSourceFile().fileName,
      variableDeclaration.getStart(),
    );

    return references;
  }

  if (
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isExportSpecifier(node) ||
    ts.isClassDeclaration(node)
  ) {
    return service.findReferences(
      node.getSourceFile().fileName,
      node.getStart(),
    );
  }

  if (ts.isExportAssignment(node)) {
    const defaultKeyword = node
      .getChildren()
      .find((n) => n.kind === ts.SyntaxKind.DefaultKeyword);

    if (!defaultKeyword) {
      return undefined;
    }

    return service.findReferences(
      node.getSourceFile().fileName,
      defaultKeyword.getStart(),
    );
  }

  throw new Error(`unexpected node type: ${node satisfies never}`);
};

const isUsedFile = (
  languageService: ts.LanguageService,
  sourceFile: ts.SourceFile,
) => {
  let isUsed = false;

  const visit = (node: ts.Node) => {
    if (isUsed) {
      return;
    }

    if (isTargetWithIgnore(node)) {
      isUsed = true;
      return;
    } else if (isTarget(node)) {
      const references = findReferences(node, languageService);

      if (!references) {
        return;
      }

      const count = references.flatMap((v) => v.references).length;

      if (ts.isExportSpecifier(node) && count > 2) {
        // for export specifiers, there will be at least two reference, the declaration itself and the export specifier
        isUsed = true;
      } else if (count > 1) {
        // there will be at least one reference, the declaration itself
        isUsed = true;
      }

      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return isUsed;
};

const getUnusedExports = (
  languageService: ts.LanguageService,
  sourceFile: ts.SourceFile,
) => {
  const result: SupportedNode[] = [];

  const visit = (node: ts.Node) => {
    if (isTarget(node)) {
      const references = findReferences(node, languageService);

      if (!references) {
        return;
      }

      const count = references.flatMap((v) => v.references).length;

      if (ts.isExportSpecifier(node) && count === 2) {
        // for export specifiers, there will be at least two reference, the declaration itself and the export specifier
        result.push(node);
      } else if (count === 1) {
        // there will be at least one reference, the declaration itself
        result.push(node);
      }

      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return result;
};

const getTextChanges = (
  languageService: ts.LanguageService,
  sourceFile: ts.SourceFile,
) => {
  const changes: ts.TextChange[] = [];
  for (const node of getUnusedExports(languageService, sourceFile)) {
    if (ts.isExportAssignment(node) || ts.isExportSpecifier(node)) {
      const start = node.getStart();
      const end = node.getEnd();

      changes.push({
        newText: '',
        span: {
          start,
          length: end - start,
        },
      });
      continue;
    }

    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      const identifier = node
        .getChildren()
        .find((n) => n.kind === ts.SyntaxKind.Identifier);

      // when the identifier is not found, it's likely a default export of an unnamed function/class declaration.
      // in this case, we want to remove the whole declaration
      if (!identifier) {
        changes.push({
          newText: '',
          span: {
            start: node.getFullStart(),
            length: node.getFullWidth(),
          },
        });

        continue;
      }
    }

    // we want to correctly remove 'default' when its a default export so we get the syntaxList node instead of the exportKeyword node
    // note: the first syntaxList node should contain the export keyword
    const syntaxList = node
      .getChildren()
      .find((n) => n.kind === ts.SyntaxKind.SyntaxList);

    if (!syntaxList) {
      throw new Error('syntax list not found');
    }

    const start = syntaxList.getStart();
    const end = syntaxList.getEnd();

    changes.push({
      newText: '',
      span: {
        start,
        length: end - start,
      },
    });
  }

  return changes;
};

export const removeUnusedExport = ({
  fileService,
  targetFile,
  languageService,
}: {
  fileService: FileService;
  targetFile: string | string[];
  languageService: ts.LanguageService;
}) => {
  const program = languageService.getProgram();

  if (!program) {
    throw new Error('program not found');
  }

  for (const file of Array.isArray(targetFile) ? targetFile : [targetFile]) {
    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      continue;
    }

    const changes = getTextChanges(languageService, sourceFile);

    if (changes.length === 0) {
      continue;
    }

    const oldContent = fileService.get(file);
    const newContent = applyTextChanges(oldContent, changes);

    fileService.set(file, newContent);
  }
};

export const removeUnusedFile = ({
  fileService,
  targetFile,
  languageService,
}: {
  fileService: FileService;
  targetFile: string | string[];
  languageService: ts.LanguageService;
}) => {
  const program = languageService.getProgram();

  if (!program) {
    throw new Error('program not found');
  }

  for (const file of Array.isArray(targetFile) ? targetFile : [targetFile]) {
    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      continue;
    }

    const isUsed = isUsedFile(languageService, sourceFile);

    if (!isUsed) {
      fileService.delete(file);
    }
  }
};
