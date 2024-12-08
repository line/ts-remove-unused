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
  'fixtures/reexport_delete',
);

const LOG = !!process.env.LOG;

test('reexport_delete', async () => {
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
    `tsconfig test/fixtures/reexport_delete/tsconfig.json
Project has 3 files, skipping 1 file
file   a.ts
export b.ts:0:0     'export * from './a';'
✖ delete 1 file, remove 1 export
`,
  );
});
