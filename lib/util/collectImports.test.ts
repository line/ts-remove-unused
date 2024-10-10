import { describe, it } from 'node:test';
import { setup } from '../../test/helpers/setup.js';
import { collectImports } from './collectImports.js';
import ts from 'typescript';
import assert from 'node:assert/strict';

const getProgram = (languageService: ts.LanguageService) => {
  const program = languageService.getProgram();

  if (!program) {
    throw new Error('Program not found');
  }

  return program;
};

describe('collectImports', () => {
  it('should return a graph of imports', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
import { c } from './c.js';
export const a = () => ({ b, c });`,
    );
    fileService.set('/app/b.ts', `export const b = 'b';`);
    fileService.set('/app/c.ts', `export const c = 'c';`);

    const program = getProgram(languageService);

    const graph = collectImports({
      fileService,
      program,
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
  });

  it('should return a graph of imports when re-exports are used', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
export const a = () => b;`,
    );
    fileService.set('/app/b.ts', `export { b } from './b2.js';`);
    fileService.set('/app/b2.ts', `export const b = 'b';`);

    const program = getProgram(languageService);
    const graph = collectImports({
      fileService,
      program,
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
  });

  it('should return a graph of imports when whole re-exports are used', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set(
      '/app/a.ts',
      `import { b } from './b.js';
export const a = () => b;`,
    );
    fileService.set('/app/b.ts', `export * from './b2.js';`);
    fileService.set('/app/b2.ts', `export const b = 'b';`);

    const program = getProgram(languageService);
    const graph = collectImports({
      fileService,
      program,
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
  });

  it('should return a graph of imports when dynamic imports are used', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import('./a.js');`);
    fileService.set('/app/a.ts', `export a = () => import('./b.js');`);
    fileService.set('/app/b.ts', `export const b = 'b';`);

    const program = getProgram(languageService);
    const graph = collectImports({
      fileService,
      program,
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
  });

  it('should not include files that are unreachable from the entry point', () => {
    const { languageService, fileService } = setup();
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

    const program = getProgram(languageService);

    const graph = collectImports({
      fileService,
      program,
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
    assert.equal(graph.vertexes.has('/app/c.ts'), false);
    assert.equal(graph.vertexes.has('/app/d.ts'), false);
  });
});
