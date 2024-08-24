import { describe, it } from 'node:test';
import { FileService } from './FileService.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { removeExport, removeUnusedFile } from './removeExport.js';

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

describe('removeUnusedFile', () => {
  it('should not remove file if some exports are used in other files', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/main.ts',
      `import { a } from './a';
import { b } from './b';
import { C } from './c';
import { D } from './d';
import { E } from './e';`,
    );
    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
export function b() {}
export class C {}
export type D = 'd';
export interface E {}`,
    );
    fileService.set(
      '/app/b.ts',
      `export const a = 'a';
export function b() {}
export class C {}
export type D = 'd';
export interface E {}`,
    );
    fileService.set(
      '/app/c.ts',
      `export const a = 'a';
export function b() {}
export class C {}
export type D = 'd';
export interface E {}`,
    );
    fileService.set(
      '/app/d.ts',
      `export const a = 'a';
export function b() {}
export class C {}
export type D = 'd';
export interface E {}`,
    );
    fileService.set(
      '/app/e.ts',
      `export const a = 'a';
export function b() {}
export class C {}
export type D = 'd';
export interface E {}`,
    );

    removeUnusedFile({
      languageService,
      fileService,
      targetFile: [
        '/app/a.ts',
        '/app/b.ts',
        '/app/c.ts',
        '/app/d.ts',
        '/app/e.ts',
      ],
    });

    assert.equal(fileService.exists('/app/a.ts'), true);
    assert.equal(fileService.exists('/app/b.ts'), true);
    assert.equal(fileService.exists('/app/c.ts'), true);
    assert.equal(fileService.exists('/app/d.ts'), true);
    assert.equal(fileService.exists('/app/e.ts'), true);
  });

  it('should remove file if all exports are not used', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
export function b() {}
export class C {}
export type D = 'd';
export interface E {}`,
    );
    removeUnusedFile({
      languageService,
      fileService,
      targetFile: '/app/a.ts',
    });

    assert.equal(fileService.exists('/app/a.ts'), false);
  });
});

describe('removeExport', () => {
  describe('variable statement', () => {
    it('should not remove export for variable if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result.trim(), `export const a = 'a';`);
    });

    it('should remove export for variable if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/b.ts', `export const b = 'b';`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/b.ts',
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result.trim(), `const b = 'b';`);
    });

    it('should not remove export for variable if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export const b = 'b';`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result.trim(),
        `// ts-remove-unused-skip
  export const b = 'b';`,
      );
    });
  });

  describe('function declaration', () => {
    it('should not remove export for function if its used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
import b from './b';
import c from './c';`,
      );
      fileService.set('/app/a.ts', `export function a() {}`);
      fileService.set('/app/b.ts', `export default function b() {}`);
      fileService.set('/app/c.ts', `export default function() {}`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export function a() {}`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `export default function b() {}`,
      );
      assert.equal(
        fileService.get('/app/c.ts').trim(),
        `export default function() {}`,
      );
    });

    it('should remove export for function if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/a.ts', `export function a() {}`);
      fileService.set('/app/b.ts', `export default function b() {}`);
      fileService.set('/app/c.ts', `export default function() {}`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts'],
      });

      assert.equal(fileService.get('/app/a.ts').trim(), `function a() {}`);
      assert.equal(fileService.get('/app/b.ts').trim(), `function b() {}`);
      assert.equal(fileService.get('/app/c.ts').trim(), '');
    });

    it('should not remove export if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export function b() {}`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result.trim(),
        `// ts-remove-unused-skip
  export function b() {}`,
      );
    });
  });

  describe('class declaration', () => {
    it('should not remove export for function if its used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
import B from './b';
import C from './c';`,
      );
      fileService.set('/app/a.ts', `export class A {}`);
      fileService.set('/app/b.ts', `export default class B {}`);
      fileService.set('/app/c.ts', `export default class {}`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts'],
      });

      assert.equal(fileService.get('/app/a.ts').trim(), `export class A {}`);
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `export default class B {}`,
      );
      assert.equal(
        fileService.get('/app/c.ts').trim(),
        `export default class {}`,
      );
    });

    it('should remove export for function if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/a.ts', `export class A {}`);
      fileService.set('/app/b.ts', `export default class B {}`);
      fileService.set('/app/c.ts', `export default class {}`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts'],
      });

      assert.equal(fileService.get('/app/a.ts').trim(), `class A {}`);
      assert.equal(fileService.get('/app/b.ts').trim(), `class B {}`);
      assert.equal(fileService.get('/app/c.ts').trim(), '');
    });

    it('should not remove export if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export class A {}`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result.trim(),
        `// ts-remove-unused-skip
  export class A {}`,
      );
    });
  });

  describe('interface declaration', () => {
    it('should not remove export for interface if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
import B from './b';`,
      );
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);
      fileService.set('/app/b.ts', `export default interface B { b: 'b' }`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export interface A { a: 'a' }`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `export default interface B { b: 'b' }`,
      );
    });

    it('should remove export for interface if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);
      fileService.set('/app/b.ts', `export default interface B { b: 'b' }`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `interface A { a: 'a' }`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `interface B { b: 'b' }`,
      );
    });

    it('should not remove export if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export interface A { a: 'a' }`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result.trim(),
        `// ts-remove-unused-skip
  export interface A { a: 'a' }`,
      );
    });
  });

  describe('type alias declaration', () => {
    it('should not remove export for type if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { A } from './a';`);
      fileService.set('/app/a.ts', `export type A = 'a';`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result.trim(), `export type A = 'a';`);
    });

    it('should remove export for type if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/b.ts', `export type B = 'b';`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/b.ts',
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result.trim(), `type B = 'b';`);
    });

    it('should not remove export for type if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export type B = 'b';`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result.trim(),
        `// ts-remove-unused-skip
  export type B = 'b';`,
      );
    });
  });

  describe('default export of identifier', () => {
    it('should not remove default export for an identifier if its used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/main.ts',
        `import a from './a';
import B from './b';`,
      );

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export default a;`,
      );
      fileService.set(
        '/app/b.ts',
        `type B = 'b';
export default B;`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `const a = 'a';
  export default a;`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `type B = 'b';
export default B;`,
      );
    });

    it('should remove default export for an identifier if its not used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export default a;`,
      );
      fileService.set(
        '/app/b.ts',
        `type B = 'b';
export default B;`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts'],
      });

      assert.equal(fileService.get('/app/a.ts').trim(), `const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts').trim(), `type B = 'b';`);
    });

    it('should not remove default export for an identifier if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  // ts-remove-unused-skip
  export default a;`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result.trim(),
        `const a = 'a';
  // ts-remove-unused-skip
  export default a;`,
      );
    });
  });

  describe('default export of literal', () => {
    it('should not remove default export for a literal if its used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set('/app/main.ts', `import a from './a';`);

      fileService.set('/app/a.ts', `export default 'a';`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result.trim(), `export default 'a';`);
    });

    it('should remove default export for a literal if its not used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set('/app/a.ts', `export default a;`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result.trim(), '');
    });

    it('should not remove default export for a literal if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export default 'a';`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result.trim(),
        `// ts-remove-unused-skip
  export default 'a';`,
      );
    });
  });

  describe('export specifier', () => {
    it('should not remove export specifier for an identifier if its used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
import { B } from './b';`,
      );

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export { a };`,
      );
      fileService.set(
        '/app/b.ts',
        `type B = 'b';
export { B };`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `const a = 'a';
  export { a };`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `type B = 'b';
export { B };`,
      );
    });

    it('should remove export specifier for an identifier if its not used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export { a };`,
      );
      fileService.set(
        '/app/b.ts',
        `type B = 'b';
export { B };`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `const a = 'a';
  export {  };`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `type B = 'b';
export {  };`,
      );
    });

    it('should not remove export specifier for an identifier if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export { 
    // ts-remove-unused-skip
    a
  };`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result.trim(),
        `const a = 'a';
  export { 
    // ts-remove-unused-skip
    a
  };`,
      );
    });
  });
});
