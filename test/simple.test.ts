import { dirname, resolve } from 'node:path';
import { remove } from '../lib/remove.js';
import { fileURLToPath } from 'node:url';
import { before, test, it } from 'node:test';
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

  await remove({
    configPath: resolve(__dirname, 'fixtures/simple/tsconfig.json'),
    skip: [/main\.ts/],
    projectRoot: resolve(__dirname, 'fixtures/simple'),
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
    `tsconfig using test/fixtures/simple/tsconfig.json

Project has 5 file(s), skipping 1 file(s)...

file   b.ts
export a.ts:1:0     'b'
export a.ts:3:0     'export default defaultExportConst;'
export d.ts:9:2     'export { unusedLong };'
export d.ts:8:3     'export { unusedLongLong };'
export d.ts:8:3     'export { unusedLongLongLong };'
export d.ts:8:3     'export { unusedLongLongLongLong };'
export d.ts:9:2     'export default function ()'

✖ delete 1 file(s), remove 7 export(s)
`,
  );
});
