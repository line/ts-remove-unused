import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processFile, removeUnusedExport } from './removeUnusedExport.js';
import { MemoryFileService } from './MemoryFileService.js';
import { WorkerPool } from './WorkerPool.js';

describe('removeUnusedExport', () => {
  let pool: WorkerPool<typeof processFile>;
  const recursive = true;

  before(() => {
    pool = new WorkerPool({
      name: 'processFile',
      url: new URL('../../dist/worker.js', import.meta.url).href,
    });
  });

  after(async () => {
    await pool.close();
  });

  describe('variable statement', () => {
    it('should not remove export for variable if its used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export const a = 'a';`);
    });

    it('should remove export for variable if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/b.ts', `export const b = 'b';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result, `const b = 'b';`);
    });

    it('should not remove export for variable if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export const b = 'b';`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// ts-remove-unused-skip
  export const b = 'b';`,
      );
    });
  });

  describe('function declaration', () => {
    it('should not remove export for function if its used in some other file', async () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
import b from './b';
import c from './c';`,
      );
      fileService.set('/app/a.ts', `export function a() {}`);
      fileService.set('/app/b.ts', `export default function b() {}`);
      fileService.set('/app/c.ts', `export default function() {}`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export function a() {}`);
      assert.equal(
        fileService.get('/app/b.ts'),
        `export default function b() {}`,
      );
      assert.equal(
        fileService.get('/app/c.ts'),
        `export default function() {}`,
      );
    });

    it('should remove export for function if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export function a() {}`);
      fileService.set('/app/b.ts', `export default function b() {}`);
      fileService.set('/app/c.ts', `export default function() {}`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `function a() {}`);
      assert.equal(fileService.get('/app/b.ts'), `function b() {}`);
      assert.equal(fileService.get('/app/c.ts'), '');
    });

    it('should not remove async keyword of function if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a2 } from './a';`);
      fileService.set(
        '/app/a.ts',
        `export async function a() {}
export function a2() {
  a();
}`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `async function a() {}
export function a2() {
  a();
}`,
      );
    });

    it('should remove default async function if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
import { b } from './b';`,
      );
      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export default async function a2() {}`,
      );
      fileService.set(
        '/app/b.ts',
        `export const b = 'b';
export default async function() {}`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      // async function will be removed afterwards with codeFix
      assert.equal(
        fileService.get('/app/a.ts'),
        `export const a = 'a';
async function a2() {}`,
      );
      assert.equal(fileService.get('/app/b.ts'), `export const b = 'b';`);
    });

    it('should not remove export if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export function b() {}`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// ts-remove-unused-skip
  export function b() {}`,
      );
    });
  });

  describe('class declaration', () => {
    it('should not remove export for function if its used in some other file', async () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
import B from './b';
import C from './c';`,
      );
      fileService.set('/app/a.ts', `export class A {}`);
      fileService.set('/app/b.ts', `export default class B {}`);
      fileService.set('/app/c.ts', `export default class {}`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export class A {}`);
      assert.equal(fileService.get('/app/b.ts'), `export default class B {}`);
      assert.equal(fileService.get('/app/c.ts'), `export default class {}`);
    });

    it('should remove export for function if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export class A {}`);
      fileService.set('/app/b.ts', `export default class B {}`);
      fileService.set('/app/c.ts', `export default class {}`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `class A {}`);
      assert.equal(fileService.get('/app/b.ts'), `class B {}`);
      assert.equal(fileService.get('/app/c.ts'), '');
    });

    it('should not remove export if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export class A {}`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// ts-remove-unused-skip
  export class A {}`,
      );
    });
  });

  describe('interface declaration', () => {
    it('should not remove export for interface if its used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
import B from './b';`,
      );
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);
      fileService.set('/app/b.ts', `export default interface B { b: 'b' }`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `export interface A { a: 'a' }`,
      );
      assert.equal(
        fileService.get('/app/b.ts'),
        `export default interface B { b: 'b' }`,
      );
    });

    it('should remove export for interface if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);
      fileService.set('/app/b.ts', `export default interface B { b: 'b' }`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `interface A { a: 'a' }`);
      assert.equal(fileService.get('/app/b.ts'), `interface B { b: 'b' }`);
    });

    it('should not remove export if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export interface A { a: 'a' }`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// ts-remove-unused-skip
  export interface A { a: 'a' }`,
      );
    });
  });

  describe('type alias declaration', () => {
    it('should not remove export for type if its used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { A } from './a';`);
      fileService.set('/app/a.ts', `export type A = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export type A = 'a';`);
    });

    it('should remove export for type if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/b.ts', `export type B = 'b';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result, `type B = 'b';`);
    });

    it('should not remove export for type if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export type B = 'b';`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// ts-remove-unused-skip
  export type B = 'b';`,
      );
    });
  });

  describe('default export of identifier', () => {
    it('should not remove default export for an identifier if its used in some other file', async () => {
      const fileService = new MemoryFileService();

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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `const a = 'a';
  export default a;`,
      );
      assert.equal(
        fileService.get('/app/b.ts'),
        `type B = 'b';
export default B;`,
      );
    });

    it('should remove default export for an identifier if its not used in some other file', async () => {
      const fileService = new MemoryFileService();

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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts'), `type B = 'b';`);
    });

    it('should not remove default export for an identifier if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  // ts-remove-unused-skip
  export default a;`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result,
        `const a = 'a';
  // ts-remove-unused-skip
  export default a;`,
      );
    });
  });

  describe('default export of literal', () => {
    it('should not remove default export for a literal if its used in some other file', async () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import a from './a';`);

      fileService.set('/app/a.ts', `export default 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export default 'a';`);
    });

    it('should remove default export for a literal if its not used in some other file', async () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/a.ts', `export default a;`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, '');
    });

    it('should not remove default export for a literal if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export default 'a';`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result,
        `// ts-remove-unused-skip
  export default 'a';`,
      );
    });
  });

  describe('export specifier', () => {
    it('should not remove export specifier for an identifier if its used in some other file', async () => {
      const fileService = new MemoryFileService();

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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `const a = 'a';
  export { a };`,
      );
      assert.equal(
        fileService.get('/app/b.ts'),
        `type B = 'b';
export { B };`,
      );
    });

    it('should remove export specifier for an identifier if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts'), `type B = 'b';`);
      assert.equal(
        fileService.get('/app/c.ts'),
        `const c = 'c';
const remain = 'remain';
export { remain };`,
      );

      assert.equal(
        fileService.get('/app/d.ts'),
        `const d = 'd';
const unused = 'unused';
const unused2 = 'unused2';
export { d };`,
      );
    });

    it('should not remove export specifier for an identifier if it has a comment to ignore', async () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export { 
    // ts-remove-unused-skip
    a
  };`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result,
        `const a = 'a';
  export { 
    // ts-remove-unused-skip
    a
  };`,
      );
    });
  });

  describe('re-exports', () => {
    it('should not remove re-export if its used in some other file', async () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a_reexport.ts'),
        `export { a } from './a';`,
      );
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should remove re-export if its not used in some other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a_reexport.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // removal of /app/a.ts depends on the order of how the target files are passed, so the result of /app/a.ts is not guaranteed
      assert.equal(fileService.get('/app/a_reexport.ts'), '');
    });

    it('should remove specifier if some re-exported specifier is not used in any other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { b1 } from './b_reexport'`);
      fileService.set('/app/b_reexport.ts', `export { b1, b2 } from './b';`);
      fileService.set(
        '/app/b.ts',
        `export const b1 = 'b1'; export const b2 = 'b2';`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // todo: is it possible to specify typescript to use single quotes?
      assert.equal(
        fileService.get('/app/b_reexport.ts'),
        `export { b1 } from "./b";`,
      );
    });

    it('should remove nth re-export if its not used in any other file', async () => {
      const fileService = new MemoryFileService();
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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a_reexport_1.ts'), '');
    });
  });

  describe('whole re-export', () => {
    it('should remove declaration that not used in some other file via a whole-reexport', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);
      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      // todo: removing whole re-export is not supported yet
      // assert.equal(fileService.get('/app/a_reexport.ts'), '');
      assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
    });

    it('should not remove declaration that is used with `import * as name` in some other file via a whole-reexport', async () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/main.ts',
        `import * as a_namespace from './a_reexport';
a_namespace.a;`,
      );
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      assert.equal(
        fileService.get('/app/a_reexport.ts'),
        `export * from './a';`,
      );
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should not remove declaration that is used named imported in some other file via a whole-reexport', async () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      assert.equal(
        fileService.get('/app/a_reexport.ts'),
        `export * from './a';`,
      );
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should not remove declaration that is used in default import in some other file via a whole-reexport', async () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import a from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export default 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      assert.equal(
        fileService.get('/app/a_reexport.ts'),
        `export * from './a';`,
      );
      assert.equal(fileService.get('/app/a.ts'), `export default 'a';`);
    });
  });

  describe('locally used declaration but not used in any other file', () => {
    it('should remove export keyword of variable if its not used in any other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export const b = 'b';
console.log(b);`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `export const a = 'a';
const b = 'b';
console.log(b);`,
      );
    });

    it('should remove export keyword of class declaration if its not used in any other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export class B {}
console.log(B);`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `export const a = 'a';
class B {}
console.log(B);`,
      );
    });

    it('should remove export keyword of interface declaration if its not used in any other file', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export interface B {}
const b: B = {};`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `export const a = 'a';
interface B {}
const b: B = {};`,
      );
    });
  });

  describe('dynamic import', () => {
    it('should not remove export if its used in dynamic import', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import('./a.js');
import('./b.js');`,
      );
      fileService.set('/app/a.ts', `export const a = 'a';`);
      fileService.set('/app/b.ts', `export default 'b';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts'), `export default 'b';`);
    });
  });

  describe('deleteUnusedFile is false', () => {
    describe('when the export is in a file that is not reachable from the entrypoint', () => {
      it('should not remove export if its used in some other file', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);
        fileService.set('/app/b.ts', `import { a } from './a';`);

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      });

      it('should correctly remove export if its not used', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
      });
    });

    describe("when the export is in a file that's reachable from the entrypoint", () => {
      it('should not remove export if its used in some other file', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set('/app/a.ts', `export const a = 'a';`);

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      });

      it('should correctly remove export if its not used', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `export const a = 'a';
export const a2 = 'a2';`,
        );

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `export const a = 'a';
const a2 = 'a2';`,
        );
      });
    });
  });

  describe('deleteUnusedFile is true', () => {
    it('should not remove file if some exports are used in other files', async () => {
      const fileService = new MemoryFileService();
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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), true);
      assert.equal(fileService.exists('/app/c.ts'), true);
      assert.equal(fileService.exists('/app/d.ts'), true);
      assert.equal(fileService.exists('/app/e.ts'), true);
    });

    it('should remove file if all exports are not used', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
  export function b() {}
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), false);
    });

    it('should not remove re-exports of all exports file if its used', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a_reexport.ts'), true);
    });

    it('should remove re-exports of all exports file if its not used', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a_reexport.ts'), false);
    });

    it('should not remove file if some exports are marked with skip comment', async () => {
      const fileService = new MemoryFileService();
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

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), true);
      assert.equal(fileService.exists('/app/c.ts'), true);
      assert.equal(fileService.exists('/app/d.ts'), true);
      assert.equal(fileService.exists('/app/e.ts'), true);
    });

    it('should remove files that are not connected to the graph that starts from entrypoints', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = () => 'a';`);
      fileService.set('/app/b.ts', `import { c } from './c';`);
      fileService.set('/app/c.ts', `export const c = 'c';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), false);
      assert.equal(fileService.exists('/app/c.ts'), false);
    });

    it('should remove files that are unreachable from entrypoints', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set(
        '/app/a.ts',
        `import { b } from './b';
export const a = () => b;`,
      );
      fileService.set('/app/b.ts', `export const b = 'b';`);
      fileService.set(
        '/app/c.ts',
        `import { b } from './b';
export const c = () => b;`,
      );
      fileService.set('/app/d.ts', `import { c } from './c';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });
      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), true);
      assert.equal(fileService.exists('/app/c.ts'), false);
      assert.equal(fileService.exists('/app/d.ts'), false);
    });

    describe('when the export is in a file that is not reachable from the entrypoint', () => {
      it('should remove all files that are not reachable no matter if they form another dependency graph', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);
        fileService.set('/app/b.ts', `import { a } from './a';`);

        // we have another set of files to make sure that it works regardless of the order of the files
        fileService.set('/app/c.ts', `import { d } from './d';`);
        fileService.set('/app/d.ts', `export const d = 'd';`);

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(fileService.exists('/app/a.ts'), false);
        assert.equal(fileService.exists('/app/b.ts'), false);
        assert.equal(fileService.exists('/app/c.ts'), false);
        assert.equal(fileService.exists('/app/d.ts'), false);
      });

      it('should remove files that do not form another dependency graph', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(fileService.exists('/app/a.ts'), false);
      });

      it('should not remove files that have a comment to skip', async () => {
        const fileService = new MemoryFileService();
        fileService.set(
          '/app/a.ts',
          `// ts-remove-unused-skip
export const a = 'a';`,
        );

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `// ts-remove-unused-skip
export const a = 'a';`,
        );
      });
    });

    describe("when the export is in a file that's reachable from the entrypoint", () => {
      it('should not remove export if its used in some other file', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set('/app/a.ts', `export const a = 'a';`);

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      });

      it('should correctly remove export if its not used', async () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `export const a = 'a';
  export const a2 = 'a2';`,
        );

        await removeUnusedExport({
          fileService,
          pool,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `export const a = 'a';
  const a2 = 'a2';`,
        );
      });
    });
  });

  describe('enableCodeFix', () => {
    it('should apply code fix when enableCodeFix is true', async () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import { remain } from './a';`);
      fileService.set(
        '/app/a.ts',
        `const dep = 'dep';
export const a = () => dep;
export const remain = 'remain';`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        enableCodeFix: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `export const remain = 'remain';`,
      );
    });
  });

  describe('complex scenarios', () => {
    it('should recursively remove files', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a2 } from './a';`);
      fileService.set(
        '/app/a.ts',
        `import { b } from './b';
export const a = () => b;
export const a2 = 'a2';`,
      );
      fileService.set(
        '/app/b.ts',
        `import { c } from './c';
export const b = () => c;`,
      );
      fileService.set('/app/c.ts', `export const c = 'c';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });
      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), false);
      assert.equal(fileService.exists('/app/c.ts'), false);
    });

    it('should correctly handle files that rely on files that are part of the dependency graph but are not reachable from the entrypoint', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export const a2 = 'a2';`,
      );
      fileService.set('/app/b.ts', `import { a2 } from './a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';\n`);
      assert.equal(fileService.exists('/app/b.ts'), false);
    });

    it('should not remove exports that are not reachable from the entrypoint but is used in some file marked with skip', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `import { b } from './b';
// ts-remove-unused-skip
export const a = () => b;`,
      );
      fileService.set('/app/b.ts', `export const b = 'b';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `import { b } from './b';
// ts-remove-unused-skip
export const a = () => b;`,
      );
      assert.equal(fileService.get('/app/b.ts'), `export const b = 'b';`);
    });

    it('should keep the entrypoint files untouched', async () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
export const d = 'd';
export const main = 'main';`,
      );
      fileService.set(
        '/app/a.ts',
        `import { d } from './main';
export const a = () => d;
export const a2 = 'a2';`,
      );

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(
        fileService.get('/app/main.ts'),
        `import { a } from './a';
export const d = 'd';
export const main = 'main';`,
      );
      assert.equal(
        fileService.get('/app/a.ts'),
        `import { d } from './main';
export const a = () => d;\n`,
      );
    });

    it('should not delete dynamically imported files', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import('./a');`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
    });

    it('should not delete files when then entrypoint is a reexport', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/main.ts'), true);
    });

    it('should not delete files when the entrypoint is a whole reexport', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/main.ts'), true);
    });

    it('should not delete files when the entrypoint is a whole reexport and is the reexported multiple times', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export * from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/main.ts'), true);
      assert.equal(fileService.exists('/app/a_reexport.ts'), true);
    });

    it('should remove whole reexport if the specifier file is deleted', async () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { b } from './b';`);
      fileService.set('/app/b.ts', `export * from './a';export const b = 'b';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      await removeUnusedExport({
        fileService,
        pool,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), false);
      assert.equal(fileService.get('/app/b.ts'), `export const b = 'b';`);
    });
  });
});
