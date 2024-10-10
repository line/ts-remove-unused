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
  const graph = new Graph<{ depth: number }>();
  const files = new Set(fileService.getFileNames());

  const stack: { depth: number; file: string }[] = [];
  const visited = new Set<string>();

  for (const entrypoint of entrypoints) {
    stack.push({ file: entrypoint, depth: 0 });
  }

  while (stack.length > 0) {
    const item = stack.pop();

    if (!item) {
      break;
    }

    const { file, depth } = item;

    if (visited.has(file)) {
      continue;
    }

    visited.add(file);

    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      continue;
    }

    const vertex = graph.vertexes.get(file);

    if (vertex) {
      vertex.data = { depth };
    }

    const visit = (node: ts.Node) => {
      const match = getMatchingNode(node);

      if (!match) {
        node.forEachChild(visit);

        return;
      }

      if (match.specifier) {
        const dest = getFileFromModuleSpecifierText({
          specifier: match.specifier,
          program,
          fileName: sourceFile.fileName,
          fileService,
        });

        if (dest && files.has(dest)) {
          graph.addEdge(sourceFile.fileName, dest);
          stack.push({ file: dest, depth: depth + 1 });
        }

        return;
      }
    };

    sourceFile.forEachChild(visit);
  }

  for (const entrypoint of entrypoints) {
    const vertex = graph.vertexes.get(entrypoint);

    if (!vertex) {
      continue;
    }

    if (vertex.data) {
      continue;
    }

    vertex.data = { depth: 0 };
  }

  return graph;
};
