import { describe, it } from 'node:test';
import { namespaceUsage } from './namespaceUsage.js';
import ts from 'typescript';
import assert from 'node:assert/strict';

describe('namespaceUsage', () => {
  it('should return namespace usage for a simple file', () => {
    const sourceFile = ts.createSourceFile(
      '/app/a.ts',
      `import * as b from './b';
b.x;`,
      ts.ScriptTarget.ESNext,
    );

    const result = namespaceUsage({ sourceFile });

    assert.deepEqual(result.get('b'), ['x']);
  });

  it('should return asterisk if the namespace identifier is used', () => {
    const sourceFile = ts.createSourceFile(
      '/app/a.ts',
      `import * as b from './b';
b;
b.x;`,
      ts.ScriptTarget.ESNext,
    );

    const result = namespaceUsage({ sourceFile });

    assert.deepEqual(result.get('b'), ['*']);
  });

  it('should work with function calls on properties', () => {
    const sourceFile = ts.createSourceFile(
      '/app/a.ts',
      `import * as b from './b';
b.x();
b.y.z();`,
      ts.ScriptTarget.ESNext,
    );

    const result = namespaceUsage({ sourceFile });

    assert.deepEqual(result.get('b'), ['x', 'y']);
  });

  it('should return an asterisk when the namespace is assigned to a variable', () => {
    const sourceFile = ts.createSourceFile(
      '/app/a.ts',
      `import * as b from './b';
const c = b;
c.x;`,
      ts.ScriptTarget.ESNext,
    );

    const result = namespaceUsage({ sourceFile });

    assert.deepEqual(result.get('b'), ['*']);
  });
});
