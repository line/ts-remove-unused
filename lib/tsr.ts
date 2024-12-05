import ts from 'typescript';
import { MemoryFileService } from './util/MemoryFileService.js';
import { edit } from './util/edit.js';
import chalk from 'chalk';
import { Logger } from './util/Logger.js';
import { cwd, stdout } from 'node:process';
import { relative } from 'node:path';
import { formatCount } from './util/formatCount.js';
import { CliOutput } from './util/CliOutput.js';

const createNodeJsLogger = (): Logger =>
  'isTTY' in stdout && stdout.isTTY
    ? {
        write: stdout.write.bind(stdout),
        clearLine: stdout.clearLine.bind(stdout),
        cursorTo: stdout.cursorTo.bind(stdout),
        isTTY: true,
      }
    : {
        write: stdout.write.bind(stdout),
        isTTY: false,
      };

export const tsr = async (
  entrypoints: RegExp[] | RegExp,
  {
    configPath,
    projectRoot,
    mode,
    recursive = false,
    system = ts.sys,
    logger = createNodeJsLogger(),
    includeDts = false,
  }: {
    configPath: string;
    projectRoot: string;
    mode: 'check' | 'write';
    recursive?: boolean;
    system?: ts.System;
    logger?: Logger;
    includeDts?: boolean;
  },
) => {
  const { config, error } = ts.readConfigFile(configPath, system.readFile);

  const relativeToCwd = (fileName: string) =>
    relative(cwd(), fileName).replaceAll('\\', '/');
  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    system,
    projectRoot,
  );

  if (!error) {
    logger.write(`${chalk.blue('tsconfig')} ${relativeToCwd(configPath)}\n`);
  }

  const fileService = new MemoryFileService(
    fileNames.map((n) => [n, system.readFile(n) || '']),
  );

  const entrypointFiles = fileNames.filter(
    (fileName) =>
      (Array.isArray(entrypoints) ? entrypoints : [entrypoints]).some((regex) =>
        regex.test(fileName),
      ) ||
      // we want to include the .d.ts files as an entrypoint if includeDts is false
      (!includeDts && /\.d\.ts$/.test(fileName)),
  );

  if (Array.isArray(entrypoints) && entrypoints.length === 0) {
    logger.write(
      chalk.bold.red(
        'At least one pattern must be specified for the skip option\n',
      ),
    );

    system.exit(1);
    return;
  }

  if (entrypointFiles.length === 0) {
    logger.write(chalk.bold.red('No files matched the skip pattern\n'));

    system.exit(1);
    return;
  }

  const output = new CliOutput({ logger, mode, projectRoot });

  logger.write(
    chalk.gray(
      `Project has ${formatCount(fileNames.length, 'file')}, skipping ${formatCount(
        entrypointFiles.length,
        'file',
      )}\n`,
    ),
  );

  await edit({
    fileService,
    entrypoints: entrypointFiles,
    deleteUnusedFile: true,
    enableCodeFix: mode === 'write' || recursive,
    output,
    options,
    projectRoot,
    recursive,
  });

  if (mode === 'write') {
    logger.write(chalk.gray(`Writing to disk...\n`));
  }

  for (const target of fileNames) {
    if (!fileService.exists(target)) {
      if (mode == 'write') {
        system.deleteFile?.(target);
      }
      continue;
    }

    if (parseInt(fileService.getVersion(target), 10) > 1 && mode === 'write') {
      system.writeFile(target, fileService.get(target));
    }
  }

  const { code } = output.done();

  system.exit(code);
};
