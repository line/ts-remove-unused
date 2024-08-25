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
        output.push(text);
      },
      clearLine: () => {},
      moveCursor: () => {},
      isTTY: false,
    };

    remove({
      configPath: resolve(__dirname, 'fixtures/project/tsconfig.json'),
      skip: ['main.ts'],
      projectRoot: resolve(__dirname, 'fixtures/project'),
      mode: 'check',
      logger,
      system: {
        ...ts.sys,
        exit: () => {},
      },
    });

    assert.equal(!!output.find((line) => line.includes('a.ts')), true);
    assert.equal(!!output.find((line) => line.includes('b.ts')), true);
  });
});
