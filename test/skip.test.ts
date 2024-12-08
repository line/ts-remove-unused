import { dirname, resolve } from 'node:path';
import { tsr } from '../lib/tsr.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { stdout } from 'node:process';
import ts from 'typescript';
import stripAnsi from 'strip-ansi';
import { assertEqualOutput } from './helpers/assertEqualOutput.js';
import assert from 'node:assert/strict';

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/skip',
);

const LOG = !!process.env.LOG;

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

    await tsr({
      entrypoints: [],
      projectRoot,
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

    await tsr({
      entrypoints: [/foo\.ts/],
      projectRoot,
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
