import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectUsage } from './collectUsage.js';

describe('collectUsage', () => {
  it('should collect basic usage', () => {
    const result = collectUsage('/app/a.ts', 'import { b } from "./b";');

    assert.deepEqual(result, {
      '/app/b.ts': ['b'],
    });
  });
});
