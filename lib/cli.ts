#!/usr/bin/env node

import { cac } from 'cac';
import { tsr } from './tsr.js';
import { createRequire } from 'node:module';
const cli = cac('tsr');

cli
  .command(
    '[...entrypoints]',
    `regex patterns to match entrypoints. ex) npx tsr 'src/main\\.ts$'`,
  )
  .option('-p, --project <file>', 'Path to your tsconfig.json')
  .option('-w, --write', 'Write changes in place')
  .option(
    '-r, --recursive',
    'Recursively look into files until the project is clean',
  )
  .option('--include-d-ts', 'checks for unused exports in .d.ts files')
  .action((args, options) =>
    tsr({
      entrypoints: args.reduce(
        (acc: string[], cur: unknown) =>
          typeof cur === 'string' ? [...acc, new RegExp(cur)] : acc,
        [],
      ),
      mode: options.write ? 'check' : 'write',
      configFile:
        typeof options.project === 'string' ? options.project : undefined,
      recursive: !!options.recursive,
      includeDts: !!options['includeD-ts'],
    }),
  );

cli.help();

const { version } = createRequire(import.meta.url)('../package.json');

cli.version(`v${version}`);
cli.parse();
