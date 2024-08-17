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

describe('cli', () => {
  it('should find out the number of references for each export', () => {
    const files: { [name: string]: string } = {
      'main.ts': `import { add } from './operations.js`,
      'operations.ts': `export const add = (a: number, b: number) => a + b;
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
        console.log('script snapshot', fileName);
        return ts.ScriptSnapshot.fromString(files[fileName] || '');
      },
      getCurrentDirectory: () => '.',

      getDefaultLibFileName(options) {
        return ts.getDefaultLibFileName(options);
      },
      fileExists: (name) => !!files[name],
      readFile: (name) => files[name],
    });

    const program = service.getProgram();

    if (!program) {
      throw new Error('program not found');
    }

    const sourceFile = program.getSourceFile('operations.ts');

    if (!sourceFile) {
      throw new Error('source file not found');
    }

    const result: { file: string; identifier: string; count: number }[] = [];

    const visit = (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.VariableStatement) {
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
            'operations.ts',
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
            file: 'operations.ts',
            count: references.length,
            identifier: identifier.getText(),
          });
        }

        return;
      }
      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);
    assert.deepStrictEqual(result, [
      { file: 'operations.ts', count: 2, identifier: 'add' },
      { file: 'operations.ts', count: 1, identifier: 'subtract' },
    ]);
  });
});
