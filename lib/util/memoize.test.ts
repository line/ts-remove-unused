import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { memoize } from './memoize.js';

describe('memoize', () => {
  it('should correctly execute the function', () => {
    const fn = (a: number, b: number) => a + b;
    const memoized = memoize(fn, {
      key: (a, b) => `${a}+${b}`,
      name: 'fn',
    });
    assert.equal(memoized(1, 2), 3);
  });

  it('should use cache if its already been calculated', () => {
    let count = 0;
    const fn = (a: number, b: number) => {
      count++;
      return a + b;
    };
    const memoized = memoize(fn, {
      key: (a, b) => `${a}+${b}`,
      name: 'fn',
    });

    assert.equal(memoized(1, 2), 3);
    assert.equal(count, 1);
  });
});
