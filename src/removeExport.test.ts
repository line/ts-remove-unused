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
  describe('variable statement', () => {
    it('should not remove export for variable if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/main.ts',
        `import { a } from './a';
        console.log(a);
      `,
      );
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
import c from './c';
      `,
      );
      fileService.set('/app/a.ts', `export function a() {};`);
      fileService.set('/app/b.ts', `export default function b() {};`);
      fileService.set('/app/c.ts', `export default function() {};`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts'],
      });

      assert.equal(
        fileService.get('/app/a.ts').trim(),
        `export function a() {};`,
      );
      assert.equal(
        fileService.get('/app/b.ts').trim(),
        `export default function b() {};`,
      );
      assert.equal(
        fileService.get('/app/c.ts').trim(),
        `export default function() {};`,
      );
    });

    it('should remove export for function if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/a.ts', `export function a() {};`);
      fileService.set('/app/b.ts', `export default function b() {};`);
      fileService.set('/app/c.ts', `export default function() {}`);

      removeExport({
        languageService,
        fileService,
        targetFile: ['/app/a.ts', '/app/b.ts', '/app/c.ts'],
      });

      assert.equal(fileService.get('/app/a.ts').trim(), `function a() {};`);
      assert.equal(fileService.get('/app/b.ts').trim(), `function b() {};`);
      assert.equal(fileService.get('/app/c.ts').trim(), '');
    });

    it('should not remove export if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export function b() {};`,
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
  export function b() {};`,
      );
    });
  });

  describe('interface declaration', () => {
    it('should not remove export for interface if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
        const a: A = { a: 'a' };
      `,
      );
      fileService.set('/app/a.ts', `export interface A { a: 'a' }`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result.trim(), `export interface A { a: 'a' }`);
    });

    it('should remove export for interface if its not used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set('/app/b.ts', `export interface B { b: 'b' }`);

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/b.ts',
      });

      const result = fileService.get('/app/b.ts');

      assert.equal(result.trim(), `interface B { b: 'b' }`);
    });

    it('should not remove export if it has a comment to ignore', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/a.ts',
        `// ts-remove-unused-skip
  export interface B { b: 'b' }`,
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
  export interface B { b: 'b' }`,
      );
    });
  });

  describe('type alias declaration', () => {
    it('should not remove export for type if its used in some other file', () => {
      const { languageService, fileService } = setup();
      fileService.set(
        '/app/main.ts',
        `import { A } from './a';
        const a: A = 'a';
      `,
      );
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

      fileService.set('/app/main.ts', `import a from './a.js';`);

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
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
  export default a;`,
      );
    });

    it('should remove default export for an identifier if its not used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export default a;`,
      );

      removeExport({
        languageService,
        fileService,
        targetFile: '/app/a.ts',
      });

      const result = fileService.get('/app/a.ts');
      assert.equal(result.trim(), `const a = 'a';`);
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

      fileService.set('/app/main.ts', `import { a } from './a.js';`);

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export { a };`,
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
  export { a };`,
      );
    });

    it('should remove export specifier for an identifier if its not used in some other file', () => {
      const { languageService, fileService } = setup();

      fileService.set(
        '/app/a.ts',
        `const a = 'a';
  export { a };`,
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
