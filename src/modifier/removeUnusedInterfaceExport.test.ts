import { Project } from 'ts-morph';

import { removeUnusedInterfaceExport } from './removeUnusedInterfaceExport.js';

describe('removeUnusedInterfaceExport', () => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  it('should not remove export for interface if its used in some other file', () => {
    project.createSourceFile(
      './tools/remove-unused-code/case/index.ts',
      `import { Hello } from './hello';
      const hello: Hello = { hello: 'hello' };
    `,
    );
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/hello.ts',
      `export interface Hello { hello: 'hello' }`,
    );

    removeUnusedInterfaceExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`export interface Hello { hello: 'hello' }`);
  });

  it('should remove export for interface if its not used in some other file', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/world.ts',
      `export interface World { world: 'world' }`,
    );

    removeUnusedInterfaceExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`interface World { world: 'world' }`);
  });

  it('should not remove export if it has a comment to ignore', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/with-comment.ts',
      `// ts-remove-unused-skip
export interface World { world: 'world' }`,
    );

    removeUnusedInterfaceExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(`// ts-remove-unused-skip
export interface World { world: 'world' }`);
  });

  it('should ignore default exports', () => {
    const file = project.createSourceFile(
      './tools/remove-unused-code/case/default-world.ts',
      `interface World { world: 'world' }; export default World;`,
    );

    removeUnusedInterfaceExport(file);

    const result = file.getFullText();

    expect(result.trim()).toBe(
      `interface World { world: 'world' }; export default World;`,
    );
  });
});
