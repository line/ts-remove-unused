import ts from 'typescript';
import { MemoryFileService } from '../../lib/util/MemoryFileService.js';

export const setup = () => {
  const fileService = new MemoryFileService();

  const languageService = ts.createLanguageService({
    getCompilationSettings() {
      return {};
    },
    getScriptFileNames() {
      return Array.from(fileService.getFileNames());
    },
    getScriptVersion(fileName) {
      return fileService.getVersion(fileName);
    },
    getScriptSnapshot(fileName) {
      return ts.ScriptSnapshot.fromString(fileService.get(fileName));
    },
    getCurrentDirectory: () => '.',

    getDefaultLibFileName(options) {
      return ts.getDefaultLibFileName(options);
    },
    fileExists: (name) => fileService.exists(name),
    readFile: (name) => fileService.get(name),
  });

  return { languageService, fileService };
};
