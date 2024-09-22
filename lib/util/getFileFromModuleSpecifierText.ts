import ts from 'typescript';
import { FileService } from './FileService.js';

export const getFileFromModuleSpecifierText = ({
  specifier,
  fileName,
  program,
  fileService,
}: {
  specifier: string;
  fileName: string;
  program: ts.Program;
  fileService: FileService;
}) =>
  ts.resolveModuleName(specifier, fileName, program.getCompilerOptions(), {
    fileExists(fileName) {
      return fileService.exists(fileName);
    },
    readFile(fileName) {
      return fileService.get(fileName);
    },
  }).resolvedModule?.resolvedFileName;
