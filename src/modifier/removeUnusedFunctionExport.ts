import { Node, SourceFile } from 'ts-morph';
import { shouldIgnore } from '../util/shouldIgnore.js';
import { isReferredInMultipleFiles } from '../util/isReferredInMultipleFiles.js';

export const removeUnusedFunctionExport = (file: SourceFile) => {
  file.getExportedDeclarations().forEach((declarations, name) => {
    if (declarations.length > 1) {
      // ignore cases where there are multiple declarations
      // ex) const a = 1, b = 2;
      return;
    }

    const declaration = declarations[0];

    if (Node.isFunctionDeclaration(declaration)) {
      if (isReferredInMultipleFiles(declaration)) {
        return;
      }

      if (shouldIgnore(declaration)) {
        return;
      }

      if (name === 'default') {
        return;
      }

      declaration.setIsExported(false);
    }
  });
};
