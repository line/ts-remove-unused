import { describe, it } from 'node:test';
import { MemoryFileService } from './MemoryFileService.js';
import { createDependencyGraph } from './createDependencyGraph.js';
import { findFileUsage } from './findFileUsage.js';
import assert from 'node:assert/strict';
import ts from 'typescript';

const options: ts.CompilerOptions = {};

describe('findFileUsage', () => {
  it('should return a set of identifiers that are used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a, a2 } from './a';`);
    fileService.set(
      '/app/a.ts',
      `export const a = 'a'; export const a2 = 'a2';`,
    );

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    assert.deepEqual(result, new Set(['a2', 'a']));
  });

  it('should return a list of identifiers only including items that are exported from the target file', () => {
    const fileService = new MemoryFileService();
    fileService.set(
      '/app/main.ts',
      `import { a, a2 } from './a';import { b } from './b';`,
    );
    fileService.set(
      '/app/a.ts',
      `export const a = 'a'; export const a2 = 'a2';`,
    );
    fileService.set('/app/b.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    assert.deepEqual(result, new Set(['a2', 'a']));
  });

  it('should handle a simple case of whole re-export', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a, b } from './a';`);
    fileService.set('/app/a.ts', `export * from './b'; export const a = 'a';`);
    fileService.set('/app/b.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    assert.deepEqual(result, new Set(['a', 'b']));
  });

  it('should not include identifiers that are not exported from the target file', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a, b } from './reexport';`);
    fileService.set(
      '/app/reexport.ts',
      `export * from './a'; export * from './b';`,
    );
    fileService.set('/app/a.ts', `export const a = 'a';`);
    fileService.set('/app/b.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    assert.deepEqual(result, new Set(['a']));
  });

  it('should handle case where whole reexport for file outside of project is used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { glob } from './a';`);
    fileService.set('/app/a.ts', `export * from 'node:fs';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    assert.deepEqual(result, new Set(['glob']));
  });

  it('should return false positive if reexport of file outside of project is used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { cwd, glob } from './a';`);
    fileService.set(
      '/app/a_reexport.ts',
      `export * from 'node:process'; export * from './a';`,
    );
    fileService.set('/app/a.ts', `export * from 'node:fs';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    // cwd is not exported from a.ts so it should not be included in the result
    // but for now this is the expected behavior
    assert.deepEqual(result, new Set(['glob', 'cwd']));
  });

  it('should handle files imported only for side effects', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import './a';`);
    fileService.set('/app/a.ts', `console.log('a');`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      fileNames: fileService.getFileNames(),
      options: {},
    });

    assert.deepEqual(result, new Set(['#side-effect']));
  });
});
