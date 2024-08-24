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
  it('should not remove export for variable if its used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/index.ts',
      `import { hello } from './hello';
      console.log(hello);
    `,
    );
    fileService.set('/app/hello.ts', `export const hello = 'hello';`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), `export const hello = 'hello';`);
  });

  it('should remove export for variable if its not used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/world.ts', `export const world = 'world';`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/world.ts',
    });

    const result = fileService.get('/app/world.ts');

    assert.equal(result.trim(), `const world = 'world';`);
  });

  it('should not remove export for variable if it has a comment to ignore', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/with-comment.ts',
      `// ts-remove-unused-skip
export const world = 'world';`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/with-comment.ts',
    });

    const result = fileService.get('/app/with-comment.ts');

    assert.equal(
      result.trim(),
      `// ts-remove-unused-skip
export const world = 'world';`,
    );
  });

  it('should not remove export for function if its used in some other file', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/index.ts',
      `import { hello } from './hello';
      hello();
    `,
    );
    fileService.set('/app/hello.ts', `export function hello() {};`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), `export function hello() {};`);
  });

  it('should remove export for function if its not used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/world.ts', `export function world() {};`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/world.ts',
    });

    const result = fileService.get('/app/world.ts');

    assert.equal(result.trim(), `function world() {};`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/with-comment.ts',
      `// ts-remove-unused-skip
export function world() {};`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/with-comment.ts',
    });

    const result = fileService.get('/app/with-comment.ts');

    assert.equal(
      result.trim(),
      `// ts-remove-unused-skip
export function world() {};`,
    );
  });

  it('should not remove export for interface if its used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/index.ts',
      `import { Hello } from './hello';
      const hello: Hello = { hello: 'hello' };
    `,
    );
    fileService.set(
      '/app/hello.ts',
      `export interface Hello { hello: 'hello' }`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), `export interface Hello { hello: 'hello' }`);
  });

  it('should remove export for interface if its not used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/world.ts',
      `export interface World { world: 'world' }`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/world.ts',
    });

    const result = fileService.get('/app/world.ts');

    assert.equal(result.trim(), `interface World { world: 'world' }`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/with-comment.ts',
      `// ts-remove-unused-skip
export interface World { world: 'world' }`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/with-comment.ts',
    });

    const result = fileService.get('/app/with-comment.ts');

    assert.equal(
      result.trim(),
      `// ts-remove-unused-skip
export interface World { world: 'world' }`,
    );
  });

  it('should not remove export for type if its used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/index.ts',
      `import { Hello } from './hello';
      const hello: Hello = 'hello';
    `,
    );
    fileService.set('/app/hello.ts', `export type Hello = 'hello';`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), `export type Hello = 'hello';`);
  });

  it('should remove export for type if its not used in some other file', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/world.ts', `export type World = 'world';`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/world.ts',
    });

    const result = fileService.get('/app/world.ts');

    assert.equal(result.trim(), `type World = 'world';`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      '/app/with-comment.ts',
      `// ts-remove-unused-skip
export type World = 'world';`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/with-comment.ts',
    });

    const result = fileService.get('/app/with-comment.ts');

    assert.equal(
      result.trim(),
      `// ts-remove-unused-skip
export type World = 'world';`,
    );
  });

  it('should not remove default export for an identifier if its used in some other file', () => {
    const { languageService, fileService } = setup();

    fileService.set('/app/index.ts', `import hello from './hello.js';`);

    fileService.set(
      '/app/hello.ts',
      `const hello = 'hello';
export default hello;`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(
      result.trim(),
      `const hello = 'hello';
export default hello;`,
    );
  });

  it('should remove default export for an identifier if its not used in some other file', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/hello.ts',
      `const hello = 'hello';
export default hello;`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), `const hello = 'hello';`);
  });

  it('should not remove default export for an identifier if it has a comment to ignore', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/with-comment.ts',
      `const hello = 'hello';
// ts-remove-unused-skip
export default hello;`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/with-comment.ts',
    });

    const result = fileService.get('/app/with-comment.ts');
    assert.equal(
      result.trim(),
      `const hello = 'hello';
// ts-remove-unused-skip
export default hello;`,
    );
  });

  it('should not remove default export for a literal if its used in some other file', () => {
    const { languageService, fileService } = setup();

    fileService.set('/app/index.ts', `import hello from './hello';`);

    fileService.set('/app/hello.ts', `export default 'hello';`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), `export default 'hello';`);
  });

  it('should remove default export for a literal if its not used in some other file', () => {
    const { languageService, fileService } = setup();

    fileService.set('/app/hello.ts', `export default hello;`);

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/hello.ts',
    });

    const result = fileService.get('/app/hello.ts');
    assert.equal(result.trim(), '');
  });

  it('should not remove default export for a literal if it has a comment to ignore', () => {
    const { languageService, fileService } = setup();

    fileService.set(
      '/app/with-comment.ts',
      `// ts-remove-unused-skip
export default 'hello';`,
    );

    removeExport({
      languageService,
      fileService,
      targetFile: '/app/with-comment.ts',
    });

    const result = fileService.get('/app/with-comment.ts');
    assert.equal(
      result.trim(),
      `// ts-remove-unused-skip
export default 'hello';`,
    );
  });
});
