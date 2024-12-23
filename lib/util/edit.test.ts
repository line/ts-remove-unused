import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { edit } from './edit.js';
import { MemoryFileService } from './MemoryFileService.js';

describe('edit', () => {
  const recursive = true;

  describe('variable statement', () => {
    it('should not remove export for variable if its used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export const a = 'a';`);
    });

    it('should remove export for variable if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/b.ts', `export const b = 'b';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result, `const b = 'b';`);
    });

    it('should not remove export for variable if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export const b = 'b';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// tsr-skip
  export const b = 'b';`,
      );
    });

    describe('multiple variables', () => {
      it('should not remove export for multiple variables if its used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a, a2 } from './a';`);
        fileService.set('/app/a.ts', `export const a = 'a', a2 = 'a2';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        const result = fileService.get('/app/a.ts');
        assert.equal(result, `export const a = 'a', a2 = 'a2';`);
      });

      it('should not remove export for multiple variables if some are used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set('/app/a.ts', `export const a = 'a', a2 = 'a2';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        const result = fileService.get('/app/a.ts');
        assert.equal(result, `export const a = 'a', a2 = 'a2';`);
      });

      it('should remove export for multiple variables if all are not used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/b.ts', `export const b = 'b', b2 = 'b2';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        const result = fileService.get('/app/b.ts');

        assert.equal(result, `const b = 'b', b2 = 'b2';`);
      });
    });

    describe('destructuring', () => {
      it('should not remove export for destructuring variable if its used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set('/app/a.ts', `export const { a } = { a: 'a' };`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        const result = fileService.get('/app/a.ts');
        assert.equal(result, `export const { a } = { a: 'a' };`);
      });

      it('should not remove export for destructuring variable if some are used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `export const { a, b } = { a: 'a', b: 'b' };`,
        );

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        const result = fileService.get('/app/a.ts');
        assert.equal(result, `export const { a, b } = { a: 'a', b: 'b' };`);
      });

      it('should remove export for destructuring variable if its not used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/b.ts', `export const { b } = { b: 'b' };`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        const result = fileService.get('/app/b.ts');

        assert.equal(result, `const { b } = { b: 'b' };`);
      });
    });
  });

  describe('function declaration', () => {
    it('should not remove export for function if its used in some other file', () => {
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

      edit({
        fileService,
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

    it('should remove export for function if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export function a() {}`);
      fileService.set('/app/b.ts', `export default function b() {}`);
      fileService.set('/app/c.ts', `export default function() {}`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `function a() {}`);
      assert.equal(fileService.get('/app/b.ts'), `function b() {}`);
      assert.equal(fileService.get('/app/c.ts'), '');
    });

    it('should not remove keyword of function if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a2 } from './a';`);
      fileService.set(
        '/app/a.ts',
        `export function a() {}
export function a2() {
  a();
}`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `function a() {}
export function a2() {
  a();
}`,
      );
    });

    it('should remove default function if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
import { b } from './b';`,
      );
      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export default function a2() {}`,
      );
      fileService.set(
        '/app/b.ts',
        `export const b = 'b';
export default function() {}`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      // function will be removed afterwards with codeFix
      assert.equal(
        fileService.get('/app/a.ts'),
        `export const a = 'a';
function a2() {}`,
      );
      assert.equal(fileService.get('/app/b.ts'), `export const b = 'b';`);
    });

    it('should not remove export if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export function b() {}`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// tsr-skip
  export function b() {}`,
      );
    });
  });

  describe('class declaration', () => {
    it('should not remove decorators when exports are deleted', () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', ``);
      fileService.set(
        '/app/a.ts',
        `@myDecorator
export class A {}`,
      );
      fileService.set(
        '/app/b.ts',
        `@myDecorator
export default class B {}`,
      );
      fileService.set(
        '/app/c.ts',
        `@firstDecorator
@secondDecorator(() => [WithArgument])
export default class C {}`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `@myDecorator
class A {}`,
      );

      assert.equal(
        fileService.get('/app/b.ts'),
        `@myDecorator
class B {}`,
      );

      assert.equal(
        fileService.get('/app/c.ts'),
        `@firstDecorator
@secondDecorator(() => [WithArgument])
class C {}`,
      );
    });

    it('should not remove export for class if its used in some other file', () => {
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

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export class A {}`);
      assert.equal(fileService.get('/app/b.ts'), `export default class B {}`);
      assert.equal(fileService.get('/app/c.ts'), `export default class {}`);
    });

    it('should remove export for class if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export class A {}`);
      fileService.set('/app/b.ts', `export default class B {}`);
      fileService.set('/app/c.ts', `export default class {}`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `class A {}`);
      assert.equal(fileService.get('/app/b.ts'), `class B {}`);
      assert.equal(fileService.get('/app/c.ts'), '');
    });

    it('should not remove export if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export class A {}`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// tsr-skip
  export class A {}`,
      );
    });
  });

  describe('interface declaration', () => {
    it('should not remove export for interface if its used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
import B from './b';`,
      );
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);
      fileService.set('/app/b.ts', `export default interface B { b: 'b' }`);

      edit({
        fileService,
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

    it('should remove export for interface if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);
      fileService.set('/app/b.ts', `export default interface B { b: 'b' }`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `interface A { a: 'a' }`);
      assert.equal(fileService.get('/app/b.ts'), `interface B { b: 'b' }`);
    });

    it('should not remove export if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export interface A { a: 'a' }`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// tsr-skip
  export interface A { a: 'a' }`,
      );
    });
  });

  describe('type alias declaration', () => {
    it('should not remove export for type if its used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { A } from './a';`);
      fileService.set('/app/a.ts', `export type A = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export type A = 'a';`);
    });

    it('should remove export for type if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/b.ts', `export type B = 'b';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result, `type B = 'b';`);
    });

    it('should not remove export for type if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export type B = 'b';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');

      assert.equal(
        result,
        `// tsr-skip
  export type B = 'b';`,
      );
    });
  });

  describe('enum declaration', () => {
    it('should not remove export for enum if its used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { A } from './a';`);
      fileService.set('/app/a.ts', `export enum A { A1 }`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export enum A { A1 }`);
    });

    it('should remove export for enum if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/b.ts', `export enum B { B1 }`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result, `enum B { B1 }`);
    });

    it("should not remove const keyword of enum if it's not used in some other file", () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/b.ts', `export const enum B { B1 }`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result, `const enum B { B1 }`);
    });

    it('should not remove export for enum if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/b.ts',
        `// tsr-skip
  export enum B { B1 }`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(
        result,
        `// tsr-skip
  export enum B { B1 }`,
      );
    });
  });

  describe('default export of identifier', () => {
    it('should not remove default export for an identifier if its used in some other file', () => {
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

      edit({
        fileService,
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

    it('should remove default export for an identifier if its not used in some other file', () => {
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

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts'), `type B = 'b';`);
    });

    it('should not remove default export for an identifier if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  // tsr-skip
  export default a;`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result,
        `const a = 'a';
  // tsr-skip
  export default a;`,
      );
    });
  });

  describe('default export of literal', () => {
    it('should not remove default export for a literal if its used in some other file', () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import a from './a';`);

      fileService.set('/app/a.ts', `export default 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, `export default 'a';`);
    });

    it('should remove default export for a literal if its not used in some other file', () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/a.ts', `export default a;`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result, '');
    });

    it('should not remove default export for a literal if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export default 'a';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result,
        `// tsr-skip
  export default 'a';`,
      );
    });
  });

  describe('export declaration', () => {
    it('should not remove specifier of export declaration if its used in some other file', () => {
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

      edit({
        fileService,
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

    it('should remove specifier for export declaration if its not used in some other file', () => {
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

      edit({
        fileService,
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

    it('should not remove specifier for export declaration if it has a comment to ignore', () => {
      const fileService = new MemoryFileService();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
// tsr-skip
export { 
  a
};`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(
        result,
        `const a = 'a';
// tsr-skip
export { 
  a
};`,
      );
    });

    describe('preserving the format when editing a export declaration', () => {
      it('should preserve the line break when there is a comment leading the export declaration', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `const a = 'a';
const b = 'b';
// comment
export { a, b };`,
        );

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `const a = 'a';
const b = 'b';
// comment
export { a };`,
        );
      });

      it('should preserve line breaks leading the export declaration', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `const a = 'a';
const b = 'b';

export { a, b };`,
        );

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `const a = 'a';
const b = 'b';

export { a };`,
        );
      });

      it('should preserve the trailing comment when editing a export declaration', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `const a = 'a';
const b = 'b';
export { a, b }; // comment`,
        );

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `const a = 'a';
const b = 'b';
export { a }; // comment`,
        );
      });

      it('should preserve the trailing line break when editing a export declaration', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `const a = 'a';
const b = 'b';
export { a, b };

const c = 'c';`,
        );

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `const a = 'a';
const b = 'b';
export { a };

const c = 'c';`,
        );
      });
    });
  });

  describe('named export declaration with module specifier', () => {
    it('should not remove named export declaration if its used in some other file', () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a_reexport.ts'),
        `export { a } from './a';`,
      );
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should remove named export declaration if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a_reexport.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // removal of /app/a.ts depends on the order of how the target files are passed, so the result of /app/a.ts is not guaranteed
      assert.equal(fileService.get('/app/a_reexport.ts'), '');
    });

    it('should remove specifiers in named export declaration that are not used in any other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { b1 } from './b_reexport'`);
      fileService.set('/app/b_reexport.ts', `export { b1, b2 } from './b';`);
      fileService.set(
        '/app/b.ts',
        `export const b1 = 'b1'; export const b2 = 'b2';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // todo: is it possible to specify typescript to use single quotes?
      assert.equal(
        fileService.get('/app/b_reexport.ts'),
        `export { b1 } from "./b";`,
      );
    });

    it('should remove nth named export declaration if its not used in any other file', () => {
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

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a_reexport_1.ts'), '');
      assert.equal(fileService.get('/app/a_reexport_2.ts'), '');
      assert.equal(fileService.get('/app/a_reexport_3.ts'), '');
      assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
    });
  });

  describe('whole export declaration', () => {
    it('should remove whole export declaration that is not used', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);
      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      assert.equal(fileService.get('/app/a_reexport.ts'), '');
      assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
    });

    it('should not remove declaration that is used', () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });
      assert.equal(
        fileService.get('/app/a_reexport.ts'),
        `export * from './a';`,
      );
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should detect the whole module as usage when there is an whole-reexport in the entrypoint', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it.todo(
      'should correctly handle when there is a circular dependency with whole-reexport',
      () => {},
    );

    it('should delete the whole re-export if the destination file does not exist', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { b2 } from './b';`);
      fileService.set(
        '/app/b.ts',
        `export { b } from './a_reexport'; export const b2 = 'b2';`,
      );
      fileService.set(
        '/app/a_reexport.ts',
        `export * from './a';
export const b = 'b';`,
      );
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a_reexport.ts'), false);
      assert.equal(fileService.exists('/app/a.ts'), false);
    });

    it('should look for deeply nested whole re-export without removing files', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { c } from './a';`);
      fileService.set('/app/a.ts', `export * from './b';`);
      fileService.set('/app/b.ts', `export * from './c';`);
      fileService.set('/app/c.ts', `export const c = 'c';`);

      edit({
        fileService,
        recursive,
        deleteUnusedFile: true,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/main.ts'), `import { c } from './a';`);
      assert.equal(fileService.get('/app/a.ts'), `export * from './b';`);
      assert.equal(fileService.get('/app/b.ts'), `export * from './c';`);
      assert.equal(fileService.get('/app/c.ts'), `export const c = 'c';`);
    });
  });

  describe('namespace export declaration', () => {
    it('should not remove namespace export declaration if its used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export * as a from './b';`);
      fileService.set('/app/b.ts', `export const b = 'b';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export * as a from './b';`);
    });

    it('should remove namespace export declaration if its not used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export * as a from './b';`);
      fileService.set('/app/b.ts', `export const b = 'b';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), '');
    });
  });

  describe('ambient module declaration', () => {
    it('should not delete file with ambient module declaration', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `declare module 'a' {}`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.get('/app/a.ts'), `declare module 'a' {}`);
    });

    it('should not delete file with global scope augmentation', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `declare global {}\nexport {};`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `declare global {}\nexport {};`,
      );
    });

    it('should keep the empty export declaration as-is if the file has a ambient module declaration', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `declare module 'a' {}\nexport {};`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `declare module 'a' {}\nexport {};`,
      );
    });

    it('should not change external module augmentation to a non-augmentation', () => {
      const fileService = new MemoryFileService();
      // if the file is a external module, the ModuleDeclaration is an augmentation
      // after removing the export, the ModuleDeclaration should still be a module augmentation
      fileService.set(
        '/app/a.ts',
        `declare module 'a' {}\nexport const a = 'a';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `declare module 'a' {}

// auto-generated by tsr to preserve module declaration as augmentation
// this may not be necessary if an import statement exists
export {};\n`,
      );
    });

    it('should not add an empty export export declaration to a file with ambient module declaration if its already an external module', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set(
        '/app/a.ts',
        `declare module 'a' {};export const a = 'a';export const b = 'b';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `declare module 'a' {};export const a = 'a';`,
      );
    });
  });

  describe('named export declaration with no specifier', () => {
    it('should remove the export declaration if there are other exports in the file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export {};export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // even if we remove `export {};` the file is still an external module so it's unnecessary
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should remove the multiple export declarations if there are other exports in the file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export {};export const a = 'a';export {};`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // even if we remove `export {};` the file is still an external module so it's unnecessary
      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should not remove the export declaration if there are no other exports in the file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export {};`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // if we remove `export {};` the file will become a script file so it's necessary
      assert.equal(fileService.get('/app/a.ts'), `export {};`);
    });

    it('should preserve one export declaration if there are multiple export declarations and there are no other exports in the file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a.ts', `export {};export {};`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      // if we remove `export {};` the file will become a script file so it's necessary
      assert.equal(fileService.get('/app/a.ts'), `export {};`);
    });
  });

  describe('namespace import', () => {
    it('should not remove export for namespace import if its used in some other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import * as a from './a'; a.a;`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
    });

    it('should remove export used with namespace import even when some exports are used', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import * as a from './a'; a.a;`);
      fileService.set(
        '/app/a.ts',
        `export const a = 'a'; export const b = 'b';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `export const a = 'a'; const b = 'b';`,
      );
    });
  });

  describe('locally used declaration but not used in any other file', () => {
    it('should remove export keyword of variable if its not used in any other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export const b = 'b';
console.log(b);`,
      );

      edit({
        fileService,
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

    it('should remove export keyword of class declaration if its not used in any other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export class B {}
console.log(B);`,
      );

      edit({
        fileService,
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

    it('should remove export keyword of interface declaration if its not used in any other file', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);

      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export interface B {}
const b: B = {};`,
      );

      edit({
        fileService,
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
    it('should not remove export if its used in dynamic import', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/main.ts',
        `import('./a.js');
import('./b.js');`,
      );
      fileService.set('/app/a.ts', `export const a = 'a';`);
      fileService.set('/app/b.ts', `export default 'b';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      assert.equal(fileService.get('/app/b.ts'), `export default 'b';`);
    });
  });

  describe('deleteUnusedFile is false', () => {
    describe('when the export is in a file that is not reachable from the entrypoint', () => {
      it('should not remove export if its used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);
        fileService.set('/app/b.ts', `import { a } from './a';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      });

      it('should correctly remove export if its not used', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(fileService.get('/app/a.ts'), `const a = 'a';`);
      });
    });

    describe("when the export is in a file that's reachable from the entrypoint", () => {
      it('should not remove export if its used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set('/app/a.ts', `export const a = 'a';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
        });

        assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      });

      it('should correctly remove export if its not used', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `export const a = 'a';
export const a2 = 'a2';`,
        );

        edit({
          fileService,
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
    it('should not remove file if some exports are used in other files', () => {
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

      edit({
        fileService,
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

    it('should remove file if all exports are not used', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
  export function b() {}
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), false);
    });

    it('should not remove re-exports of all exports file if its used', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a_reexport.ts'), true);
    });

    it('should remove re-exports of all exports file if its not used', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a_reexport.ts'), false);
    });

    it('should not remove file if some exports are marked with skip comment', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// tsr-skip
  export const a = 'a';
  export function b() {}
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/b.ts',
        `export const a = 'a';
  // tsr-skip
  export function b() {}
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/c.ts',
        `export const a = 'a';
  export function b() {}
  // tsr-skip
  export class C {}
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/d.ts',
        `export const a = 'a';
  export function b() {}
  export class C {}
  // tsr-skip
  export type D = 'd';
  export interface E {}`,
      );
      fileService.set(
        '/app/e.ts',
        `export const a = 'a';
  export function b() {}
  export class C {}
  export type D = 'd';
  // tsr-skip
  export interface E {}`,
      );

      edit({
        fileService,
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

    it('should remove files that are not connected to the graph that starts from entrypoints', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = () => 'a';`);
      fileService.set('/app/b.ts', `import { c } from './c';`);
      fileService.set('/app/c.ts', `export const c = 'c';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), false);
      assert.equal(fileService.exists('/app/c.ts'), false);
    });

    it('should remove files that are unreachable from entrypoints', () => {
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

      edit({
        fileService,
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
      it('should remove all files that are not reachable no matter if they form another dependency graph', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);
        fileService.set('/app/b.ts', `import { a } from './a';`);

        // we have another set of files to make sure that it works regardless of the order of the files
        fileService.set('/app/c.ts', `import { d } from './d';`);
        fileService.set('/app/d.ts', `export const d = 'd';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(fileService.exists('/app/a.ts'), false);
        assert.equal(fileService.exists('/app/b.ts'), false);
        assert.equal(fileService.exists('/app/c.ts'), false);
        assert.equal(fileService.exists('/app/d.ts'), false);
      });

      it('should remove files that do not form another dependency graph', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/a.ts', `export const a = 'a';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(fileService.exists('/app/a.ts'), false);
      });

      it('should not remove files that have a comment to skip', () => {
        const fileService = new MemoryFileService();
        fileService.set(
          '/app/a.ts',
          `// tsr-skip
export const a = 'a';`,
        );

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(
          fileService.get('/app/a.ts'),
          `// tsr-skip
export const a = 'a';`,
        );
      });
    });

    describe("when the export is in a file that's reachable from the entrypoint", () => {
      it('should not remove export if its used in some other file', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set('/app/a.ts', `export const a = 'a';`);

        edit({
          fileService,
          recursive,
          entrypoints: ['/app/main.ts'],
          deleteUnusedFile: true,
        });

        assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';`);
      });

      it('should correctly remove export if its not used', () => {
        const fileService = new MemoryFileService();
        fileService.set('/app/main.ts', `import { a } from './a';`);
        fileService.set(
          '/app/a.ts',
          `export const a = 'a';
  export const a2 = 'a2';`,
        );

        edit({
          fileService,
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
    it('should apply code fix when enableCodeFix is true', () => {
      const fileService = new MemoryFileService();

      fileService.set('/app/main.ts', `import { remain } from './a';`);
      fileService.set(
        '/app/a.ts',
        `const dep = 'dep';
export const a = () => dep;
export const remain = 'remain';`,
      );

      edit({
        fileService,
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
    it('should recursively remove files', () => {
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

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });
      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/b.ts'), false);
      assert.equal(fileService.exists('/app/c.ts'), false);
    });

    it('should correctly handle files that rely on files that are part of the dependency graph but are not reachable from the entrypoint', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { a } from './a';`);
      fileService.set(
        '/app/a.ts',
        `export const a = 'a';
export const a2 = 'a2';`,
      );
      fileService.set('/app/b.ts', `import { a2 } from './a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.get('/app/a.ts'), `export const a = 'a';\n`);
      assert.equal(fileService.exists('/app/b.ts'), false);
    });

    it('should not remove exports that are not reachable from the entrypoint but is used in some file marked with skip', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `import { b } from './b';
// tsr-skip
export const a = () => b;`,
      );
      fileService.set('/app/b.ts', `export const b = 'b';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `import { b } from './b';
// tsr-skip
export const a = () => b;`,
      );
      assert.equal(fileService.get('/app/b.ts'), `export const b = 'b';`);
    });

    it('should keep the entrypoint files untouched', () => {
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

      edit({
        fileService,
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

    it('should not delete dynamically imported files', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import('./a');`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
    });

    it('should not delete files when the entrypoint is a reexport', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export { a } from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/main.ts'), true);
    });

    it('should not delete files when the entrypoint is a whole reexport', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/main.ts'), true);
    });

    it('should not delete files when the entrypoint is a whole reexport and is the reexported multiple times', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `export * from './a_reexport';`);
      fileService.set('/app/a_reexport.ts', `export * from './a';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), true);
      assert.equal(fileService.exists('/app/main.ts'), true);
      assert.equal(fileService.exists('/app/a_reexport.ts'), true);
    });

    it('should remove whole reexport if the specifier file is deleted', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import { b } from './b';`);
      fileService.set('/app/b.ts', `export * from './a';export const b = 'b';`);
      fileService.set('/app/a.ts', `export const a = 'a';`);

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
        deleteUnusedFile: true,
        enableCodeFix: true,
      });

      assert.equal(fileService.exists('/app/a.ts'), false);
      assert.equal(fileService.get('/app/b.ts'), `export const b = 'b';`);
    });
  });

  describe('backwards compatibility', () => {
    it('should not remove export if it has old skip comment', () => {
      const fileService = new MemoryFileService();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
export const a = 'a';`,
      );

      edit({
        fileService,
        recursive,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts'),
        `// ts-remove-unused-skip
export const a = 'a';`,
      );
    });
  });

  describe('side effect import', () => {
    it('should not remove file if it is used for side effects', () => {
      const fileService = new MemoryFileService();
      fileService.set('/app/main.ts', `import './a';`);
      fileService.set('/app/a.ts', `console.log('a');`);

      edit({
        fileService,
        recursive,
        deleteUnusedFile: true,
        entrypoints: ['/app/main.ts'],
      });

      assert.equal(fileService.get('/app/main.ts'), `import './a';`);
      assert.equal(fileService.get('/app/a.ts'), `console.log('a');`);
    });
  });
});
