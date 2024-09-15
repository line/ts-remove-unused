import { describe, it } from 'node:test';
import { applyTextChanges } from './applyTextChanges.js';
import assert from 'node:assert/strict';

describe('applyTextChanges', () => {
  it('should apply basic changes', () => {
    const result = applyTextChanges(`export const a = 'a';\nconst a2 = 'a2';`, [
      { span: { start: 22, length: 16 }, newText: '' },
    ]);

    assert.equal(result, `export const a = 'a';\n`);
  });
});
