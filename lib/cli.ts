#!/usr/bin/env node
import { tsr } from './tsr.js';
import { createRequire } from 'node:module';
import { arg } from './util/arg.js';
import process from 'node:process';
import { ArgError, CheckResultError } from './util/error.js';

const options = [
  {
    name: 'project',
    alias: 'p',
    type: 'string',
    param: '<file>',
    description: 'Path to your tsconfig.json',
    default: '',
  },
  {
    name: 'write',
    alias: 'w',
    type: 'boolean',
    description: 'Write changes in place',
    default: false,
  },
  {
    name: 'recursive',
    alias: 'r',
    type: 'boolean',
    description: 'Recursively look into files until the project is clean',
    default: false,
  },
  {
    name: 'include-d-ts',
    type: 'boolean',
    description: 'Check for unused code in .d.ts files',
    default: false,
  },
  {
    name: 'help',
    alias: 'h',
    type: 'boolean',
    description: 'Display this message',
    default: false,
  },
  {
    name: 'version',
    alias: 'v',
    type: 'boolean',
    description: 'Display version number',
    default: false,
  },
] as const;

const help = `
Usage:
  tsr [options] [...entrypoints]

Options:
${options
  .map((option) => {
    const alias = 'alias' in option ? `-${option.alias}, ` : '';
    const param = 'param' in option ? ` ${option.param}` : '';

    const term = `${alias}--${option.name}${param}`.padEnd(24);

    return `  ${term}${option.description}`;
  })
  .join('\n')}

Examples:
  # Check unused code for a project with an entrypoint of src/main.ts
  tsr 'src/main\\.ts$'

  # Write changes in place
  tsr --write 'src/main\\.ts$'

  # Check unused code for a project with a custom tsconfig.json
  tsr --project tsconfig.app.json 'src/main\\.ts$'

  # Check unused code for a project with multiple entrypoints in src/pages
  tsr 'src/pages/.*\\.ts$'

`;

const { parse } = arg(options);

const main = () => {
  const parsed = parse(process.argv.slice(2));

  if (parsed.version) {
    const { version } = createRequire(import.meta.url)('../package.json');
    process.stdout.write(`v${version}\n`);

    return;
  }

  if (parsed.help) {
    process.stdout.write(help);

    return;
  }

  return tsr({
    entrypoints: parsed._.map((entrypoint) => new RegExp(entrypoint)),
    mode: parsed.write ? 'write' : 'check',
    configFile: parsed.project || 'tsconfig.json',
    recursive: parsed.recursive,
    includeDts: parsed['include-d-ts'],
  }).catch((error) => {
    if (error instanceof CheckResultError || error instanceof ArgError) {
      process.exitCode = 1;
      return;
    }

    throw error;
  });
};

main();
