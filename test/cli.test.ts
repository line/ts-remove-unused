import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';

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

const isVariableStatement = (node: ts.Node): node is ts.VariableStatement =>
  node.kind === ts.SyntaxKind.VariableStatement;

const getFirstUnusedExport = (
  sourceFile: ts.SourceFile,
  service: ts.LanguageService,
) => {
  let result: ts.VariableStatement | undefined;

  const visit = (node: ts.Node) => {
    if (result) {
      return;
    }

    if (isVariableStatement(node)) {
      const hasExportKeyword = !!findFirstNodeOfKind(
        node,
        ts.SyntaxKind.ExportKeyword,
      );

      if (hasExportKeyword) {
        const variableDeclaration = findFirstNodeOfKind(
          node,
          ts.SyntaxKind.VariableDeclaration,
        );

        if (!variableDeclaration) {
          throw new Error('variable declaration not found');
        }

        const references = service.findReferences(
          sourceFile.fileName,
          variableDeclaration.getStart(),
        );

        if (!references) {
          throw new Error('references not found');
        }

        // there will be at least one reference, the declaration itself
        if (references.length === 1) {
          result = node;
          return;
        }
      }
    }
    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return result;
};

function* getUnusedExportWhileExists(
  service: ts.LanguageService,
  file: string,
) {
  let prev: ts.VariableStatement | undefined;

  do {
    const program = service.getProgram();

    if (!program) {
      throw new Error('program not found');
    }

    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      throw new Error('source file not found');
    }

    const firstExport = getFirstUnusedExport(sourceFile, service);

    prev = firstExport;

    if (firstExport) {
      yield firstExport;
    }
  } while (prev);
}

class FileService {
  #files: Map<string, { content: string; version: number }>;

  constructor() {
    this.#files = new Map();
  }

  set(name: string, content: string) {
    const currentVersion = this.#files.get(name)?.version || 0;
    this.#files.set(name, {
      content,
      version: currentVersion + 1,
    });
  }

  get(name: string) {
    const file = this.#files.get(name);

    // todo: should we return an empty string or undefined?
    return file ? file.content : '';
  }

  delete(name: string) {
    this.#files.delete(name);
  }

  getVersion(name: string) {
    const file = this.#files.get(name);

    return file ? file.version.toString() : '';
  }

  getFileNames() {
    return Array.from(this.#files.keys());
  }

  exists(name: string) {
    return this.#files.has(name);
  }
}

const removeExport = ({
  fileService,
  targetFile,
  languageService,
}: {
  fileService: FileService;
  targetFile: string;
  languageService: ts.LanguageService;
}) => {
  for (const item of getUnusedExportWhileExists(languageService, targetFile)) {
    console.log(item.getText());
    const exportKeyword = findFirstNodeOfKind(
      item,
      ts.SyntaxKind.ExportKeyword,
    );

    if (!exportKeyword) {
      throw new Error('export keyword not found');
    }

    const content = item.getSourceFile().getFullText();

    const start = exportKeyword.getStart();
    const end = exportKeyword.getEnd();

    const newContent = `${content.slice(0, start)}${content.slice(end)}`;

    fileService.set(targetFile, newContent);
  }
};

describe('cli', () => {
  const setup = () => {
    const fileService = new FileService();

    fileService.set(
      'main.ts',
      `import { add } from './util/operations.js';
            export const main = () => {};
          `,
    );

    fileService.set(
      'util/operations.ts',
      `export const add = (a: number, b: number) => a + b;
            export const subtract = (a: number, b: number) => a - b;
            const multiply = (a: number, b: number) => a * b;
            export const divide = (a: number, b: number) => a / b;
            `,
    );

    const languageService = ts.createLanguageService({
      getCompilationSettings() {
        return {};
      },
      getScriptFileNames() {
        return fileService.getFileNames();
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getScriptVersion(fileName) {
        return fileService.getVersion(fileName);
      },
      getScriptSnapshot(fileName) {
        return ts.ScriptSnapshot.fromString(fileService.get(fileName));
      },
      getCurrentDirectory: () => '.',

      getDefaultLibFileName(options) {
        return ts.getDefaultLibFileName(options);
      },
      fileExists: (name) => fileService.exists(name),
      readFile: (name) => fileService.get(name),
    });

    return { languageService, fileService };
  };
  it('should remove the export keyword', () => {
    const { languageService, fileService } = setup();
    removeExport({
      fileService,
      targetFile: 'util/operations.ts',
      languageService,
    });

    const content = fileService.get('util/operations.ts');

    assert.equal(content.match(/export/g)?.length, 1);
  });
});
