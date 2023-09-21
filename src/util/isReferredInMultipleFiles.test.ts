import { Node, Project } from 'ts-morph';
import { isReferredInMultipleFiles } from './isReferredInMultipleFiles.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('isReferredInMultipleFiles', () => {
  // todo: issue in ts-morph, think of alternative solution
  it.skip('should detect import usage correctly when the the entire module is imported', () => {
    const project = new Project({
      tsConfigFilePath: './tsconfig.json',
    });

    project.createSourceFile(
      './a.ts',
      `import * as b from './b';
			
			b.hello();`,
    );

    const b = project.createSourceFile('./b.ts', `export function hello() {};`);

    b.getExportedDeclarations().forEach((declarations) => {
      const declaration = declarations[0];

      if (!Node.isReferenceFindable(declaration)) {
        throw new Error();
      }

      assert.equal(isReferredInMultipleFiles(declaration), true);
    });
  });
});
