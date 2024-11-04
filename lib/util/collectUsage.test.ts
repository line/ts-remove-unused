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
});
