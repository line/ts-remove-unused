import { describe, it } from 'node:test';
import { tsr } from '../lib/tsr.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import stripAnsi from 'strip-ansi';
import { stdout } from 'node:process';

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/load_tsconfig',
);

const LOG = !!process.env.LOG;

describe('project: load_tsconfig', () => {
  it('should log using default options if no tsconfig is found', async () => {
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

    assert.equal(
      stripedOutput,
      `tsconfig using default options
Project has 1 file, skipping 1 file
✔ all good!
`,
    );
  });

  it(`should log using default options tsconfig path is invalid`, async () => {
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
      configFile: 'tsconfig.invalid.json',
      projectRoot,
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
      `tsconfig using default options
Project has 1 file, skipping 1 file
✔ all good!
`,
    );
  });

  it('should log loaded tsconfig path if tsconfig is found', async () => {
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
      configFile: 'tsconfig.sample.json',
      projectRoot,
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
      `tsconfig test/fixtures/load_tsconfig/tsconfig.sample.json
Project has 1 file, skipping 1 file
✔ all good!
`,
    );
  });
});
