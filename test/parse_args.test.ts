import assert from 'node:assert/strict';
import * as child_process from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import stripAnsi from 'strip-ansi';

const exec = promisify(child_process.exec);

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/parse_args',
);

const bin = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/cli.js');

await exec('npm run build', { cwd: projectRoot });

describe('parse_args', () => {
  it('should show help', async () => {
    const { stdout } = await exec(`node ${bin} --help`);

    const output = stripAnsi(stdout);

    assert.equal(
      output,
      `
Usage:
  tsr [options] [...entrypoints]

Options:
  -p, --project <file>    Path to your tsconfig.json
  -w, --write             Write changes in place
  -r, --recursive         Recursively look into files until the project is clean
  --include-d-ts          Check for unused code in .d.ts files
  -h, --help              Display this message
  -v, --version           Display version number

Examples:
  # Check unused code for a project with an entrypoint of src/main.ts
  tsr 'src/main\\.ts$'

  # Write changes in place
  tsr --write 'src/main\\.ts$'

  # Check unused code for a project with a custom tsconfig.json
  tsr --project tsconfig.app.json 'src/main\\.ts$'

  # Check unused code for a project with multiple entrypoints in src/pages
  tsr 'src/pages/.*\\.ts$'

`,
    );
  });

  it('should use default tsconfig.json', async () => {
    const { stdout, code } = await exec(`node ${bin} 'src/main\\.ts$'`, {
      cwd: projectRoot,
    })
      .then((res) => ({ ...res, code: 0 }))
      .catch((e) => e as { stdout: string; code: number });

    const output = stripAnsi(stdout.toString());

    assert.equal(
      output,
      `tsconfig tsconfig.json
Project has 2 files. Found 1 entrypoint file
export src/a.ts:2:0     'a2'
✖ remove 1 export
`,
    );
    assert.equal(code, 1);
  });
});
