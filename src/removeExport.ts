import ts from 'typescript';
import { FileService } from './FileService.js';
import { applyTextChanges } from './applyCodeFix.js';

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
  | ts.ExportSpecifier;

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
    ts.isTypeAliasDeclaration(node)
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
    ts.isExportSpecifier(node)
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

const getExportNodes = (
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
  for (const node of getExportNodes(languageService, sourceFile)) {
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

    const exportKeyword = findFirstNodeOfKind(
      node,
      ts.SyntaxKind.ExportKeyword,
    );

    if (!exportKeyword) {
      throw new Error('export keyword not found');
    }

    const start = exportKeyword.getStart();
    const end = exportKeyword.getEnd();

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

export const removeExport = ({
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
      throw new Error('source file not found');
    }

    const changes = getTextChanges(languageService, sourceFile);
    const oldContent = fileService.get(file);
    const newContent = applyTextChanges(oldContent, changes);

    fileService.set(file, newContent);
  }
};
