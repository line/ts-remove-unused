import { Project } from 'ts-morph';
import { removeUnusedFunctionExport } from './modifier/removeUnusedFunctionExport.js';
import { removeUnusedInterfaceExport } from './modifier/removeUnusedInterfaceExport.js';
import { removeUnusedTypeExport } from './modifier/removeUnusedTypeExport.js';
import { removeUnusedVariableExport } from './modifier/removeUnusedVariableExport.js';
import { isUsedFile } from './util/isUsedFile.js';

export const execute = ({
  tsConfigFilePath,
  skip,
}: {
  tsConfigFilePath: string;
  skip: string[];
}) => {
  const project = new Project({
    tsConfigFilePath,
  });
  const files = project.getSourceFiles().filter((file) => {
    const path = file.getFilePath();

    if (skip.some((pattern) => new RegExp(pattern).test(path))) {
      return false;
    }

    return true;
  });

  files.forEach((file, i) => {
    const path = file.getFilePath();

    if (isUsedFile(file)) {
      removeUnusedFunctionExport(file);
      removeUnusedVariableExport(file);
      removeUnusedInterfaceExport(file);
      removeUnusedTypeExport(file);

      let lastWidth: number;
      do {
        lastWidth = file.getFullWidth();
        file.fixUnusedIdentifiers();
      } while (lastWidth !== file.getFullWidth());
    } else {
      file.delete();
    }

    console.log(`${i + 1}/${files.length}: ${path}`);
  });

  project.save();
};
