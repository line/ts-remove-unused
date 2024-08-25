import { dirname, resolve } from 'node:path';
import { remove } from '../lib/remove.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stdout } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('cli', () => {
  it('should execute', () => {
    const output: string[] = [];
    const logger = {
      write: (text: string) => {
        stdout.write(text);
        output.push(text);
      },
    };

    remove({
      configPath: resolve(__dirname, 'fixtures/project/tsconfig.json'),
      skip: ['main.ts'],
      projectRoot: resolve(__dirname, 'fixtures/project'),
      dryRun: true,
      logger,
    });

    assert.equal(
      output.find((line) => line.includes('a.ts'))?.includes('modified'),
      true,
    );
    assert.equal(
      output.find((line) => line.includes('b.ts'))?.includes('deleted'),
      true,
    );
  });
});
