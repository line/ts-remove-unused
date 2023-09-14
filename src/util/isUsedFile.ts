import { Node, SourceFile } from 'ts-morph';
import { isReferredInMultipleFiles } from './isReferredInMultipleFiles.js';
import { isIgnorable, shouldIgnore } from './shouldIgnore.js';

export const isUsedFile = (file: SourceFile) => {
  let isUsed = false;

  for (const [name, declarations] of file.getExportedDeclarations().entries()) {
    if (name === 'default') {
      isUsed = true;

      break;
    }

    if (declarations.length > 1) {
      isUsed = true;

      break;
    }
    const declaration = declarations[0];

    if (
      !Node.isReferenceFindable(declaration) ||
      isReferredInMultipleFiles(declaration)
    ) {
      isUsed = true;

      break;
    }

    if (isIgnorable(declaration) && shouldIgnore(declaration)) {
      isUsed = true;

      break;
    }
  }

  return isUsed;
};
