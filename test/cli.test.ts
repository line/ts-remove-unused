import { dirname, resolve } from 'node:path';
import { execute } from '../src/execute.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stdout } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('cli', () => {
  it('should execute', () => {
    let output = '';
    const mockedStdout = {
      ...stdout,
      write: (text: string) => {
        stdout.write(text);
        output += text;
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

    assert.equal(/\[modified\].+a.ts/.test(output), true);
    assert.equal(/\[deleted\].+b.ts/.test(output), true);
  });
});
