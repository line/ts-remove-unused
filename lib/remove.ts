import ts from 'typescript';
import { MemoryFileService } from './util/MemoryFileService.js';
import { removeUnusedExport } from './util/removeUnusedExport.js';
import chalk from 'chalk';
import { Logger } from './util/Logger.js';
import { cwd, stdout } from 'node:process';
import { CliEditTracker } from './util/CliEditTracker.js';
import { relative } from 'node:path';

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

export const remove = ({
  configPath,
  skip,
  projectRoot,
  mode,
  system = ts.sys,
  logger = createNodeJsLogger(),
}: {
  configPath: string;
  skip: RegExp[];
  projectRoot: string;
  mode: 'check' | 'write';
  system?: ts.System;
  logger?: Logger;
}) => {
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
      `${chalk.blue('tsconfig')} ${chalk.gray('using')} ${relativeToCwd(configPath)}\n\n`,
    );
  }

  const fileService = new MemoryFileService();
  for (const fileName of fileNames) {
    fileService.set(fileName, system.readFile(fileName) || '');
  }

  const languageService = ts.createLanguageService({
    getCompilationSettings() {
      return options;
    },
    getScriptFileNames() {
      return fileService.getFileNames();
    },
    getScriptVersion(fileName) {
      return fileService.getVersion(fileName);
    },
    getScriptSnapshot(fileName) {
      return ts.ScriptSnapshot.fromString(fileService.get(fileName));
    },
    getCurrentDirectory: () => projectRoot,
    getDefaultLibFileName(options) {
      return ts.getDefaultLibFileName(options);
    },
    fileExists(name) {
      return fileService.exists(name);
    },
    readFile(name) {
      return fileService.get(name);
    },
  });

  const targets = fileNames.filter(
    (fileName) => !skip.some((regex) => regex.test(fileName)),
  );

  editTracker.setTotal(targets.length);

  logger.write(
    chalk.gray(
      `Found ${targets.length} file(s), skipping ${
        fileNames.length - targets.length
      } file(s)...\n\n`,
    ),
  );

  removeUnusedExport({
    fileService,
    targetFile: targets,
    languageService,
    deleteUnusedFile: true,
    enableCodeFix: true,
    editTracker,
  });

  editTracker.clearProgressOutput();

  if (mode === 'write') {
    logger.write(chalk.gray(`Writing to disk...\n`));
  }

  for (const target of targets) {
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
