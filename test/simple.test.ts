import { dirname, resolve } from 'node:path';
import { tsr } from '../lib/tsr.js';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { stdout } from 'node:process';
import ts from 'typescript';
import stripAnsi from 'strip-ansi';
import { assertEqualOutput } from './helpers/assertEqualOutput.js';

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/simple',
);

const LOG = !!process.env.LOG;

test('simple', async () => {
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

  await tsr({
    entrypoints: [/main\.ts/],
    projectRoot,
    mode: 'check',
    logger,
    system: {
      ...ts.sys,
      exit: () => {},
    },
  });

  const stripedOutput = stripAnsi(output);

  assertEqualOutput(
    stripedOutput,
    `tsconfig test/fixtures/simple/tsconfig.json
Project has 5 files, skipping 1 file
file   b.ts
export a.ts:1:0     'b'
export a.ts:3:0     'default'
export d.ts:9:2     'unusedLong'
export d.ts:10:2    'unusedLongLong'
export d.ts:11:2    'unusedLongLongLong'
export d.ts:12:2    'unusedLongLongLongLong'
export d.ts:15:0    'default'
✖ delete 1 file, remove 7 exports
`,
  );
});
