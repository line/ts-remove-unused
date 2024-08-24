import { describe, it } from 'node:test';
import { FileService } from './FileService.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { removeExport } from './removeExport.js';

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

describe('removeExport', () => {
  it('should remove the export keyword', () => {
    const { languageService, fileService } = setup();
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

    removeExport({
      fileService,
      targetFile: 'util/operations.ts',
      languageService,
    });

    const content = fileService.get('util/operations.ts');

    assert.equal(content.match(/export/g)?.length, 1);
  });
});
