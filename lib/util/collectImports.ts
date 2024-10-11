import ts from 'typescript';
import { Graph } from './Graph.js';
import { FileService } from './FileService.js';
import { getFileFromModuleSpecifierText } from './getFileFromModuleSpecifierText.js';

const getMatchingNode = (node: ts.Node) => {
  if (ts.isImportDeclaration(node)) {
    if (ts.isStringLiteral(node.moduleSpecifier)) {
      return {
        type: 'import' as const,
        specifier: node.moduleSpecifier.text,
      };
    }
    return {
      type: 'import' as const,
      specifier: null,
    };
  }

  if (ts.isExportDeclaration(node)) {
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      return {
        type: 'reexport' as const,
        specifier: node.moduleSpecifier.text,
      };
    }
    return {
      type: 'reexport' as const,
      specifier: null,
    };
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      return {
        type: 'dynamicImport' as const,
        specifier: node.arguments[0].text,
      };
    }

    return {
      type: 'dynamicImport' as const,
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
  const graph = new Graph({ depth: 0, hasReexport: false });
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

    let hasReexport = false;

    const visit = (node: ts.Node) => {
      const match = getMatchingNode(node);

      if (!match) {
        node.forEachChild(visit);

        return;
      }

      if (match.specifier) {
        if (match.type === 'reexport') {
          hasReexport = true;
        }

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

    const vertex = graph.vertexes.get(file);

    if (vertex) {
      vertex.data = { hasReexport, depth };
    }
  }

  return graph;
};
