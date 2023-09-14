import { Project } from 'ts-morph';

import { removeUnusedVariableExport } from './removeUnusedVariableExport.js';

describe('removeUnusedVariableExport', () => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  it('should not remove export for variable if its used in some other file', () => {
    project.createSourceFile(
      './tools/remove-unused-code/case/index.ts',
      `import { hello } from './hello';
      console.log(hello);
    `,
    );
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/hello.ts',
      `export const hello = 'hello';`,
    );

    removeUnusedVariableExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`export const hello = 'hello';`);
  });

  it('should remove export for variable if its not used in some other file', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/world.ts',
      `export const world = 'world';`,
    );

    removeUnusedVariableExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`const world = 'world';`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/with-comment.ts',
      `// ts-remove-unused-skip
export const world = 'world';`,
    );

    removeUnusedVariableExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`// ts-remove-unused-skip
export const world = 'world';`);
  });

  it('should ignore default exports', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/default-world.ts',
      `const world = 'world'; export default world;`,
    );

    removeUnusedVariableExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`const world = 'world'; export default world;`);
  });
});
