import { describe, it } from 'node:test';
import { FileService } from './FileService.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {
  applyCodeFix,
  fixIdDelete,
  fixIdDeleteImports,
} from './applyCodeFix.js';

const setup = () => {
  const fileService = new FileService();

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

describe('applyCodeFix', () => {
  it('should clean up unused identifiers', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      'main.ts',
      `import { add } from './util/operations.js';
                const main = () => {};
              `,
    );

    fileService.set(
      'util/operations.ts',
      `export const add = (a: number, b: number) => a + b;
              const subtract = (a: number, b: number) => a - b;
              const multiply = (a: number, b: number) => a * b;
              const divide = (a: number, b: number) => a / b;
                `,
    );

    applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileService,
      fileName: 'util/operations.ts',
    });

    assert.equal(
      fileService.get('util/operations.ts').trim(),
      'export const add = (a: number, b: number) => a + b;',
    );
  });

  it('should clean up unused imports', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      'main.ts',
      `import { add } from './util/operations.js';
          `,
    );

    fileService.set(
      'util/operations.ts',
      `import { readFileSync } from 'node:fs';
          export const add = (a: number, b: number) => a + b;
  `,
    );

    applyCodeFix({
      fixId: fixIdDeleteImports,
      languageService,
      fileService,
      fileName: 'util/operations.ts',
    });

    assert.equal(
      fileService.get('util/operations.ts').trim(),
      'export const add = (a: number, b: number) => a + b;',
    );
  });
});
