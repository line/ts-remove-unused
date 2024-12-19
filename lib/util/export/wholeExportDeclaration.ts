import ts from 'typescript';

/**
 * Whole export when the file is found within the destFiles
 */
export type FileFound = {
  kind: ts.SyntaxKind.ExportDeclaration;
  type: 'whole';
  file: string;
  specifier: string;
  start: number;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
};

/**
 * Whole export when the file is not found within the destFiles, i.e. the file is not part of the project
 */
export type FileNotFound = {
  kind: ts.SyntaxKind.ExportDeclaration;
  type: 'whole';
  file: null;
  specifier: string;
  start: number;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
};

export type WholeExportDeclaration = FileFound | FileNotFound;

export const isFileFound = (
  exportDeclaration: WholeExportDeclaration,
): exportDeclaration is FileFound => exportDeclaration.file !== null;
