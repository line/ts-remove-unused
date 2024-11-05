import ts from 'typescript';
import { FileService } from './FileService.js';
import { applyTextChanges } from './applyTextChanges.js';
import {
  applyCodeFix,
  fixIdDelete,
  fixIdDeleteImports,
} from './applyCodeFix.js';
import { EditTracker } from './EditTracker.js';
import { getFileFromModuleSpecifierText } from './getFileFromModuleSpecifierText.js';
import { DependencyGraph } from './DependencyGraph.js';
import { collectImports } from './collectImports.js';
import { MemoryFileService } from './MemoryFileService.js';
import { TaskManager } from './TaskManager.js';
import { WorkerPool } from './WorkerPool.js';
import { collectUsage } from './collectUsage.js';

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

const getLeadingComment = (node: ts.Node, sourceFile: ts.SourceFile) => {
  const fullText = sourceFile.getFullText(sourceFile);
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

const isTarget = (node: ts.Node): node is SupportedNode => {
  if (ts.isExportAssignment(node) || ts.isExportSpecifier(node)) {
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

    return true;
  }

  return false;
};

const getSpecifier = (node: SupportedNode, sourceFile: ts.SourceFile) => {
  switch (node.kind) {
    case ts.SyntaxKind.VariableStatement: {
      const declaration = node.declarationList.declarations[0];

      if (!declaration) {
        return null;
      }

      return declaration.name.getText(sourceFile);
    }
    case ts.SyntaxKind.FunctionDeclaration: {
      return '';
    }
    case ts.SyntaxKind.InterfaceDeclaration: {
      return '';
    }
    case ts.SyntaxKind.TypeAliasDeclaration: {
      return '';
    }
    case ts.SyntaxKind.ExportAssignment: {
      return '';
    }
    case ts.SyntaxKind.ExportSpecifier: {
      return '';
    }
    case ts.SyntaxKind.ClassDeclaration: {
      return '';
    }
    default: {
      throw new Error(`unexpected node: ${node satisfies never}`);
    }
  }
};

const getUnusedExports = (
  usage: Set<string>,
  fileName: string,
  fileService: FileService,
) => {
  const nodes: SupportedNode[] = [];
  let isUsed = false;

  const sourceFile = ts.createSourceFile(
    fileName,
    fileService.get(fileName),
    ts.ScriptTarget.Latest,
  );

  if (usage.has('*')) {
    isUsed = true;
    return { nodes, isUsed, sourceFile };
  }

  const visit = (node: ts.Node) => {
    if (ts.isExportDeclaration(node) && !node.exportClause) {
      // special case for `export * from './foo';`
      isUsed = true;
      return;
    }

    if (isTarget(node)) {
      if (getLeadingComment(node, sourceFile).includes(IGNORE_COMMENT)) {
        isUsed = true;
        return;
      }

      const text = getSpecifier(node, sourceFile);

      if (!text || usage.has(text)) {
        isUsed = true;
        return;
      } else {
        nodes.push(node);
      }
      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return { nodes, isUsed, sourceFile };
};

const getUpdatedExportDeclaration = (
  exportDeclaration: ts.ExportDeclaration,
  removeTarget: ts.ExportSpecifier,
  sourceFile: ts.SourceFile,
) => {
  const tmpFile = ts.createSourceFile(
    'tmp.ts',
    exportDeclaration.getText(sourceFile),
    sourceFile.languageVersion,
  );

  const transformer: ts.TransformerFactory<ts.SourceFile> =
    (context: ts.TransformationContext) => (rootNode: ts.SourceFile) => {
      const visitor = (node: ts.Node): ts.Node | undefined => {
        if (
          ts.isExportSpecifier(node) &&
          node.getText(tmpFile) === removeTarget.getText(sourceFile)
        ) {
          return undefined;
        }
        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitEachChild(rootNode, visitor, context);
    };

  const result = ts.transform(tmpFile, [transformer]).transformed[0];

  const printer = ts.createPrinter();

  return result ? printer.printFile(result).trim() : '';
};

const stripExportKeyword = (syntaxList: ts.Node, sourceFile: ts.SourceFile) => {
  const file = ts.createSourceFile(
    'tmp.ts',
    `${syntaxList.getText(sourceFile)} function f() {}`,
    sourceFile.languageVersion,
  );

  const transformer: ts.TransformerFactory<ts.SourceFile> =
    (context: ts.TransformationContext) => (rootNode: ts.SourceFile) => {
      const visitor = (node: ts.Node): ts.Node | undefined => {
        if (ts.isFunctionDeclaration(node)) {
          return ts.factory.createFunctionDeclaration(
            node.modifiers?.filter(
              (v) =>
                v.kind !== ts.SyntaxKind.ExportKeyword &&
                v.kind !== ts.SyntaxKind.DefaultKeyword,
            ),
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            node.type,
            node.body,
          );
        }
        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitEachChild(rootNode, visitor, context);
    };

  const result = ts.transform(file, [transformer]).transformed[0];
  const printer = ts.createPrinter();
  const code = result ? printer.printFile(result).trim() : '';
  const pos = code.indexOf('function');
  return code.slice(0, pos);
};

type RemovedExport = {
  fileName: string;
  position: number;
  code: string;
};

const getTextChanges = (
  usage: Set<string>,
  fileName: string,
  fileService: FileService,
) => {
  const removedExports: RemovedExport[] = [];
  const changes: ts.TextChange[] = [];
  // usually we want to remove all unused exports in one pass, but there are some cases where we need to do multiple passes
  // for example, when we have multiple export specifiers in one export declaration, we want to remove them one by one because the text change range will conflict
  let aborted = false;

  const { nodes, isUsed, sourceFile } = getUnusedExports(
    usage,
    fileName,
    fileService,
  );
  for (const node of nodes) {
    if (aborted === true) {
      break;
    }

    // sometimes the parent is undefined contrary to the type definition
    // todo: investigate why this happens
    if (ts.isExportSpecifier(node) && node.parent) {
      const specifierCount = Array.from(node.parent.elements || []).length;

      if (specifierCount === 1) {
        // special case: if the export specifier is the only specifier in the export declaration, we want to remove the whole export declaration
        changes.push({
          newText: '',
          span: {
            start: node.parent.parent.getFullStart(),
            length: node.parent.parent.getFullWidth(),
          },
        });
        removedExports.push({
          fileName,
          position: node.parent.parent.getStart(sourceFile),
          code: node.parent.parent.getText(sourceFile),
        });

        continue;
      }

      aborted = true;
      changes.push({
        newText: getUpdatedExportDeclaration(
          node.parent.parent,
          node,
          sourceFile,
        ),
        span: {
          start: node.parent.parent.getStart(sourceFile),
          length: node.parent.parent.getWidth(sourceFile),
        },
      });

      const from = node.parent.parent.moduleSpecifier
        ? ` from ${node.parent.parent.moduleSpecifier.getText(sourceFile)}`
        : '';

      removedExports.push({
        fileName,
        position: node.getStart(sourceFile),
        code: `export { ${node.getText(sourceFile)} }${from};`,
      });

      continue;
    }

    if (ts.isExportAssignment(node)) {
      changes.push({
        newText: '',
        span: {
          start: node.getFullStart(),
          length: node.getFullWidth(),
        },
      });

      removedExports.push({
        fileName,
        position: node.getStart(sourceFile),
        code: node.getText(sourceFile),
      });
      continue;
    }

    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      const identifier = node
        .getChildren(sourceFile)
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

        // there's no identifier so we try to get something like `export default function()` or `export default class`
        const code = node
          .getText(sourceFile)
          .slice(
            0,
            ts.isFunctionDeclaration(node)
              ? node.getText(sourceFile).indexOf(')') + 1
              : node.getText(sourceFile).indexOf('{') - 1,
          );

        removedExports.push({
          fileName,
          position: node.getStart(sourceFile),
          code,
        });

        continue;
      }
    }

    // we want to correctly remove 'default' when its a default export so we get the syntaxList node instead of the exportKeyword node
    // note: the first syntaxList node should contain the export keyword
    const syntaxListIndex = node
      .getChildren(sourceFile)
      .findIndex((n) => n.kind === ts.SyntaxKind.SyntaxList);

    const syntaxList = node.getChildren(sourceFile)[syntaxListIndex];
    const syntaxListNextSibling =
      node.getChildren(sourceFile)[syntaxListIndex + 1];

    if (!syntaxList || !syntaxListNextSibling) {
      continue;
      // fixme: this should not happen
      // throw new Error('syntax list not found');
    }

    changes.push({
      newText: ts.isFunctionDeclaration(node)
        ? stripExportKeyword(syntaxList, sourceFile)
        : '',
      span: {
        start: syntaxList.getStart(sourceFile),
        length:
          syntaxListNextSibling.getStart(sourceFile) -
          syntaxList.getStart(sourceFile),
      },
    });

    removedExports.push({
      fileName,
      position: node.getStart(sourceFile),
      code:
        findFirstNodeOfKind(node, ts.SyntaxKind.Identifier)?.getText(
          sourceFile,
        ) || '',
    });
  }

  return { changes, done: !aborted, isUsed, removedExports };
};

const disabledEditTracker: EditTracker = {
  start: () => {},
  end: () => {},
  delete: () => {},
  removeExport: () => {},
};

const getNecessaryFiles = ({
  targetFile,
  dependencyGraph,
  files,
}: {
  targetFile: string;
  dependencyGraph: DependencyGraph;
  files: string[];
}) => {
  // when the target file is not in the dependency graph reachable from the entrypoints, we return all files that are not included in the dependency graph.
  // this ensures that the result of removeUnusedExports is correct when deleteUnusedFile is false.
  if (!dependencyGraph.vertexes.has(targetFile)) {
    return new Set(files.filter((file) => !dependencyGraph.vertexes.has(file)));
  }

  const result = new Set<string>();
  const stack = [targetFile];

  while (stack.length > 0) {
    const file = stack.pop();

    if (!file) {
      break;
    }

    result.add(file);

    const vertex = dependencyGraph.vertexes.get(file);

    if (!vertex) {
      // should not happen
      continue;
    }

    for (const from of vertex.from) {
      result.add(from);

      const fromVertex = dependencyGraph.vertexes.get(from);

      if (fromVertex && fromVertex.data.hasReexport) {
        stack.push(from);

        continue;
      }

      if (vertex.data.fromDynamic.has(from)) {
        stack.push(from);
      }
    }
  }

  return result;
};

const createLanguageService = ({
  options,
  projectRoot,
  fileService,
}: {
  options: ts.CompilerOptions;
  projectRoot: string;
  fileService: FileService;
}) => {
  const languageService = ts.createLanguageService({
    getCompilationSettings() {
      return options;
    },
    getScriptFileNames() {
      return fileService.getFileNames();
    },
    getScriptVersion(fileName) {
      return fileService.getVersion(fileName);
    },
    getScriptSnapshot(fileName) {
      return ts.ScriptSnapshot.fromString(fileService.get(fileName));
    },
    getCurrentDirectory() {
      return projectRoot;
    },
    getDefaultLibFileName(o) {
      return ts.getDefaultLibFileName(o);
    },
    fileExists(name) {
      return fileService.exists(name);
    },
    readFile(name) {
      return fileService.get(name);
    },
  });

  return languageService;
};

// for use in worker
export const processFile = ({
  file,
  files,
  deleteUnusedFile,
  enableCodeFix,
  options,
  projectRoot,
}: {
  file: string;
  files: {
    [fileName: string]: string;
  };
  deleteUnusedFile: boolean;
  enableCodeFix: boolean;
  options: ts.CompilerOptions;
  projectRoot: string;
}) => {
  const removedExports: RemovedExport[] = [];
  const fileService = new MemoryFileService();

  const usage = new Set<string>();

  for (const [fileName, content] of Object.entries(files)) {
    fileService.set(fileName, content);

    // todo: the result should be reusable if we specify all files in the dependency graph for destFiles
    const collected = collectUsage({
      file: fileName,
      content,
      destFiles: new Set([file]),
      options,
    });

    collected[file]?.forEach((v) => usage.add(v));
  }

  const languageService = createLanguageService({
    options,
    projectRoot,
    fileService,
  });

  let content = fileService.get(file);
  let isUsed = false;

  do {
    const result = getTextChanges(usage, file, fileService);
    removedExports.push(...result.removedExports);

    isUsed = result.isUsed;

    content = applyTextChanges(content, result.changes);

    fileService.set(file, content);

    if (result.done) {
      break;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);

  if (!isUsed && deleteUnusedFile) {
    const result = {
      operation: 'delete' as const,
    };

    return result;
  }

  if (enableCodeFix) {
    while (true) {
      fileService.set(file, content);

      const result = applyCodeFix({
        fixId: fixIdDelete,
        fileName: file,
        languageService,
      });

      if (result === content) {
        break;
      }

      content = result;
    }

    fileService.set(file, content);

    content = applyCodeFix({
      fixId: fixIdDeleteImports,
      fileName: file,
      languageService,
    });
  }

  fileService.set(file, content);

  const result = {
    operation: 'edit' as const,
    content: fileService.get(file),
    removedExports,
  };

  return result;
};

const createProgram = ({
  fileService,
  options,
  projectRoot,
}: {
  fileService: FileService;
  options: ts.CompilerOptions;
  projectRoot: string;
}) => {
  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (!fileService.exists(fileName)) {
        return undefined;
      }

      return ts.createSourceFile(
        fileName,
        fileService.get(fileName),
        languageVersion,
      );
    },
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    writeFile: (fileName, content) => {
      fileService.set(fileName, content);
    },
    getCurrentDirectory: () => projectRoot,
    fileExists: (fileName) => fileService.exists(fileName),
    readFile: (fileName) => fileService.get(fileName),
    getCanonicalFileName: (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  const program = ts.createProgram(
    fileService.getFileNames(),
    options,
    compilerHost,
  );

  return program;
};

// whole reexports (export * from './foo') will not be detected as usage by the ts.LanguageService.findReferences API
// when the entrypoint includes whole reexports, we need to add the imported files to entrypoints to avoid mistakenly deleting them
const collectSkipFiles = ({
  entrypoints,
  program,
  fileService,
}: {
  entrypoints: string[];
  program: ts.Program;
  fileService: FileService;
}) => {
  const stack = [...entrypoints];
  const result: string[] = [];

  while (stack.length > 0) {
    const file = stack.pop();

    if (!file) {
      break;
    }

    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      continue;
    }

    const visit = (node: ts.Node) => {
      if (!ts.isExportDeclaration(node)) {
        return;
      }

      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
        return;
      }

      if (node.exportClause) {
        return;
      }

      const dest = getFileFromModuleSpecifierText({
        specifier: node.moduleSpecifier.text,
        program,
        fileName: sourceFile.fileName,
        fileService,
      });

      if (dest) {
        stack.push(dest);
        result.push(dest);
      }
    };

    sourceFile.forEachChild(visit);
  }

  return result;
};

const removeWholeExportSpecifier = (
  content: string,
  specifier: string,
  target?: ts.ScriptTarget,
) => {
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    content,
    target ?? ts.ScriptTarget.Latest,
  );

  const result: {
    textChange: ts.TextChange;
    info: { position: number; code: string };
  }[] = [];

  const visit = (node: ts.Node) => {
    if (result.length > 0) {
      return;
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.exportClause &&
      node.moduleSpecifier.text === specifier
    ) {
      result.push({
        textChange: {
          newText: '',
          span: {
            start: node.getFullStart(),
            length: node.getFullWidth(),
          },
        },
        info: {
          position: node.getStart(sourceFile),
          code: node.getText(sourceFile),
        },
      });
    }
  };

  sourceFile.forEachChild(visit);

  if (!result[0]) {
    return null;
  }

  return {
    info: result[0].info,
    content: applyTextChanges(content, [result[0].textChange]),
  };
};

export const removeUnusedExport = async ({
  entrypoints,
  fileService,
  deleteUnusedFile = false,
  enableCodeFix = false,
  editTracker = disabledEditTracker,
  options = {},
  projectRoot = '.',
  pool,
  recursive,
}: {
  entrypoints: string[];
  fileService: FileService;
  enableCodeFix?: boolean;
  deleteUnusedFile?: boolean;
  editTracker?: EditTracker;
  options?: ts.CompilerOptions;
  projectRoot?: string;
  recursive: boolean;
  pool?: WorkerPool<typeof processFile>;
}) => {
  const program = createProgram({ fileService, options, projectRoot });

  const skipFiles = collectSkipFiles({
    entrypoints,
    program,
    fileService,
  });

  const dependencyGraph = collectImports({
    fileService,
    program,
    entrypoints,
  });

  let filesOutsideOfGraphHasSkipComment = false;

  const initialFiles: { file: string; depth: number }[] = [];

  for (const file of fileService.getFileNames()) {
    if (entrypoints.includes(file)) {
      continue;
    }

    const vertex = dependencyGraph.vertexes.get(file);

    if (vertex) {
      initialFiles.push({ file, depth: vertex.data.depth });
      continue;
    }

    if (fileService.get(file).includes(IGNORE_COMMENT)) {
      filesOutsideOfGraphHasSkipComment = true;
    }

    if (
      deleteUnusedFile &&
      !filesOutsideOfGraphHasSkipComment &&
      !skipFiles.includes(file)
    ) {
      editTracker.start(file, fileService.get(file));
      editTracker.delete(file);
      fileService.delete(file);

      continue;
    }

    initialFiles.push({ file, depth: -1 });
  }

  // sort initial files by depth so that we process the files closest to the entrypoints first
  initialFiles.sort((a, b) => a.depth - b.depth);

  const wholeReexportsToBeDeleted: { file: string; specifier: string }[] = [];

  const taskManager = new TaskManager(async (c) => {
    // if the file is not in the file service, it means it has been deleted in a previous iteration
    if (!fileService.exists(c.file)) {
      return;
    }

    const vertex = dependencyGraph.vertexes.get(c.file);

    if (vertex && vertex.data.fromDynamic.size > 0) {
      await Promise.resolve();

      if (c.signal.aborted) {
        return;
      }

      editTracker.start(c.file, fileService.get(c.file));
      editTracker.end(c.file);
      return;
    }

    const necessaryFiles = getNecessaryFiles({
      targetFile: c.file,
      dependencyGraph,
      files: fileService.getFileNames(),
    });

    const files = Array.from(necessaryFiles).reduce(
      (acc, cur) => ({
        ...acc,
        [cur]: fileService.get(cur),
      }),
      {} as { [fileName: string]: string },
    );

    await Promise.resolve();

    if (c.signal.aborted) {
      return;
    }

    const fn = pool ? pool.run.bind(pool) : processFile;

    const result = await fn({
      file: c.file,
      files,
      deleteUnusedFile,
      enableCodeFix,
      options,
      projectRoot,
    });

    if (c.signal.aborted) {
      return;
    }

    switch (result.operation) {
      case 'delete': {
        editTracker.start(c.file, fileService.get(c.file));

        if (skipFiles.includes(c.file)) {
          editTracker.end(c.file);
          break;
        }

        editTracker.delete(c.file);
        fileService.delete(c.file);

        if (vertex) {
          for (const v of vertex.from) {
            const target = dependencyGraph.vertexes.get(v);

            if (!target) {
              continue;
            }

            const specifier = target.data.wholeReexportSpecifier.get(c.file);

            if (target.data.hasReexport && specifier) {
              wholeReexportsToBeDeleted.push({ file: v, specifier });
            }
          }

          dependencyGraph.deleteVertex(c.file);

          if (recursive) {
            c.add(
              ...Array.from(vertex.to).filter((f) => !entrypoints.includes(f)),
            );
          }
        }
        break;
      }
      case 'edit': {
        editTracker.start(c.file, fileService.get(c.file));
        for (const item of result.removedExports) {
          editTracker.removeExport(item.fileName, {
            code: item.code,
            position: item.position,
          });
        }
        editTracker.end(c.file);
        fileService.set(c.file, result.content);

        if (vertex && result.removedExports.length > 0 && recursive) {
          c.add(
            ...Array.from(vertex.to).filter((f) => !entrypoints.includes(f)),
          );
        }
        break;
      }
    }
  });

  await taskManager.execute(initialFiles.map((v) => v.file));

  for (const item of wholeReexportsToBeDeleted) {
    if (!fileService.exists(item.file)) {
      continue;
    }
    const content = fileService.get(item.file);
    const result = removeWholeExportSpecifier(content, item.specifier);

    if (!result) {
      continue;
    }

    fileService.set(item.file, result.content);

    editTracker.start(item.file, content);
    editTracker.removeExport(item.file, result.info);
    editTracker.end(item.file);
  }
};
