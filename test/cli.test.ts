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

describe('cli', () => {
  it('should remove the export keyword', () => {
    const files = new Map<string, { content: string; version: number }>();
    files.set('main.ts', {
      content: `import { add } from './util/operations.js';
        export const main = () => {};
      `,
      version: 1,
    });

    files.set('util/operations.ts', {
      content: `export const add = (a: number, b: number) => a + b;
        export const subtract = (a: number, b: number) => a - b;
        const multiply = (a: number, b: number) => a * b;
        export const divide = (a: number, b: number) => a / b;
        `,
      version: 1,
    });

    const service = ts.createLanguageService({
      getCompilationSettings() {
        return {};
      },
      getScriptFileNames() {
        return Array.from(files.keys());
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getScriptVersion(fileName) {
        return files.get(fileName)?.version.toString() || '';
      },
      getScriptSnapshot(fileName) {
        return ts.ScriptSnapshot.fromString(files.get(fileName)?.content || '');
      },
      getCurrentDirectory: () => '.',

      getDefaultLibFileName(options) {
        return ts.getDefaultLibFileName(options);
      },
      fileExists: (name) => files.has(name),
      readFile: (name) => files.get(name)?.content || '',
    });

    for (const item of getUnusedExportWhileExists(
      service,
      'util/operations.ts',
    )) {
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

      files.set('util/operations.ts', {
        content: newContent,
        version: files.get('util/operations.ts')!.version + 1,
      });
    }

    const content = files.get('util/operations.ts')?.content || '';

    assert.equal(content.match(/export/g)?.length, 1);
  });
});
