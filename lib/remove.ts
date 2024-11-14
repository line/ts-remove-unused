import ts from 'typescript';
import { MemoryFileService } from './util/MemoryFileService.js';
import { removeUnusedExport } from './util/removeUnusedExport.js';
import chalk from 'chalk';
import { Logger } from './util/Logger.js';
import { cwd, stdout } from 'node:process';
import { CliEditTracker } from './util/CliEditTracker.js';
import { relative } from 'node:path';
import { WorkerPool } from './util/WorkerPool.js';
import type { processFile } from './util/removeUnusedExport.js';

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

declare global {
  // eslint-disable-next-line no-var
  var __INTERNAL_WORKER_URL__: string | undefined;
}

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
  const pool = new WorkerPool<typeof processFile>({
    name: 'processFile',
    url:
      globalThis.__INTERNAL_WORKER_URL__ ||
      new URL('./worker.js', import.meta.url).href,
  });

  const editTracker = new CliEditTracker(logger, mode, projectRoot);
  const { config, error } = ts.readConfigFile(configPath, system.readFile);

  const relativeToCwd = (fileName: string) =>
    relative(cwd(), fileName).replaceAll('\\', '/');
  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    system,
    projectRoot,
  );

  if (!error) {
    logger.write(
      `${chalk.blue('tsconfig')} ${chalk.gray('using')} ${relativeToCwd(configPath)}\n`,
    );
  }

  const fileService = new MemoryFileService();
  for (const fileName of fileNames) {
    fileService.set(fileName, system.readFile(fileName) || '');
  }

  const entrypoints = fileNames.filter((fileName) =>
    skip.some((regex) => regex.test(fileName)),
  );

  editTracker.setTotal(fileNames.length - entrypoints.length);

  logger.write(
    chalk.gray(
      `Project has ${fileNames.length} file(s), skipping ${
        entrypoints.length
      } file(s)...\n`,
    ),
  );

  await removeUnusedExport({
    fileService,
    entrypoints,
    deleteUnusedFile: true,
    enableCodeFix: true,
    editTracker,
    options,
    projectRoot,
    pool,
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

  await pool.close();

  if (mode === 'check' && !editTracker.isClean) {
    system.exit(1);
  }
};
