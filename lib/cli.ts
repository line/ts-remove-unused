#!/usr/bin/env node

import { cac } from 'cac';
import { tsr } from './tsr.js';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
const cli = cac('tsr');

cli
  .command('[...entrypoints]', 'regex patterns to match entrypoints')
  .option('-p, --project <file>', 'Path to your tsconfig.json')
  .option('--include-d-ts', 'Include .d.ts files in target for transformation')
  .option('-w, --write', 'Write changes in place')
  .option(
    '-r, --recursive',
    'Recursively look into files until the project is clean',
  )
  .action((args, options) => {
    tsr(
      args.reduce(
        (acc: string[], cur: unknown) =>
          typeof cur === 'string' ? [...acc, new RegExp(cur)] : acc,
        [],
      ),
      {
        configPath: resolve(options.project || './tsconfig.json'),
        mode: options.write ? 'check' : 'write',
        projectRoot: cwd(),
        recursive: !!options.recursive,
        includeDts: !!options['includeD-ts'],
      },
    );
  });

// omit the 'Commands' section from the help output because there is only one command
cli.help((sections) => sections.filter(({ title }) => title !== 'Commands'));

const { version } = createRequire(import.meta.url)('../package.json');

cli.version(`v${version}`);
cli.parse();
