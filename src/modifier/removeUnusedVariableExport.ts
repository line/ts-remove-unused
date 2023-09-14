import { Node, SourceFile, ts } from 'ts-morph';

import { removeExportKeyword } from '../util/removeExportKeyword.js';
import { shouldIgnore } from '../util/shouldIgnore.js';
import { isReferredInMultipleFiles } from '../util/isReferredInMultipleFiles.js';

const listUnusedExport = (file: SourceFile) =>
  Array.from(file.getExportedDeclarations().entries()).reduce(
    (acc, [name, declarations]) => {
      if (declarations.length > 1) {
        // ignore cases where there are multiple declarations
        // ex) const a = 1, b = 2;
        return acc;
      }

      const declaration = declarations[0];

      if (Node.isVariableDeclaration(declaration)) {
        if (shouldIgnore(declaration)) {
          return acc;
        }

        if (isReferredInMultipleFiles(declaration)) {
          return acc;
        }

        if (name === 'default') {
          return acc;
        }

        const node = declaration
          .getParent()
          .getParent()
          ?.getFirstDescendantByKind(ts.SyntaxKind.ExportKeyword)?.compilerNode;

        if (node) {
          return [...acc, node];
        }
      }

      return acc;
    },
    [] as ts.Node[],
  );

export const removeUnusedVariableExport = (file: SourceFile) => {
  const unusedExports = listUnusedExport(file);

  removeExportKeyword(file, unusedExports);
};
