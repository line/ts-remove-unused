import assert from 'node:assert/strict';

/**
 * because the process runs in parallel, the output is not guaranteed to be the same every time.
 * to fix this, we have a custom comparison function that ignores the order of the output that runs in parallel.
 */
export const assertEqualOutput = (actual: string, expected: string) => {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');

  assert.equal(expectedLines.length, actualLines.length);
  assert.deepEqual(
    actualLines
      .filter((l) => l.startsWith('export') || l.startsWith('file'))
      .sort(),
    expectedLines
      .filter((l) => l.startsWith('export') || l.startsWith('file'))
      .sort(),
  );
  assert.deepEqual(
    actualLines.filter((l) => !l.startsWith('export') && !l.startsWith('file')),
    expectedLines.filter(
      (l) => !l.startsWith('export') && !l.startsWith('file'),
    ),
  );
};
