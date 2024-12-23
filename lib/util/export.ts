import ts from 'typescript';

export type ClassDeclaration = {
  kind: ts.SyntaxKind.ClassDeclaration;
  name: string;
  change: {
    code: string;
    isUnnamedDefaultExport?: boolean;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type EnumDeclaration = {
  kind: ts.SyntaxKind.EnumDeclaration;
  name: string;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type ExportAssignment = {
  kind: ts.SyntaxKind.ExportAssignment;
  name: 'default';
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type FunctionDeclaration = {
  kind: ts.SyntaxKind.FunctionDeclaration;
  name: string;
  change: {
    code: string;
    isUnnamedDefaultExport?: boolean;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type InterfaceDeclaration = {
  kind: ts.SyntaxKind.InterfaceDeclaration;
  name: string;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type NameExportDeclaration = {
  kind: ts.SyntaxKind.ExportDeclaration;
  type: 'named';
  name: string[];
  skip: boolean;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
  start: number;
};

export type NamespaceExportDeclaration = {
  kind: ts.SyntaxKind.ExportDeclaration;
  type: 'namespace';
  name: string;
  start: number;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
};

export type TypeAliasDeclaration = {
  kind: ts.SyntaxKind.TypeAliasDeclaration;
  name: string;
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type VariableStatement = {
  kind: ts.SyntaxKind.VariableStatement;
  name: string[];
  change: {
    code: string;
    span: {
      start: number;
      length: number;
    };
  };
  skip: boolean;
  start: number;
};

export type NamedExport =
  | ClassDeclaration
  | EnumDeclaration
  | ExportAssignment
  | FunctionDeclaration
  | InterfaceDeclaration
  | NameExportDeclaration
  | NamespaceExportDeclaration
  | TypeAliasDeclaration
  | VariableStatement;

type WholeExportDeclarationBase = {
  kind: ts.SyntaxKind.ExportDeclaration;
  type: 'whole';
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
 * Whole export when the file is found within the destFiles
 */
export type WholeExportDeclarationWithFile = WholeExportDeclarationBase & {
  file: string;
};

/**
 * Whole export when the file is not found within the destFiles, i.e. the file is not part of the project
 */
export type WholeExportDeclarationWithoutFile = WholeExportDeclarationBase & {
  file: null;
};

export type WholeExportDeclaration =
  | WholeExportDeclarationWithFile
  | WholeExportDeclarationWithoutFile;

export const isWholeExportDeclarationWithFile = (
  exportDeclaration: WholeExportDeclaration,
): exportDeclaration is WholeExportDeclarationWithFile =>
  exportDeclaration.file !== null;

export type Export = NamedExport | WholeExportDeclaration;

export const isNamedExport = (v: Export): v is NamedExport => 'name' in v;

export const isWholeExportDeclaration = (
  v: Export,
): v is WholeExportDeclaration =>
  v.kind === ts.SyntaxKind.ExportDeclaration && v.type === 'whole';
