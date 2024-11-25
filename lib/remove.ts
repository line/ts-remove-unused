import ts from 'typescript';
import { MemoryFileService } from './util/MemoryFileService.js';
import { edit } from './util/edit.js';
import chalk from 'chalk';
import { Logger } from './util/Logger.js';
import { cwd, stdout } from 'node:process';
import { CliEditTracker } from './util/CliEditTracker.js';
import { relative } from 'node:path';
import { formatCount } from './util/formatCount.js';
import { dts } from './util/regex.js';

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

export const remove = async ({
  configPath,
  skip,
  projectRoot,
  mode,
  recursive = false,
  system = ts.sys,
  logger = createNodeJsLogger(),
}: {
  configPath: string;
  skip: RegExp[];
  projectRoot: string;
  mode: 'check' | 'write';
  recursive?: boolean;
  system?: ts.System;
  logger?: Logger;
}) => {
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

  const fileService = new MemoryFileService();
  for (const fileName of fileNames) {
    fileService.set(fileName, system.readFile(fileName) || '');
  }

  const entrypoints = fileNames.filter((fileName) =>
    skip.some((regex) => regex.test(fileName)),
  );

  if (skip.filter((it) => it !== dts).length === 0) {
    logger.write(
      chalk.bold.red(
        'At least one pattern must be specified for the skip option\n',
      ),
    );

    system.exit(1);
    return;
  }

  if (entrypoints.length === 0) {
    logger.write(chalk.bold.red('No files matched the skip pattern\n'));

    system.exit(1);
    return;
  }

  const editTracker = new CliEditTracker(logger, mode, projectRoot);
  editTracker.setTotal(fileNames.length - entrypoints.length);

  logger.write(
    chalk.gray(
      `Project has ${formatCount(fileNames.length, 'file')}, skipping ${formatCount(
        entrypoints.length,
        'file',
      )}\n`,
    ),
  );

  await edit({
    fileService,
    entrypoints,
    deleteUnusedFile: true,
    enableCodeFix: mode === 'write' || recursive,
    editTracker,
    options,
    projectRoot,
    recursive,
  });

  editTracker.clearProgressOutput();

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

  editTracker.logResult();

  if (mode === 'check' && !editTracker.isClean) {
    system.exit(1);
  }
};
