import ts from 'typescript';

import { NamedExport } from './export/namedExport.js';
import { WholeExportDeclaration } from './export/wholeExportDeclaration.js';

export * as NamedExport from './export/namedExport.js';
export * as WholeExportDeclaration from './export/wholeExportDeclaration.js';

export type Export = NamedExport | WholeExportDeclaration;

export const isNamedExport = (v: Export): v is NamedExport => 'name' in v;

export const isWholeExportDeclaration = (
  v: Export,
): v is WholeExportDeclaration =>
  v.kind === ts.SyntaxKind.ExportDeclaration && v.type === 'whole';
