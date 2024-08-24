import { dirname, resolve } from 'node:path';
import { execute } from '../lib/execute.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stdout } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('cli', () => {
  it('should execute', () => {
    const output: string[] = [];
    const mockedStdout = {
      ...stdout,
      write: (text: string) => {
        stdout.write(text);
        output.push(text);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    execute({
      tsConfigFilePath: 'tsconfig.json',
      skip: ['main.ts'],
      projectRoot: resolve(__dirname, 'fixtures/project'),
      dryRun: true,
      stdout: mockedStdout,
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
