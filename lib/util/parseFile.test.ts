import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFile } from './parseFile.js';
import ts from 'typescript';

describe('parseFile', () => {
  it('should collect a single named import', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import { b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b'],
    });
  });

  it('should collect multiple named imports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import { b, c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b', 'c'],
    });
  });

  it('should collect aliased named imports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import { b as c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b'],
    });
  });

  it('should collect a single default import', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['default'],
    });
  });

  it('should collect when default and named imports are mixed', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import b, { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['c', 'default'],
    });
  });

  it('should collect when the default specifier is used in a named import', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import { default as b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['default'],
    });
  });

  it('should collect when there are imports to multiple files', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import { b } from "./b"; import { c } from "./c";',
      destFiles: new Set(['/app/b.ts', '/app/c.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b'],
      '/app/c.ts': ['c'],
    });
  });

  it('should collect when there are multiple import declarations referencing the same file', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import { b } from "./b"; import { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b', 'c'],
    });
  });

  it('should collect namespace imports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import * as b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['*'],
    });
  });

  it('should collect a single export declaration', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export { b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b'],
    });
  });

  it('should collect multiple named exports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export { b, c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b', 'c'],
    });
  });

  it('should collect aliased named exports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export { b as c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b'],
    });
  });

  it('should collect when there are exports to multiple files', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export { b } from "./b"; export { c } from "./c";',
      destFiles: new Set(['/app/b.ts', '/app/c.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b'],
      '/app/c.ts': ['c'],
    });
  });

  it('should collect when there are multiple export declarations referencing the same file', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export { b } from "./b"; export { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['b', 'c'],
    });
  });

  it('should collect namespace exports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export * as b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': ['*'],
    });
  });

  it('should collect whole reexports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'export * from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      '/app/b.ts': [{ type: 'wholeReexport', file: '/app/a.ts' }],
    });
  });

  it('should collect dynamic imports', () => {
    const { imports } = parseFile({
      file: '/app/a.ts',
      content: 'import("./b");',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(imports, {
      // for now, we don't know what's being imported so we just add a wildcard
      '/app/b.ts': ['*'],
    });
  });

  it('should collect variable statement export', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export const a = 'a';`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.VariableStatement,
        name: ['a'],
        change: {
          code: 'export ',
          span: {
            start: 0,
            length: 7,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should collect variable statement export with multiple variables', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export const a = 'a', b = 'b';`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.VariableStatement,
        name: ['a', 'b'],
        change: {
          code: 'export ',
          span: {
            start: 0,
            length: 7,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should return skip: true for variable statement export with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `// ts-remove-unused-skip
export const a = 'a';`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.VariableStatement &&
        exports[0].skip,
      true,
    );
  });

  it('should collect function declaration export', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export function a() {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.FunctionDeclaration,
        name: 'a',
        change: {
          code: 'export ',
          span: {
            start: 0,
            length: 7,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should collect function declaration with default export', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export default function a() {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.FunctionDeclaration,
        name: 'default',
        change: {
          code: 'export default ',
          span: {
            start: 0,
            length: 15,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should collect unnamed function declaration with default export keyword', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export default function() {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.FunctionDeclaration,
        name: 'default',
        change: {
          code: 'export default function() {}',
          span: {
            start: 0,
            length: 28,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should return skip: true for function declaration export with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `// ts-remove-unused-skip
export function a() {}`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.FunctionDeclaration &&
        exports[0].skip,
      true,
    );
  });

  it('should collect interface declaration export', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export interface A {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.InterfaceDeclaration,
        name: 'A',
        change: {
          code: 'export ',
          span: {
            start: 0,
            length: 7,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should collect interface declaration with default export keyword', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export default interface A {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.InterfaceDeclaration,
        name: 'default',
        change: {
          code: 'export default ',
          span: {
            start: 0,
            length: 15,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should return skip: true for interface declaration export with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `// ts-remove-unused-skip
export interface A {}`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.InterfaceDeclaration &&
        exports[0].skip,
      true,
    );
  });

  it('should collect type alias declaration export', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export type A = string;`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.TypeAliasDeclaration,
        name: 'A',
        change: {
          code: 'export ',
          span: {
            start: 0,
            length: 7,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should return skip: true for type alias declaration export with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `// ts-remove-unused-skip
export type A = string;`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.TypeAliasDeclaration &&
        exports[0].skip,
      true,
    );
  });

  it('should collect default export assignment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export default 'a';`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportAssignment,
        name: 'default',
        change: {
          code: `export default 'a';`,
          span: {
            start: 0,
            length: 19,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should return skip: true for default export assignment with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `// ts-remove-unused-skip
export default 'a';`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.ExportAssignment &&
        exports[0].skip,
      true,
    );
  });

  it('should collect export declaration', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `const a = 'a'; const b = 'b'; export { a, b };`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'named',
        name: ['a', 'b'],
        change: {
          code: ' export { a, b };',
          span: {
            start: 29,
            length: 17,
          },
        },
        skip: false,
        start: 30,
      },
    ]);
  });

  it('should return skip: true for export declaration with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `const a = 'a'; const b = 'b';
// ts-remove-unused-skip
export { a, b };`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.ExportDeclaration &&
        exports[0].type === 'named' &&
        exports[0].skip,
      true,
    );
  });

  it('should collect renamed export declaration', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `const a = 'a'; export { a as b };`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'named',
        name: ['b'],
        change: {
          code: ' export { a as b };',
          span: {
            start: 14,
            length: 19,
          },
        },
        skip: false,
        start: 15,
      },
    ]);
  });

  it('should include named re-export in exports', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export { a } from './b';`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'named',
        name: ['a'],
        change: {
          code: `export { a } from './b';`,
          span: {
            start: 0,
            length: 24,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should include renamed re-export in exports', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export { a as b } from './b';`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'named',
        name: ['b'],
        change: {
          code: `export { a as b } from './b';`,
          span: {
            start: 0,
            length: 29,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should include namespace re-export in exports', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export * as b from './b';`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'namespace',
        name: 'b',
        start: 0,
      },
    ]);
  });

  it('should include whole re-export in exports', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export * from './b';`,
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'whole',
        file: '/app/b.ts',
        start: 0,
      },
    ]);
  });

  it('should return null for file if the whole re-export is not part of the project', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export * from 'node:fs`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'whole',
        file: null,
        start: 0,
      },
    ]);
  });

  it('should collect class declaration export', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export class A {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ClassDeclaration,
        name: 'A',
        change: {
          code: 'export ',
          span: {
            start: 0,
            length: 7,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should collect class declaration with default export keyword', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export default class A {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ClassDeclaration,
        name: 'default',
        change: {
          code: 'export default ',
          span: {
            start: 0,
            length: 15,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should collect unnamed class declaration with default export keyword', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `export default class {}`,
      destFiles: new Set(),
    });

    assert.deepEqual(exports, [
      {
        kind: ts.SyntaxKind.ClassDeclaration,
        name: 'default',
        change: {
          code: 'export default class {}',
          span: {
            start: 0,
            length: 23,
          },
        },
        skip: false,
        start: 0,
      },
    ]);
  });

  it('should return skip: true for class declaration with skip comment', () => {
    const { exports } = parseFile({
      file: '/app/a.ts',
      content: `// ts-remove-unused-skip
export class A {}`,
      destFiles: new Set(),
    });

    assert.equal(
      exports[0] &&
        exports[0].kind === ts.SyntaxKind.ClassDeclaration &&
        exports[0].skip,
      true,
    );
  });
});
