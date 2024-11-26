import ts from 'typescript';
import { FileService } from './FileService.js';

export const createProgram = ({
  fileService,
  options,
  projectRoot,
}: {
  fileService: FileService;
  options: ts.CompilerOptions;
  projectRoot: string;
}) => {
  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (!fileService.exists(fileName)) {
        return undefined;
      }

      return ts.createSourceFile(
        fileName,
        fileService.get(fileName),
        languageVersion,
      );
    },
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    writeFile: (fileName, content) => {
      fileService.set(fileName, content);
    },
    getCurrentDirectory: () => projectRoot,
    fileExists: (fileName) => fileService.exists(fileName),
    readFile: (fileName) => fileService.get(fileName),
    getCanonicalFileName: (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  const program = ts.createProgram(
    Array.from(fileService.getFileNamesSet()),
    options,
    compilerHost,
  );

  return program;
};
