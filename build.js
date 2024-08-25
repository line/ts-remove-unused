import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

build({
  entryPoints: ['lib/cli.ts', 'lib/main.ts'],
  outdir: 'dist',
  bundle: true,
  external: ['chalk', 'cac', 'typescript'],
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
