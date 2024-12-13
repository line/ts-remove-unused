import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { globSync } from 'node:fs';

build({
  entryPoints: globSync('lib/**/*.ts', {
    exclude: (f) => f.endsWith('.d.ts') || f.endsWith('.test.ts'),
  }),
  outdir: 'dist',
  target: 'node18',
  platform: 'node',
  format: 'esm',
  tsconfig: 'tsconfig.lib.json',
});

const projectRoot = dirname(fileURLToPath(import.meta.url));

const { config } = ts.readConfigFile(
  resolve(projectRoot, 'tsconfig.lib.json'),
  ts.sys.readFile,
);

const { options, fileNames } = ts.parseJsonConfigFileContent(
  config,
  ts.sys,
  projectRoot,
);

const program = ts.createProgram(fileNames, {
  ...options,
  emitDeclarationOnly: true,
  outDir: resolve(projectRoot, 'dist'),
  rootDir: resolve(projectRoot, 'lib'),
});

program.emit();
