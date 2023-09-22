import { Project } from 'ts-morph';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { removeUnusedFunctionExport } from './removeUnusedFunctionExport.js';

describe('removeUnusedFunctionExport', () => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  it('should not remove export for function if its used in some other file', () => {
    project.createSourceFile(
      './tools/remove-unused-code/case/index.ts',
      `import { hello } from './hello';
      hello();
    `,
    );
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/hello.ts',
      `export function hello() {};`,
    );

    removeUnusedFunctionExport(file);

    const result = file.getFullText();

    assert.equal(result.trim(), `export function hello() {};`);
  });

  it('should remove export for function if its not used in some other file', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/world.ts',
      `export function world() {};`,
    );

    removeUnusedFunctionExport(file);

    const result = file.getFullText();

    assert.equal(result.trim(), `function world() {};`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/with-comment.ts',
      `// ts-remove-unused-skip
export function world() {};`,
    );

    removeUnusedFunctionExport(file);

    const result = file.getFullText();

    assert.equal(
      result.trim(),
      `// ts-remove-unused-skip
export function world() {};`,
    );
  });
});
