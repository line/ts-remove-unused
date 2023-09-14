import { Project } from 'ts-morph';

import { removeUnusedTypeExport } from './removeUnusedTypeExport.js';

describe('removeUnusedTypeExport', () => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  it('should not remove export for type if its used in some other file', () => {
    project.createSourceFile(
      './tools/remove-unused-code/case/index.ts',
      `import { Hello } from './hello';
      const hello: Hello = 'hello';
    `,
    );
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/hello.ts',
      `export type Hello = 'hello';`,
    );

    removeUnusedTypeExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`export type Hello = 'hello';`);
  });

  it('should remove export for type if its not used in some other file', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/world.ts',
      `export type World = 'world';`,
    );

    removeUnusedTypeExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`type World = 'world';`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/with-comment.ts',
      `// ts-remove-unused-skip
export type World = 'world';`,
    );

    removeUnusedTypeExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`// ts-remove-unused-skip
export type World = 'world';`);
  });

  it('should ignore default exports', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/default-world.ts',
      `type World = 'world'; export default World;`,
    );

    removeUnusedTypeExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`type World = 'world'; export default World;`);
  });
});
