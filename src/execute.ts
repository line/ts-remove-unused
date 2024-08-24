import ts from 'typescript';
import { resolve } from 'node:path';
import { FileService } from './FileService.js';
import { removeUnusedExport, removeUnusedFile } from './remove.js';
import {
  applyCodeFix,
  fixIdDelete,
  fixIdDeleteImports,
} from './applyCodeFix.js';

export const execute = ({
  tsConfigFilePath,
  skip,
  projectRoot,
  dryRun,
  stdout = process.stdout,
}: {
  tsConfigFilePath: string;
  skip: string[];
  projectRoot: string;
  dryRun: boolean;
  stdout?: NodeJS.WriteStream;
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

  const fileService = new FileService();
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

  removeUnusedFile({
    fileService,
    targetFile: targets,
    languageService,
  });

  removeUnusedExport({
    fileService,
    targetFile: targets,
    languageService,
  });

  applyCodeFix({
    fixId: fixIdDelete,
    targetFile: targets,
    languageService,
    fileService,
  });
  applyCodeFix({
    fixId: fixIdDeleteImports,
    targetFile: targets,
    languageService,
    fileService,
  });

  for (const target of targets) {
    if (!fileService.exists(target)) {
      stdout.write(`[deleted] ${target}`);
      if (!dryRun) {
        ts.sys.deleteFile?.(target);
      }
      continue;
    }

    if (parseInt(fileService.getVersion(target), 10) > 0) {
      stdout.write(`[modified] ${target}`);

      if (!dryRun) {
        ts.sys.writeFile(target, fileService.get(target));
      }
    }
  }
};
