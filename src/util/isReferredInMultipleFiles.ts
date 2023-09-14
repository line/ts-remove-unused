import { ReferenceFindableNode } from 'ts-morph';

export const isReferredInMultipleFiles = (declaration: ReferenceFindableNode) =>
  declaration.findReferences().length !== 1;
