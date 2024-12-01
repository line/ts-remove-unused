import ts from 'typescript';
import { FileService } from './FileService.js';
import { applyTextChanges } from './applyTextChanges.js';
import {
  applyCodeFix,
  fixIdDelete,
  fixIdDeleteImports,
} from './applyCodeFix.js';
import { EditTracker } from './EditTracker.js';
import { Vertexes } from './DependencyGraph.js';
import { createDependencyGraph } from './createDependencyGraph.js';
import { MemoryFileService } from './MemoryFileService.js';
import { TaskManager } from './TaskManager.js';
import { findFileUsage } from './findFileUsage.js';
import { parseFile } from './parseFile.js';

const transform = (
  source: string,
  transformer: ts.TransformerFactory<ts.SourceFile>,
) => {
  const file = ts.createSourceFile('file.ts', source, ts.ScriptTarget.Latest);
  const result = ts.transform(file, [transformer]).transformed[0];
  const printer = ts.createPrinter();
  return result ? printer.printFile(result).trim() : '';
};

const stripFunctionExportKeyword = (syntaxList: string) => {
  const code = transform(
    `${syntaxList} function f() {}`,
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
    },
  );
  const pos = code.indexOf('function');
  return code.slice(0, pos);
};

const stripEnumExportKeyword = (syntaxList: string) => {
  const code = transform(
    `${syntaxList} enum E {}`,
    (context: ts.TransformationContext) => (rootNode: ts.SourceFile) => {
      const visitor = (node: ts.Node): ts.Node | undefined => {
        if (ts.isEnumDeclaration(node)) {
          return ts.factory.createEnumDeclaration(
            node.modifiers?.filter(
              (v) => v.kind !== ts.SyntaxKind.ExportKeyword,
            ),
            node.name,
            node.members,
          );
        }
        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitEachChild(rootNode, visitor, context);
    },
  );
  const pos = code.indexOf('enum');
  return code.slice(0, pos);
};

const disabledEditTracker: EditTracker = {
  start: () => {},
  end: () => {},
  delete: () => {},
  removeExport: () => {},
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
      return Array.from(fileService.getFileNames());
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

const updateExportDeclaration = (code: string, unused: string[]) => {
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    code,
    ts.ScriptTarget.Latest,
  );

  const transformer: ts.TransformerFactory<ts.SourceFile> =
    (context: ts.TransformationContext) => (rootNode: ts.SourceFile) => {
      const visitor = (node: ts.Node): ts.Node | undefined => {
        if (
          ts.isExportSpecifier(node) &&
          unused.includes(node.getText(sourceFile))
        ) {
          return undefined;
        }
        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitEachChild(rootNode, visitor, context);
    };

  const result = ts.transform(sourceFile, [transformer]).transformed[0];

  const printer = ts.createPrinter();
  const printed = result ? printer.printFile(result).replace(/\n$/, '') : '';
  const leading = code.match(/^([\s]+)/)?.[0] || '';

  return `${leading}${printed}`;
};

const getSpecifierPosition = (exportDeclaration: string) => {
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    exportDeclaration,
    ts.ScriptTarget.Latest,
  );

  const result = new Map<string, number>();

  const visit = (node: ts.Node) => {
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause?.kind === ts.SyntaxKind.NamedExports
    ) {
      node.exportClause.elements.forEach((element) => {
        result.set(
          element.name.text,
          element.getStart(sourceFile) - sourceFile.getStart(),
        );
      });
    }
  };

  sourceFile.forEachChild(visit);

  return result;
};

const processFile = ({
  targetFile,
  files,
  fileNames,
  vertexes,
  deleteUnusedFile,
  enableCodeFix,
  options,
  projectRoot,
}: {
  targetFile: string;
  vertexes: Vertexes;
  files: Map<string, string>;
  fileNames: Set<string>;
  deleteUnusedFile: boolean;
  enableCodeFix: boolean;
  options: ts.CompilerOptions;
  projectRoot: string;
}) => {
  const usage = findFileUsage({
    targetFile,
    vertexes,
    files,
    fileNames,
    options,
  });

  if (usage.has('*')) {
    return {
      operation: 'edit' as const,
      content: files.get(targetFile) || '',
      removedExports: [],
    };
  }

  const { exports, ambientDeclarations } = parseFile({
    file: targetFile,
    content: files.get(targetFile) || '',
    options,
    destFiles: vertexes.get(targetFile)?.to || new Set([]),
  });

  if (
    usage.size === 0 &&
    deleteUnusedFile &&
    ambientDeclarations.length === 0 &&
    !exports.some((v) => 'skip' in v && v.skip)
  ) {
    return {
      operation: 'delete' as const,
    };
  }

  const changes: ts.TextChange[] = [];
  const logs: {
    fileName: string;
    position: number;
    code: string;
  }[] = [];

  const emptyExportDeclarations: {
    kind: ts.SyntaxKind.ExportDeclaration;
    type: 'named';
    name: string[];
    skip: boolean;
    change: {
      code: string;
      span: {
        start: number;
        length: number;
      };
    };
    start: number;
  }[] = [];

  exports.forEach((item) => {
    switch (item.kind) {
      case ts.SyntaxKind.VariableStatement: {
        if (item.skip || item.name.some((it) => usage.has(it))) {
          break;
        }

        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          // todo: consider a more aggressive approach to modify the declaration
          // and only export the names that are actually used in other files
          // for now, we remove the export keyword only if all names are unused
          code: item.name.join(', '),
        });

        break;
      }
      case ts.SyntaxKind.FunctionDeclaration: {
        if (item.skip || usage.has(item.name)) {
          break;
        }

        changes.push({
          newText: item.change.isUnnamedDefaultExport
            ? ''
            : stripFunctionExportKeyword(item.change.code),
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: item.name,
        });

        break;
      }
      case ts.SyntaxKind.InterfaceDeclaration: {
        if (item.skip || usage.has(item.name)) {
          break;
        }

        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: item.name,
        });

        break;
      }
      case ts.SyntaxKind.TypeAliasDeclaration: {
        if (item.skip || usage.has(item.name)) {
          break;
        }

        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: item.name,
        });

        break;
      }
      case ts.SyntaxKind.EnumDeclaration: {
        if (item.skip || usage.has(item.name)) {
          break;
        }

        changes.push({
          newText: stripEnumExportKeyword(item.change.code),
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: item.name,
        });

        break;
      }
      case ts.SyntaxKind.ExportAssignment: {
        if (item.skip || usage.has('default')) {
          break;
        }

        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: 'default',
        });

        break;
      }
      case ts.SyntaxKind.ExportDeclaration: {
        switch (item.type) {
          case 'named': {
            if (item.skip) {
              break;
            }

            if (item.name.length === 0) {
              // is `export {};`
              // we will come back to this later because we can't judge if it's necessary or not yet
              emptyExportDeclarations.push(item);
              break;
            }

            if (item.name.every((it) => usage.has(it))) {
              break;
            }

            const unused = item.name.filter((it) => !usage.has(it));
            const count = item.name.length - unused.length;

            changes.push({
              newText:
                count > 0
                  ? updateExportDeclaration(item.change.code, unused)
                  : '',
              span: item.change.span,
            });

            const position = getSpecifierPosition(item.change.code);

            logs.push(
              ...unused.map((it) => ({
                fileName: targetFile,
                position: item.start + (position.get(it) || 0),
                code: it,
              })),
            );

            break;
          }
          case 'namespace': {
            if (usage.has(item.name)) {
              break;
            }

            changes.push({
              newText: '',
              span: item.change.span,
            });
            logs.push({
              fileName: targetFile,
              position: item.start,
              code: item.name,
            });

            break;
          }
          case 'whole': {
            if (!item.file) {
              // whole export is directed towards a file that is not in the project
              break;
            }

            const parsed = parseFile({
              file: item.file,
              content: files.get(item.file) || '',
              options,
              destFiles: fileNames,
            });

            const exported = parsed.exports.flatMap((v) =>
              'name' in v ? v.name : [],
            );

            if (exported.some((v) => usage.has(v))) {
              break;
            }

            changes.push({
              newText: '',
              span: item.change.span,
            });
            logs.push({
              fileName: targetFile,
              position: item.start,
              code: `export * from '${item.specifier}';`,
            });

            break;
          }
          default: {
            throw new Error(`unexpected: ${item satisfies never}`);
          }
        }
        break;
      }
      case ts.SyntaxKind.ClassDeclaration: {
        if (item.skip || usage.has(item.name)) {
          break;
        }

        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: item.name,
        });

        break;
      }
      default: {
        throw new Error(`unexpected: ${item satisfies never}`);
      }
    }
  });

  // special case: file has `export {};`
  if (emptyExportDeclarations.length > 0) {
    if (changes.length === exports.length - emptyExportDeclarations.length) {
      // there are no more "actual" exports left so we will preserve one empty export declaration
      emptyExportDeclarations.slice(0, -1).forEach((item) => {
        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: 'export {};',
        });
      });
    } else {
      // the empty export declaration is meaningless so we will remove all of them
      emptyExportDeclarations.forEach((item) => {
        changes.push({
          newText: '',
          span: item.change.span,
        });
        logs.push({
          fileName: targetFile,
          position: item.start,
          code: 'export {};',
        });
      });
    }
  }

  // at this moment, the equality means that there are really no more exports (including `export {};`) left
  if (
    changes.length === exports.length &&
    ambientDeclarations.length > 0 &&
    exports.length !== 0
  ) {
    changes.push({
      newText: `

// auto-generated by ts-remove-unused to preserve module declaration as augmentation
// this may not be necessary if an import statement exists
export {};\n`,
      span: {
        start: files.get(targetFile)?.length || 0,
        length: 0,
      },
    });
  }

  if (changes.length === 0) {
    const result = {
      operation: 'edit' as const,
      content: files.get(targetFile) || '',
      removedExports: logs,
    };

    return result;
  }

  let content = applyTextChanges(files.get(targetFile) || '', changes);
  const fileService = new MemoryFileService([[targetFile, content]]);

  if (enableCodeFix && changes.length > 0) {
    const languageService = createLanguageService({
      options,
      projectRoot,
      fileService,
    });

    while (true) {
      fileService.set(targetFile, content);

      const result = applyCodeFix({
        fixId: fixIdDelete,
        fileName: targetFile,
        languageService,
      });

      if (result === content) {
        break;
      }

      content = result;
    }

    fileService.set(targetFile, content);

    content = applyCodeFix({
      fixId: fixIdDeleteImports,
      fileName: targetFile,
      languageService,
    });
  }

  fileService.set(targetFile, content);

  const result = {
    operation: 'edit' as const,
    content: fileService.get(targetFile),
    removedExports: logs,
  };

  return result;
};

export const edit = async ({
  entrypoints,
  fileService,
  deleteUnusedFile = false,
  enableCodeFix = false,
  editTracker = disabledEditTracker,
  options = {},
  projectRoot = '.',
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
}) => {
  const dependencyGraph = createDependencyGraph({
    fileService,
    options,
    entrypoints,
  });

  // sort initial files by depth so that we process the files closest to the entrypoints first
  const initialFiles = Array.from(fileService.getFileNames())
    .filter((file) => !entrypoints.includes(file))
    .map((file) => ({
      file,
      depth: dependencyGraph.vertexes.get(file)?.data.depth || Infinity,
    }));

  initialFiles.sort((a, b) => a.depth - b.depth);

  const taskManager = new TaskManager(async (c) => {
    // if the file is not in the file service, it means it has been deleted in a previous iteration
    if (!fileService.exists(c.file)) {
      return;
    }

    const vertex = dependencyGraph.vertexes.get(c.file);

    await Promise.resolve();

    if (c.signal.aborted) {
      return;
    }

    const result = processFile({
      targetFile: c.file,
      vertexes: dependencyGraph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
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

        if (entrypoints.includes(c.file)) {
          editTracker.end(c.file);
          break;
        }

        editTracker.delete(c.file);
        fileService.delete(c.file);

        if (vertex) {
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
};
