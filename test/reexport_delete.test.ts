import { dirname, resolve } from 'node:path';
import { remove } from '../lib/remove.js';
import { fileURLToPath } from 'node:url';
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { stdout } from 'node:process';
import ts from 'typescript';
import stripAnsi from 'strip-ansi';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOG = !!process.env.LOG;

before(() => {
  globalThis.__INTERNAL_WORKER_URL__ = new URL(
    '../dist/worker.js',
    import.meta.url,
  ).href;
});

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

  await remove({
    configPath: resolve(__dirname, 'fixtures/reexport_delete/tsconfig.json'),
    skip: [/main\.ts/],
    projectRoot: resolve(__dirname, 'fixtures/reexport_delete'),
    mode: 'check',
    logger,
    system: {
      ...ts.sys,
      exit: () => {},
    },
  });

  const stripedOutput = stripAnsi(output);

  assert.equal(
    stripedOutput,
    `tsconfig using test/fixtures/reexport_delete/tsconfig.json

Project has 3 file(s), skipping 1 file(s)...

file   a.ts
export b.ts:0:0     'export * from './a';'

✖ delete 1 file(s), remove 1 export(s)
`,
  );
});
