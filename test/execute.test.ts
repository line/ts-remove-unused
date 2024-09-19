import { dirname, resolve } from 'node:path';
import { remove } from '../lib/remove.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stdout } from 'node:process';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOG = !!process.env.LOG;

describe('cli', () => {
  it('should execute', () => {
    const output: string[] = [];
    const logger = {
      write: (text: string) => {
        if (LOG) {
          stdout.write(text);
        }
        // eslint-disable-next-line no-control-regex
        output.push(text.replaceAll(/\x1B\[\d+./g, '').trim());
      },
      isTTY: false as const,
    };

    remove({
      configPath: resolve(__dirname, 'fixtures/project/tsconfig.json'),
      skip: [/main.ts/],
      projectRoot: resolve(__dirname, 'fixtures/project'),
      mode: 'check',
      logger,
      system: {
        ...ts.sys,
        exit: () => {},
      },
    });

    assert.deepStrictEqual(output, [
      'tsconfig using test/fixtures/project/tsconfig.json',
      'Found 4 file(s), skipping 1 file(s)...',
      "export a.ts:1:0     'b'",
      "export a.ts:3:0     'export default defaultExportConst;'",
      'file   b.ts',
      "export d.ts:9:2     'export { unusedLong };'",
      "export d.ts:8:3     'export { unusedLongLong };'",
      "export d.ts:8:3     'export { unusedLongLongLong };'",
      "export d.ts:8:3     'export { unusedLongLongLongLong };'",
      "export d.ts:9:2     'export default function ()'",
      '✖ delete 1 file(s), remove 7 export(s)',
    ]);
  });
});
