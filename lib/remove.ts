import ts from 'typescript';
import { MemoryFileService } from './util/MemoryFileService.js';
import { removeUnusedExport } from './util/removeUnusedExport.js';
import chalk from 'chalk';
import { Logger } from './util/Logger.js';
import { stdout } from 'node:process';

const nodeJsLogger: Logger = {
  write: stdout.write.bind(stdout),
};

export const remove = ({
  configPath,
  skip,
  projectRoot,
  dryRun,
  start,
  system = ts.sys,
  logger = nodeJsLogger,
}: {
  configPath: string;
  skip: string[];
  projectRoot: string;
  dryRun: boolean;
  start?: number;
  system?: ts.System;
  logger?: Logger;
}) => {
  const { config } = ts.readConfigFile(configPath, system.readFile);

  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    system,
    projectRoot,
  );

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

  const regexList = skip.map((pattern) => new RegExp(pattern));

  const targets = fileNames.filter(
    (fileName) => !regexList.some((regex) => regex.test(fileName)),
  );

  logger.write(chalk.gray(`Found ${targets.length} files...\n`));

  removeUnusedExport({
    fileService,
    targetFile: targets,
    languageService,
    deleteUnusedFile: true,
    enableCodeFix: true,
    logger,
  });

  if (!dryRun) {
    logger.write(chalk.gray(`Writing to disk...\n`));
  }
  for (const target of targets) {
    if (!fileService.exists(target)) {
      if (!dryRun) {
        system.deleteFile?.(target);
      }
      continue;
    }

    if (parseInt(fileService.getVersion(target), 10) > 1 && !dryRun) {
      system.writeFile(target, fileService.get(target));
    }
  }

  if (start) {
    const end = performance.now();

    logger.write(
      chalk.gray(`Done in ${((end - start) / 1000).toFixed(2)}s!\n`),
    );
  }
};
