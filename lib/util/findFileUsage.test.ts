import { describe, it } from 'node:test';
import { MemoryFileService } from './MemoryFileService.js';
import { createProgram } from './createProgram.js';
import { collectImports } from './collectImports.js';
import { findFileUsage } from './findFileUsage.js';
import assert from 'node:assert/strict';

describe('findFileUsage', () => {
  it('should return a set of identifiers that are used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a, a2 } from './a';`);
    fileService.set(
      '/app/a.ts',
      `export const a = 'a'; export const a2 = 'a2';`,
    );

    const program = createProgram({
      fileService,
      options: {},
      projectRoot: '/app',
    });

    const graph = collectImports({
      fileService,
      program,
      entrypoints: ['/app/main.ts'],
    });

    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
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

    const program = createProgram({
      fileService,
      options: {},
      projectRoot: '/app',
    });
    const graph = collectImports({
      fileService,
      program,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      options: {},
    });

    assert.deepEqual(result, new Set(['a2', 'a']));
  });

  it('should handle a simple case of whole re-export', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a, b } from './a';`);
    fileService.set('/app/a.ts', `export * from './b'; export const a = 'a';`);
    fileService.set('/app/b.ts', `export const b = 'b';`);
    const program = createProgram({
      fileService,
      options: {},
      projectRoot: '/app',
    });
    const graph = collectImports({
      fileService,
      program,
      entrypoints: ['/app/main.ts'],
    });
    const result = findFileUsage({
      targetFile: '/app/a.ts',
      vertexes: graph.eject(),
      files: fileService.eject(),
      options: {},
    });

    assert.deepEqual(result, new Set(['a', 'b']));
  });
});
