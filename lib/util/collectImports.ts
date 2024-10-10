import ts from 'typescript';
import { Graph } from './Graph.js';
import { FileService } from './FileService.js';
import { getFileFromModuleSpecifierText } from './getFileFromModuleSpecifierText.js';

const getMatchingNode = (node: ts.Node) => {
  if (ts.isImportDeclaration(node)) {
    if (ts.isStringLiteral(node.moduleSpecifier)) {
      return {
        specifier: node.moduleSpecifier.text,
      };
    }
    return {
      specifier: null,
    };
  }

  if (ts.isExportDeclaration(node)) {
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      return {
        specifier: node.moduleSpecifier.text,
      };
    }
    return {
      specifier: null,
    };
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      return {
        specifier: node.arguments[0].text,
      };
    }

    return {
      specifier: null,
    };
  }

  return null;
};

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
      const match = getMatchingNode(node);

      if (!match) {
        node.forEachChild(visit);

        return;
      }

      if (match.specifier) {
        const file = getFileFromModuleSpecifierText({
          specifier: match.specifier,
          program,
          fileName: sourceFile.fileName,
          fileService,
        });

        if (file) {
          graph.addEdge(sourceFile.fileName, file);
        }

        return;
      }
    };

    sourceFile.forEachChild(visit);
  }

  return graph;
};
