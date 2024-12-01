import { describe, it } from 'node:test';
import { tsr } from '../lib/tsr.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import stripAnsi from 'strip-ansi';
import { stdout } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOG = !!process.env.LOG;

describe('project: include_dts', () => {
  it('should include unused exports from .d.ts files', async () => {
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
      configPath: resolve(__dirname, 'fixtures/include_dts/tsconfig.json'),
      skip: [/main\.ts/],
      projectRoot: resolve(__dirname, 'fixtures/include_dts'),
      mode: 'check',
      logger,
      system: {
        ...ts.sys,
        exit: () => {},
      },
      includeDts: true,
    });

    const stripedOutput = stripAnsi(output);

    assert.equal(
      stripedOutput,
      `Project has 2 files, skipping 1 file
export types.d.ts:2:0     'B'
✖ remove 1 export
`,
    );
  });

  it('should not include unused exports from .d.ts files', async () => {
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
      configPath: resolve(__dirname, 'fixtures/include_dts/tsconfig.json'),
      skip: [/main\.ts/],
      projectRoot: resolve(__dirname, 'fixtures/include_dts'),
      mode: 'check',
      logger,
      system: {
        ...ts.sys,
        exit: () => {},
      },
      includeDts: false,
    });

    const stripedOutput = stripAnsi(output);

    assert.equal(
      stripedOutput,
      `Project has 2 files, skipping 2 files
✔ all good!
`,
    );
  });
});
