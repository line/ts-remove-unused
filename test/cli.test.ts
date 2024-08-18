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

const getExports = (sourceFile: ts.SourceFile, service: ts.LanguageService) => {
  const result: { file: string; node: ts.VariableStatement; count: number }[] =
    [];

  const visit = (node: ts.Node) => {
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

        const identifier = findFirstNodeOfKind(
          variableDeclaration,
          ts.SyntaxKind.Identifier,
        );

        if (!identifier) {
          throw new Error('identifier not found');
        }

        result.push({
          file: sourceFile.fileName,
          count: references.length,
          node,
        });
      }

      return;
    }
    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return result;
};

const getExportsForService = (service: ts.LanguageService) => {
  const program = service.getProgram();

  if (!program) {
    throw new Error('program not found');
  }

  return program
    .getSourceFiles()
    .map((sourceFile) => getExports(sourceFile, service))
    .flat();
};

describe('cli', () => {
  it('should find out the number of references for each export', () => {
    const files: { [name: string]: string } = {
      'main.ts': `import { add } from './util/operations.js';
        export const main = () => {};
      `,
      'util/operations.ts': `export const add = (a: number, b: number) => a + b;
        export const subtract = (a: number, b: number) => a - b;
        const multiply = (a: number, b: number) => a * b;
        `,
    };

    const service = ts.createLanguageService({
      getCompilationSettings() {
        return {};
      },
      getScriptFileNames() {
        return Object.keys(files);
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getScriptVersion(_fileName) {
        return '';
      },
      getScriptSnapshot(fileName) {
        return ts.ScriptSnapshot.fromString(files[fileName] || '');
      },
      getCurrentDirectory: () => '.',

      getDefaultLibFileName(options) {
        return ts.getDefaultLibFileName(options);
      },
      fileExists: (name) => !!files[name],
      readFile: (name) => files[name],
    });

    const result = getExportsForService(service);

    assert.deepStrictEqual(
      result.map(({ node, ...rest }) => ({
        text: node.getText(),
        ...rest,
      })),
      [
        {
          file: 'util/operations.ts',
          count: 2,
          text: 'export const add = (a: number, b: number) => a + b;',
        },
        {
          file: 'util/operations.ts',
          count: 1,
          text: 'export const subtract = (a: number, b: number) => a - b;',
        },
        { file: 'main.ts', count: 1, text: 'export const main = () => {};' },
      ],
    );
  });

  it('should remove the export keyword', () => {
    const files: { [name: string]: string } = {
      'main.ts': `import { add } from './util/operations.js';
          export const main = () => {};
        `,
      'util/operations.ts': `export const add = (a: number, b: number) => a + b;
          export const subtract = (a: number, b: number) => a - b;
          const multiply = (a: number, b: number) => a * b;
          export const divide = (a: number, b: number) => a / b;
          `,
    };

    const service = ts.createLanguageService({
      getCompilationSettings() {
        return {};
      },
      getScriptFileNames() {
        return Object.keys(files);
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getScriptVersion(_fileName) {
        return '';
      },
      getScriptSnapshot(fileName) {
        return ts.ScriptSnapshot.fromString(files[fileName] || '');
      },
      getCurrentDirectory: () => '.',

      getDefaultLibFileName(options) {
        return ts.getDefaultLibFileName(options);
      },
      fileExists: (name) => !!files[name],
      readFile: (name) => files[name],
      writeFile: (name, text) => {
        files[name] = text;
      },
    });

    const list = getExportsForService(service);

    for (const item of list) {
      if (item.count >= 2) {
        continue;
      }

      const text = files[item.file];

      if (!text) {
        throw new Error('file not found');
      }

      const exportKeyword = findFirstNodeOfKind(
        item.node,
        ts.SyntaxKind.ExportKeyword,
      );

      if (!exportKeyword) {
        throw new Error('export keyword not found');
      }

      const start = exportKeyword.getStart();
      const end = exportKeyword.getEnd();

      const replaced = `${text.slice(0, start)}${text.slice(end)}`;

      console.log({ target: item.node.getText(), replaced });
    }
  });
});
