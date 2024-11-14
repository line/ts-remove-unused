import { describe, it } from 'node:test';
import { MemoryFileService } from './MemoryFileService.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {
  applyCodeFix,
  fixIdDelete,
  fixIdDeleteImports,
} from './applyCodeFix.js';

const setup = () => {
  const fileService = new MemoryFileService();

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

    assert.equal(result, `export const a = 'a';\n`);
  });

  it('should clean up multiple unused identifiers', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
const b = 'b';
const c = 'c';`,
    );

    const result = applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileName: '/app/a.ts',
    });

    assert.equal(result, `export const a = 'a';\n`);
  });

  it('should only clean up unused identifiers once', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
const b = () => a();
const c = () => b();
const d = () => c();`,
    );

    const result = applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileName: '/app/a.ts',
    });
    assert.equal(
      result,
      `export const a = 'a';
const b = () => a();
const c = () => b();\n`,
    );
  });

  it('should clean up unused imports', () => {
    const { languageService, fileService } = setup();

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

    assert.equal(result, `export const a = 'a';`);
  });

  it('should not remove unused positional parameters from method declaration', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/a.ts',
      `const a = {
  fn(b: string, c: number) {
    return c;
  },
};`,
    );

    const result = applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileName: '/app/a.ts',
    });

    assert.equal(
      result,
      `const a = {
  fn(b: string, c: number) {
    return c;
  },
};`,
    );
  });

  it('should not remove unused positional parameters from arrow function', async () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/a.ts', `const a = (b: string) => 1;`);
    const result = await applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileName: '/app/a.ts',
    });
    assert.equal(result, `const a = (b: string) => 1;`);
  });

  it('should not remove unused positional parameters from function declaration', async () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/a.ts', `function a(b: string) { return 1; }`);
    const result = await applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileName: '/app/a.ts',
    });
    assert.equal(result, `function a(b: string) { return 1; }`);
  });
});
