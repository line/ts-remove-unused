import ts from 'typescript';
import { Graph } from './Graph.js';
import { FileService } from './FileService.js';
import { getFileFromModuleSpecifierText } from './getFileFromModuleSpecifierText.js';

export const collectImports = ({
  fileService,
  program,
}: {
  fileService: FileService;
  program: ts.Program;
}) => {
  const graph = new Graph();
  const files = fileService.getFileNames();

  for (const file of files) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) {
      continue;
    }

    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const file = getFileFromModuleSpecifierText({
          specifier: node.moduleSpecifier.text,
          program,
          fileName: sourceFile.fileName,
          fileService,
        });

        if (file) {
          graph.addEdge(sourceFile.fileName, file);
        }

        return;
      }

      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);
  }
  return graph;
};
