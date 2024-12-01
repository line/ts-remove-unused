import { describe, it } from 'node:test';
import { createDependencyGraph } from './createDependencyGraph.js';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { MemoryFileService } from './MemoryFileService.js';

const options: ts.CompilerOptions = {};

describe('createDependencyGraph', () => {
  it('should return a graph of imports', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
import { c } from './c.js';
export const a = () => ({ b, c });`,
    );
    fileService.set('/app/b.ts', `export const b = 'b';`);
    fileService.set('/app/c.ts', `export const c = 'c';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    assert.equal(graph.vertexes.size, 4);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 2);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/c.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 2);
    assert.equal(graph.vertexes.get('/app/c.ts')?.data.depth, 2);
  });

  it('should return a graph of imports when re-exports are used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
export const a = () => b;`,
    );
    fileService.set('/app/b.ts', `export { b } from './b2.js';`);
    fileService.set('/app/b2.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    assert.equal(graph.vertexes.size, 4);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.has('/app/b2.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.has('/app/b2.ts'), true);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.from.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 2);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.data.depth, 3);
  });

  it('should return a graph of imports when whole re-exports are used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
export const a = () => b;`,
    );
    fileService.set('/app/b.ts', `export * from './b2.js';`);
    fileService.set('/app/b2.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    assert.equal(graph.vertexes.size, 4);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.has('/app/b2.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.has('/app/b2.ts'), true);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.from.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 2);
    assert.equal(graph.vertexes.get('/app/b2.ts')?.data.depth, 3);
  });

  it('should return a graph of imports when dynamic imports are used', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import('./a.js');`);
    fileService.set('/app/a.ts', `export a = () => import('./b.js');`);
    fileService.set('/app/b.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    assert.equal(graph.vertexes.size, 3);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 2);
  });

  it('should handle files that are unreachable from the entry point', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
export const a = () => b;`,
    );
    fileService.set('/app/b.ts', `export const b = 'b';`);
    fileService.set(
      '/app/c.ts',
      `import { d } from './d.js';
export const c = () => d;`,
    );
    fileService.set('/app/d.ts', `export const d = 'd';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    assert.equal(graph.vertexes.size, 5);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.has('/app/d.ts'), true);
    assert.equal(graph.vertexes.get('/app/c.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/c.ts')?.to.has('/app/d.ts'), true);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/d.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/d.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/d.ts')?.from.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 2);
    assert.equal(graph.vertexes.get('/app/c.ts')?.data.depth, Infinity);
    assert.equal(graph.vertexes.get('/app/d.ts')?.data.depth, Infinity);
  });

  it('should not create a vertex if there are no imports', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', 'console.log("hello world");');
    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    assert.equal(graph.vertexes.size, 0);
  });

  it('should not create a vertex for a file that is unreachable from the entry point if there are no imports from/exports to the file', () => {
    const fileService = new MemoryFileService();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set('/app/a.ts', `export const a = () => 'a';`);
    fileService.set('/app/b.ts', `export const b = 'b';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });
    assert.equal(graph.vertexes.size, 2);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), false);
  });

  it('should correctly collect circular dependencies', () => {
    const fileService = new MemoryFileService();

    fileService.set(
      '/app/main.ts',
      `import { a } from './a.js';
a();`,
    );
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
export const a = () => b();
export const a2 = 'a2';`,
    );
    fileService.set(
      '/app/b.ts',
      `import { c } from './c.js';
export const b = () => c();`,
    );
    fileService.set(
      '/app/c.ts',
      `import { a2 } from './a.js';
export const c = () => a2;`,
    );

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts'],
    });

    assert.equal(graph.vertexes.size, 4);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 2);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/c.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/c.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.size, 1);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 2);
    assert.equal(graph.vertexes.get('/app/c.ts')?.data.depth, 3);
  });

  it('should work when there are multiple entrypoints', () => {
    const fileService = new MemoryFileService();

    fileService.set(
      '/app/main.ts',
      `import { a } from './a.js';
`,
    );
    fileService.set(
      '/app/main2.ts',
      `import { b } from './b.js';
`,
    );
    fileService.set(
      '/app/a.ts',
      `import { c } from './c.js';
export const a = () => c;`,
    );
    fileService.set(
      '/app/b.ts',
      `import { c } from './c.js';
export const b = () => c;`,
    );
    fileService.set('/app/c.ts', `export const c = 'c';`);

    const graph = createDependencyGraph({
      fileService,
      options,
      entrypoints: ['/app/main.ts', '/app/main2.ts'],
    });

    assert.equal(graph.vertexes.size, 5);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/main2.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/main2.ts')?.to.size, 1);
    assert.equal(
      graph.vertexes.get('/app/main2.ts')?.to.has('/app/b.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/main2.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.to.has('/app/c.ts'), true);
    assert.equal(graph.vertexes.get('/app/b.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/b.ts')?.from.has('/app/main2.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/c.ts')?.to.size, 0);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.size, 2);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/c.ts')?.from.has('/app/b.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/main2.ts')?.data.depth, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/b.ts')?.data.depth, 1);
    assert.equal(graph.vertexes.get('/app/c.ts')?.data.depth, 2);
  });
});
