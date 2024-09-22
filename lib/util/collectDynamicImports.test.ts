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
  it('should return a set of dynamic imports', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import('./a.js');`);
    fileService.set('/app/a.js', `export const a = 'a';`);

    const program = getProgram(languageService);

    const result = collectDynamicImports({
      fileService,
      program,
    });

    assert.equal(result.size, 1);
    assert.equal(result.has('/app/a.js'), true);
  });

  it('should return an empty set if no dynamic imports are found', () => {
    const { languageService, fileService } = setup();
    fileService.set('/app/main.ts', `import { a } from './a.js';`);
    fileService.set('/app/a.js', `export const a = 'a';`);

    const program = getProgram(languageService);

    const result = collectDynamicImports({
      fileService,
      program,
    });

    assert.equal(result.size, 0);
  });
});
