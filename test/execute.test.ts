import { dirname, resolve } from 'node:path';
import { remove } from '../lib/remove.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stdout } from 'node:process';
import ts from 'typescript';
import stripAnsi from 'strip-ansi';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOG = !!process.env.LOG;

describe('cli', () => {
  it('should execute', () => {
    let output = '';
    const logger = {
      write: (text: string) => {
        if (LOG) {
          stdout.write(text);
        }
        output += text;
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

    const stripedOutput = stripAnsi(output);

    assert.equal(
      stripedOutput.startsWith(`tsconfig using test/fixtures/project/tsconfig.json

Project has 5 file(s), skipping 1 file(s)...
`),
      true,
    );

    assert.equal(
      stripedOutput.endsWith(`✖ delete 1 file(s), remove 7 export(s)\n`),
      true,
    );

    const lines = stripedOutput.split('\n');

    assert.equal(lines.includes(`export a.ts:1:0     'b'`), true);
    assert.equal(
      lines.includes(
        `export a.ts:3:0     'export default defaultExportConst;'`,
      ),
      true,
    );
    assert.equal(lines.includes(`file   b.ts`), true);
    assert.equal(
      lines.includes(`export d.ts:9:2     'export { unusedLong };'`),
      true,
    );
    assert.equal(
      lines.includes(`export d.ts:8:3     'export { unusedLongLong };'`),
      true,
    );
    assert.equal(
      lines.includes(`export d.ts:8:3     'export { unusedLongLongLong };'`),
      true,
    );
    assert.equal(
      lines.includes(
        `export d.ts:8:3     'export { unusedLongLongLongLong };'`,
      ),
      true,
    );
    assert.equal(
      lines.includes(`export d.ts:9:2     'export default function ()'`),
      true,
    );
  });
});
