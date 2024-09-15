import { describe, it } from 'node:test';
import { MemoryFileService } from './MemoryFileService.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { removeUnusedExport } from './removeUnusedExport.js';

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

describe('removeUnusedExport', () => {
  describe('variable statement', () => {
    it('should not remove export for variable if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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

      removeUnusedExport({
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
        '/app/main.ts',
        `import { remain } from './c';
import { d } from './d';`,
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
      fileService.set(
        '/app/c.ts',
        `const c = 'c';
const remain = 'remain';
export { c, remain };`,
      );

      fileService.set(
        '/app/d.ts',
        `const d = 'd';
const unused = 'unused';
const unused2 = 'unused2';
export { d, unused, unused2 };`,
      );

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts', '/app/d.ts'],
      });

      assert.equal(fileService.get('/app/a.ts').trim(), `const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts').trim(), `type B = 'b';`);
      assert.equal(
        fileService.get('/app/c.ts').trim(),
        `const c = 'c';
const remain = 'remain';
export { remain };`,
      );

      assert.equal(
        fileService.get('/app/d.ts').trim(),
        `const d = 'd';
const unused = 'unused';
const unused2 = 'unused2';
export { d };`,
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

      removeUnusedExport({
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

  describe('re-exports', () => {
    it('should not remove re-export if its used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/a_reexport.ts'],
      });

      assert.equal(
        fileService.get('/app/a_reexport.ts').trim(),
        `export { a } from './a';`,
      );
      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export const a = 'a';`,
      );
    });

    it('should remove re-export if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/a_reexport.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/a_reexport.ts'],
      });

      // removal of /app/a.ts depends on the order of how the target files are passed, so the result of /app/a.ts is not guaranteed
      assert.equal(fileService.get('/app/a_reexport.ts').trim(), '');
    });

    it('should remove specifier if some re-exported specifier is not used in any other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { b1 } from './b_reexport'`);
      fileService.set('/app/b_reexport.ts', `export { b1, b2 } from './b';`);
      fileService.set(
        '/app/b.ts',
        `export const b1 = 'b1'; export const b2 = 'b2';`,
      );

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: ['/app/b.ts', '/app/b_reexport.ts'],
      });

      // todo: is it possible to specify typescript to use single quotes?
      assert.equal(
        fileService.get('/app/b_reexport.ts').trim(),
        `export { b1 } from "./b";`,
      );
    });
  });

  it('should remove nth re-export if its not used in any other file', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/a_reexport_1.ts',
      `export { a } from './a_reexport_2';`,
    );
    fileService.set(
      '/app/a_reexport_2.ts',
      `export { a } from './a_reexport_3';`,
    );
    fileService.set('/app/a_reexport_3.ts', `export { a } from './a';`);
    fileService.set('/app/a.ts', `export const a = 'a';`);

    removeUnusedExport({
      languageService,
      fileService,
      targetFile: [
        '/app/a.ts',
        '/app/a_reexport_1.ts',
        '/app/a_reexport_2.ts',
        '/app/a_reexport_3.ts',
      ],
    });

    assert.equal(fileService.get('/app/a_reexport_1.ts').trim(), '');
  });

  describe('locally used declaration but not used in any other file', () => {
    it('should remove export keyword of variable if its not used in any other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export const b = 'b';
console.log(b);`,
      );

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export const a = 'a';
const b = 'b';
console.log(b);`,
      );
    });

    it('should remove export keyword of class declaration if its not used in any other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export class B {}
console.log(B);`,
      );

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export const a = 'a';
class B {}
console.log(B);`,
      );
    });

    it('should remove export keyword of interface declaration if its not used in any other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export interface B {}
const b: B = {};`,
      );

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export const a = 'a';
interface B {}
const b: B = {};`,
      );
    });
  });

  it('should remove export keyword of type alias declaration if its not used in any other file', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a';`);

    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
export type B = 'b';
const b: B = 'b';`,
    );

    removeUnusedExport({
      languageService,
      fileService,
      targetFile: '/app/a.ts',
    });

    assert.equal(
      fileService.get('/app/a.ts').trim(),
      `export const a = 'a';
type B = 'b';
const b: B = 'b';`,
    );
  });

  it('should remove export keyword of interface declaration if its not used in any other file', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a';`);

    fileService.set(
      '/app/a.ts',
      `export const a = 'a';
export interface B {}
const b: B = {};`,
    );

    removeUnusedExport({
      languageService,
      fileService,
      targetFile: '/app/a.ts',
    });

    assert.equal(
      fileService.get('/app/a.ts').trim(),
      `export const a = 'a';
interface B {}
const b: B = {};`,
    );
  });

  describe('deleteUnusedFile', () => {
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

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: [
          '/app/a.ts',
          '/app/b.ts',
          '/app/c.ts',
          '/app/d.ts',
          '/app/e.ts',
        ],
        deleteUnusedFile: true,
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
      removeUnusedExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), false);
    });

    it('should not remove file if some exports are marked with skip comment', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export const a = 'a';
  export function b() {}
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/b.ts',
        `export const a = 'a';
  // ts-remove-unused-skip
  export function b() {}
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/c.ts',
        `export const a = 'a';
  export function b() {}
  // ts-remove-unused-skip
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/d.ts',
        `export const a = 'a';
  export function b() {}
  export class C {}
  // ts-remove-unused-skip
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/e.ts',
        `export const a = 'a';
  export function b() {}
  export class C {}
  export type D = 'd';
  // ts-remove-unused-skip
  export interface E {}`,
      );

      removeUnusedExport({
        languageService,
        fileService,
        targetFile: [
          '/app/a.ts',
          '/app/b.ts',
          '/app/c.ts',
          '/app/d.ts',
          '/app/e.ts',
        ],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), true);
      assert.equal(fileService.exists('/app/c.ts'), true);
      assert.equal(fileService.exists('/app/d.ts'), true);
      assert.equal(fileService.exists('/app/e.ts'), true);
    });
  });

  describe('enableCodeFix', () => {
    const { languageService, fileService } = setup();

    fileService.set('/app/main.ts', `import { remain } from './a';`);
    fileService.set(
      '/app/a.ts',
      `const dep = 'dep';
export const a = () => dep;
export const remain = 'remain';`,
    );

    removeUnusedExport({
      languageService,
      fileService,
      targetFile: '/app/a.ts',
      enableCodeFix: true,
    });

    assert.equal(
      fileService.get('/app/a.ts').trim(),
      `export const remain = 'remain';`,
    );
  });
});
