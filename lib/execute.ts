import ts from 'typescript';
import { resolve } from 'node:path';
import { MemoryFileService } from './util/MemoryFileService.js';
import { removeUnusedExport } from './util/remove.js';
import chalk from 'chalk';

export const execute = ({
  tsConfigFilePath,
  skip,
  projectRoot,
  dryRun,
  stdout = process.stdout,
  start,
}: {
  tsConfigFilePath: string;
  skip: string[];
  projectRoot: string;
  dryRun: boolean;
  stdout?: NodeJS.WriteStream;
  start?: number;
}) => {
  const { config } = ts.readConfigFile(
    resolve(projectRoot, tsConfigFilePath),
    ts.sys.readFile,
  );

  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    projectRoot,
  );

  const fileService = new MemoryFileService();
  for (const fileName of fileNames) {
    fileService.set(fileName, ts.sys.readFile(fileName) || '');
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

  stdout.write(chalk.gray(`Found ${targets.length} files...\n`));

  removeUnusedExport({
    fileService,
    targetFile: targets,
    languageService,
    deleteUnusedFile: true,
    enableCodeFix: true,
    stdout,
  });

  if (!dryRun) {
    stdout.write(chalk.gray(`Writing to disk...\n`));
  }
  for (const target of targets) {
    if (!fileService.exists(target)) {
      if (!dryRun) {
        ts.sys.deleteFile?.(target);
      }
      continue;
    }

    if (parseInt(fileService.getVersion(target), 10) > 1 && !dryRun) {
      ts.sys.writeFile(target, fileService.get(target));
    }
  }

  if (start) {
    const end = performance.now();

    stdout.write(
      chalk.gray(`Done in ${((end - start) / 1000).toFixed(2)}s!\n`),
    );
  }
};
