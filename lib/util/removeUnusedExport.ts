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
import type Tinypool from 'tinypool';

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

const getReexportInFile = (file: ts.SourceFile) => {
  const result: ts.ExportSpecifier[] = [];

  // todo: consider pruning for performance
  const visit = (node: ts.Node) => {
    if (ts.isExportSpecifier(node)) {
      if (
        node.parent.parent.moduleSpecifier &&
        ts.isStringLiteral(node.parent.parent.moduleSpecifier)
      ) {
        result.push(node);
      }

      return;
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);

  return result;
};

const getAncestorFiles = (
  node: ts.ExportSpecifier,
  references: ts.ReferencedSymbol[],
  fileService: FileService,
  program: ts.Program,
  fileName: string,
) => {
  const result = new Set<string>();
  const referencesKeyValue = Object.fromEntries(
    references.map((v) => [v.definition.fileName, v]),
  );

  if (
    !node.parent.parent.moduleSpecifier ||
    !ts.isStringLiteral(node.parent.parent.moduleSpecifier)
  ) {
    return result;
  }

  let specifier: string | null = node.parent.parent.moduleSpecifier.text;
  let currentFile = fileName;

  while (specifier) {
    const origin = getFileFromModuleSpecifierText({
      specifier,
      fileName: currentFile,
      program,
      fileService,
    });

    if (!origin) {
      break;
    }

    result.add(origin);

    const referencedSymbol = referencesKeyValue[origin];

    if (!referencedSymbol) {
      break;
    }

    const sourceFile = program.getSourceFile(origin);

    if (!sourceFile) {
      break;
    }

    const reexportSpecifiers = getReexportInFile(sourceFile);
    const firstReferencedSymbol = referencedSymbol.references[0];
    const reexportNode = firstReferencedSymbol
      ? reexportSpecifiers.find((r) => {
          const start = firstReferencedSymbol.textSpan.start;
          const end = start + firstReferencedSymbol.textSpan.length;

          return r.getStart() === start && r.getEnd() === end;
        })
      : undefined;

    if (reexportNode) {
      if (
        !reexportNode.parent.parent.moduleSpecifier ||
        !ts.isStringLiteral(reexportNode.parent.parent.moduleSpecifier)
      ) {
        // type guard: should not happen
        throw new Error('unexpected reexportNode');
      }

      specifier = reexportNode.parent.parent.moduleSpecifier.text;
      currentFile = origin;
    } else {
      specifier = null;
    }
  }
  return result;
};

const getUnusedExports = (
  languageService: ts.LanguageService,
  sourceFile: ts.SourceFile,
  fileService: FileService,
) => {
  const { fileName } = sourceFile;
  const nodes: SupportedNode[] = [];
  let isUsed = false;

  const program = languageService.getProgram();

  if (!program) {
    throw new Error('program not found');
  }

  const visit = (node: ts.Node) => {
    if (ts.isExportDeclaration(node) && !node.exportClause) {
      // special case for `export * from './foo';`
      isUsed = true;
      return;
    }

    if (isTarget(node)) {
      if (getLeadingComment(node).includes(IGNORE_COMMENT)) {
        isUsed = true;
        return;
      }

      const references = findReferences(node, languageService);

      if (!references) {
        return;
      }

      // reexport syntax: `export { foo } from './bar';`
      if (ts.isExportSpecifier(node) && node.parent.parent.moduleSpecifier) {
        const ancestors = getAncestorFiles(
          node,
          references,
          fileService,
          program,
          fileName,
        );

        const count = references
          .flatMap((v) => v.references)
          .filter(
            (v) => v.fileName !== fileName && !ancestors.has(v.fileName),
          ).length;

        if (count > 0) {
          isUsed = true;
        } else {
          nodes.push(node);
        }

        return;
      }

      const count = references
        .flatMap((v) => v.references)
        .filter((v) => v.fileName !== fileName).length;

      if (count > 0) {
        isUsed = true;
      } else {
        nodes.push(node);
      }

      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return { nodes, isUsed };
};

const getUpdatedExportDeclaration = (
  exportDeclaration: ts.ExportDeclaration,
  removeTarget: ts.ExportSpecifier,
) => {
  const tmpFile = ts.createSourceFile(
    'tmp.ts',
    exportDeclaration.getText(),
    exportDeclaration.getSourceFile().languageVersion,
  );

  const transformer: ts.TransformerFactory<ts.SourceFile> =
    (context: ts.TransformationContext) => (rootNode: ts.SourceFile) => {
      const visitor = (node: ts.Node): ts.Node | undefined => {
        if (
          ts.isExportSpecifier(node) &&
          node.getText(tmpFile) === removeTarget.getText()
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

const stripExportKeyword = (syntaxList: ts.Node) => {
  const file = ts.createSourceFile(
    'tmp.ts',
    `${syntaxList.getText()} function f() {}`,
    syntaxList.getSourceFile().languageVersion,
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
  languageService: ts.LanguageService,
  file: string,
  fileService: FileService,
) => {
  const sourceFile = languageService.getProgram()?.getSourceFile(file);

  if (!sourceFile) {
    throw new Error('source file not found');
  }

  const removedExports: RemovedExport[] = [];
  const changes: ts.TextChange[] = [];
  // usually we want to remove all unused exports in one pass, but there are some cases where we need to do multiple passes
  // for example, when we have multiple export specifiers in one export declaration, we want to remove them one by one because the text change range will conflict
  let aborted = false;

  const { nodes, isUsed } = getUnusedExports(
    languageService,
    sourceFile,
    fileService,
  );
  for (const node of nodes) {
    if (aborted === true) {
      break;
    }

    if (ts.isExportSpecifier(node)) {
      const specifierCount = Array.from(node.parent.elements).length;

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
          fileName: sourceFile.fileName,
          position: node.parent.parent.getStart(),
          code: node.parent.parent.getText(),
        });

        continue;
      }

      aborted = true;
      changes.push({
        newText: getUpdatedExportDeclaration(node.parent.parent, node),
        span: {
          start: node.parent.parent.getStart(),
          length: node.parent.parent.getWidth(),
        },
      });

      const from = node.parent.parent.moduleSpecifier
        ? ` from ${node.parent.parent.moduleSpecifier.getText()}`
        : '';

      removedExports.push({
        fileName: sourceFile.fileName,
        position: node.getStart(),
        code: `export { ${node.getText()} }${from};`,
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
        fileName: sourceFile.fileName,
        position: node.getStart(),
        code: node.getText(),
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

        // there's no identifier so we try to get something like `export default function()` or `export default class`
        const code = node
          .getText()
          .slice(
            0,
            ts.isFunctionDeclaration(node)
              ? node.getText().indexOf(')') + 1
              : node.getText().indexOf('{') - 1,
          );

        removedExports.push({
          fileName: sourceFile.fileName,
          position: node.getStart(),
          code,
        });

        continue;
      }
    }

    // we want to correctly remove 'default' when its a default export so we get the syntaxList node instead of the exportKeyword node
    // note: the first syntaxList node should contain the export keyword
    const syntaxListIndex = node
      .getChildren()
      .findIndex((n) => n.kind === ts.SyntaxKind.SyntaxList);

    const syntaxList = node.getChildren()[syntaxListIndex];
    const syntaxListNextSibling = node.getChildren()[syntaxListIndex + 1];

    if (!syntaxList || !syntaxListNextSibling) {
      throw new Error('syntax list not found');
    }

    changes.push({
      newText: ts.isFunctionDeclaration(node)
        ? stripExportKeyword(syntaxList)
        : '',
      span: {
        start: syntaxList.getStart(),
        length: syntaxListNextSibling.getStart() - syntaxList.getStart(),
      },
    });

    removedExports.push({
      fileName: sourceFile.fileName,
      position: node.getStart(),
      code:
        findFirstNodeOfKind(node, ts.SyntaxKind.Identifier)?.getText() || '',
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

declare global {
  // eslint-disable-next-line no-var
  var __INTERNAL_WORKER_URL__: string | undefined;
}

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

  for (const [fileName, content] of Object.entries(files)) {
    fileService.set(fileName, content);
  }

  const languageService = createLanguageService({
    options,
    projectRoot,
    fileService,
  });

  let content = fileService.get(file);
  let isUsed = false;

  do {
    const result = getTextChanges(languageService, file, fileService);
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

// the default worker url is relative to the output directory
const defaultWorkerUrl = new URL('./worker.js', import.meta.url).href;

const processFileInPool: (
  pool: Tinypool,
  arg: Parameters<typeof processFile>[0],
) => Promise<ReturnType<typeof processFile>> = (pool, arg) =>
  pool.run(arg, {
    filename: globalThis.__INTERNAL_WORKER_URL__ || defaultWorkerUrl,
    name: 'processFile',
  });

export const removeUnusedExport = async ({
  entrypoints,
  fileService,
  deleteUnusedFile = false,
  enableCodeFix = false,
  editTracker = disabledEditTracker,
  options = {},
  projectRoot = '.',
  pool,
}: {
  entrypoints: string[];
  fileService: FileService;
  enableCodeFix?: boolean;
  deleteUnusedFile?: boolean;
  editTracker?: EditTracker;
  options?: ts.CompilerOptions;
  projectRoot?: string;
  pool: Tinypool;
}) => {
  const program = createProgram({ fileService, options, projectRoot });

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

    if (deleteUnusedFile && !filesOutsideOfGraphHasSkipComment) {
      editTracker.start(file, fileService.get(file));
      editTracker.delete(file);
      fileService.delete(file);

      continue;
    }

    initialFiles.push({ file, depth: -1 });
  }

  // sort initial files by depth so that we process the files closest to the entrypoints first
  initialFiles.sort((a, b) => a.depth - b.depth);

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

    const result = await processFileInPool(pool, {
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
        editTracker.delete(c.file);
        fileService.delete(c.file);

        if (vertex) {
          dependencyGraph.deleteVertex(c.file);
          c.add(
            ...Array.from(vertex.to).filter((f) => !entrypoints.includes(f)),
          );
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

        if (vertex && result.removedExports.length > 0) {
          c.add(
            ...Array.from(vertex.to).filter((f) => !entrypoints.includes(f)),
          );
        }
        break;
      }
    }
  });

  await taskManager.execute(initialFiles.map((v) => v.file));
};

type TaskHandler = ({
  file,
  signal,
  add,
}: {
  file: string;
  signal: AbortSignal;
  add: (...files: string[]) => void;
}) => Promise<void>;

type Task = {
  file: string;
  controller: AbortController;
  promise: Promise<void>;
  isFulfilled: boolean;
};

class TaskManager {
  #handler: TaskHandler;
  #queue: string[] = [];
  #ongoing: Task[] = [];

  constructor(handler: TaskHandler) {
    this.#handler = handler;
  }

  #startQueued() {
    while (this.#queue.length > 0) {
      const file = this.#queue.shift();

      if (!file) {
        break;
      }

      const controller = new AbortController();
      const signal = controller.signal;

      const task = {
        file,
        controller,
        promise: this.#handler({
          file,
          signal,
          add: (...files) => {
            this.#ongoing
              .filter((t) => files.includes(t.file))
              .forEach((t) => t.controller.abort());
            this.#queue.push(...files);
          },
        }).then(() => {
          task.isFulfilled = true;
        }),
        isFulfilled: false,
      };

      this.#ongoing.push(task);
    }
  }

  async execute(files: string[]) {
    this.#queue.push(...files);

    while (this.#queue.length > 0 || this.#ongoing.length > 0) {
      this.#startQueued();
      await Promise.race(this.#ongoing.map((t) => t.promise));
      this.#ongoing = this.#ongoing.filter((t) => !t.isFulfilled);
    }
  }
}
