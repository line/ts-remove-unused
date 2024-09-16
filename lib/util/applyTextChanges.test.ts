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

  it('should remove limit the number of consecutive line breaks that occur due to the edit to 2', () => {
    const result = applyTextChanges(
      `export const a = 'a';\n\nconst a2 = 'a2';\n\nexport const a3 = 'a3';\n`,
      [{ span: { start: 23, length: 17 }, newText: '' }],
    );

    assert.equal(result, `export const a = 'a';\n\nexport const a3 = 'a3';\n`);
  });

  it('should only allow one trailing line break at the end of the file', () => {
    const result = applyTextChanges(
      `\n\nconst a = 'a';\n\nexport const a2 = 'a2';\n\nconst a3 = 'a3';\n`,
      [
        { span: { start: 2, length: 15 }, newText: '' },
        { span: { start: 43, length: 17 }, newText: '' },
      ],
    );
    assert.equal(result.endsWith(';\n'), true);
  });

  it('should not allow a leading line break at the start of the file', () => {
    const result = applyTextChanges(
      `\n\nconst a = 'a';\n\nexport const a2 = 'a2';\n\nconst a3 = 'a3';\n`,
      [
        { span: { start: 2, length: 15 }, newText: '' },
        { span: { start: 43, length: 17 }, newText: '' },
      ],
    );

    console.log({ result });
    assert.equal(result.startsWith('export const'), true);
  });
});
