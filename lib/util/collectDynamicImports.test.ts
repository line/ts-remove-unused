import { describe, it } from 'node:test';
import { setup } from '../../test/helpers/setup.js';
import { collectDynamicImports } from './collectDynamicImports.js';
import ts from 'typescript';
import assert from 'node:assert/strict';

const getProgram = (languageService: ts.LanguageService) => {
  const program = languageService.getProgram();

  if (!program) {
    throw new Error('Program not found');
  }

  return program;
};

describe('collectDynamicImports', () => {
  it('should return a graph of dynamic imports', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import('./a.js');`);
    fileService.set('/app/a.ts', `export const a = 'a';`);

    const program = getProgram(languageService);

    const graph = collectDynamicImports({
      fileService,
      program,
    });

    assert.equal(graph.vertexes.size, 2);
    assert.equal(graph.vertexes.has('/app/main.ts'), true);
    assert.equal(graph.vertexes.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.size, 1);
    assert.equal(graph.vertexes.get('/app/main.ts')?.to.has('/app/a.ts'), true);
    assert.equal(graph.vertexes.get('/app/main.ts')?.from.size, 0);
    assert.equal(graph.vertexes.get('/app/a.ts')?.from.size, 1);
    assert.equal(
      graph.vertexes.get('/app/a.ts')?.from.has('/app/main.ts'),
      true,
    );
    assert.equal(graph.vertexes.get('/app/a.ts')?.to.size, 0);
  });

  it('should return an empty graph if no dynamic imports are found', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set('/app/a.ts', `export const a = 'a';`);

    const program = getProgram(languageService);

    const graph = collectDynamicImports({
      fileService,
      program,
    });

    assert.equal(graph.vertexes.size, 0);
  });
});
