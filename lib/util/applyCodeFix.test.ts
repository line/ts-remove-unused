import { describe, it } from 'node:test';
import { FileService } from '../FileService.js';
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
    fileService.set('/app/main.ts', `import { a } from './a';`);

    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
const b = 'b';`,
    );

    const result = applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileName: '/app/a.ts',
    });

    assert.equal(result.trim(), `export const a = 'a';`);
  });

  it('should clean up unused imports', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a';`);

    fileService.set(
      '/app/a.ts',
      `import { readFileSync } from 'node:fs';
export const a = 'a';`,
    );

    const result = applyCodeFix({
      fixId: fixIdDeleteImports,
      languageService,
      fileName: '/app/a.ts',
    });

    assert.equal(result.trim(), `export const a = 'a';`);
  });
});
