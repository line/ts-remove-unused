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
  entrypoints,
}: {
  fileService: FileService;
  program: ts.Program;
  entrypoints: string[];
}) => {
  const graph = new Graph();
  const files = new Set(fileService.getFileNames());

  const stack = [];
  const visited = new Set<string>();

  for (const entrypoint of entrypoints) {
    stack.push(entrypoint);
  }

  while (stack.length > 0) {
    const file = stack.pop();

    if (!file) {
      break;
    }

    if (visited.has(file)) {
      continue;
    }

    visited.add(file);

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

        if (file && files.has(file)) {
          graph.addEdge(sourceFile.fileName, file);
          stack.push(file);
        }

        return;
      }
    };

    sourceFile.forEachChild(visit);
  }

  return graph;
};
