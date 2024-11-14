import { dirname, resolve } from 'node:path';
import { remove } from '../lib/remove.js';
import { fileURLToPath } from 'node:url';
import { before, describe, it } from 'node:test';
import { stdout } from 'node:process';
import ts from 'typescript';
import stripAnsi from 'strip-ansi';
import { assertEqualOutput } from './helpers/assertEqualOutput.js';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOG = !!process.env.LOG;

before(() => {
  globalThis.__INTERNAL_WORKER_URL__ = new URL(
    '../dist/worker.js',
    import.meta.url,
  ).href;
});

describe('project: skip', () => {
  it('should throw an error if no patterns are supplied', async () => {
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

    const exitHistory: (number | undefined)[] = [];

    const exit = (code?: number) => {
      exitHistory.push(code);
    };

    await remove({
      configPath: resolve(__dirname, 'fixtures/skip/tsconfig.json'),
      skip: [],
      projectRoot: resolve(__dirname, 'fixtures/skip'),
      mode: 'check',
      logger,
      system: {
        ...ts.sys,
        exit,
      },
    });

    const stripedOutput = stripAnsi(output);

    assertEqualOutput(
      stripedOutput,
      `At least one pattern must be specified for the skip option\n`,
    );
    assert.deepEqual(exitHistory, [1]);
  });

  it('should throw an error if no files are matched', async () => {
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

    const exitHistory: (number | undefined)[] = [];

    const exit = (code?: number) => {
      exitHistory.push(code);
    };

    await remove({
      configPath: resolve(__dirname, 'fixtures/skip/tsconfig.json'),
      skip: [/foo\.ts/],
      projectRoot: resolve(__dirname, 'fixtures/skip'),
      mode: 'check',
      logger,
      system: {
        ...ts.sys,
        exit,
      },
    });

    const stripedOutput = stripAnsi(output);

    assertEqualOutput(stripedOutput, `No files matched the skip pattern\n`);
    assert.deepEqual(exitHistory, [1]);
  });
});
