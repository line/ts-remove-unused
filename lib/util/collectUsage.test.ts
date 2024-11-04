import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectUsage } from './collectUsage.js';

describe('collectUsage', () => {
  it('should collect a single named import', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
    });
  });

  it('should collect multiple named imports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b, c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b', 'c']),
    });
  });

  it('should collect aliased named imports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b as c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
    });
  });

  it('should collect a single default import', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['default']),
    });
  });

  it('should collect when default and named imports are mixed', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import b, { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['default', 'c']),
    });
  });

  it('should collect when the default specifier is used in a named import', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { default as b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['default']),
    });
  });

  it('should collect when there are imports to multiple files', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b } from "./b"; import { c } from "./c";',
      destFiles: new Set(['/app/b.ts', '/app/c.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
      '/app/c.ts': new Set(['c']),
    });
  });

  it('should collect when there are multiple import declarations referencing the same file', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b } from "./b"; import { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b', 'c']),
    });
  });
});
