import ts from 'typescript';
import { FileService } from './FileService.js';
import { getFileFromModuleSpecifierText } from './getFileFromModuleSpecifierText.js';
import { DependencyGraph } from './DependencyGraph.js';

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
      const result = {
        type: 'reexport' as const,
        specifier: node.moduleSpecifier.text,
        whole: !node.exportClause,
      };

      return result;
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
  const graph = new DependencyGraph();
  const files = new Set(fileService.getFileNames());

  const stack: { depth: number; file: string }[] = [];
  const untouched = new Set(fileService.getFileNames());

  const wholeReexportSpecifiers: {
    file: string;
    dest: string;
    specifier: string;
  }[] = [];

  for (const entrypoint of entrypoints) {
    stack.push({ file: entrypoint, depth: 0 });
  }

  while (stack.length > 0) {
    const item = stack.pop();

    if (!item) {
      break;
    }

    const { file, depth } = item;

    if (!untouched.has(file)) {
      continue;
    }

    untouched.delete(file);

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
        const dest = getFileFromModuleSpecifierText({
          specifier: match.specifier,
          program,
          fileName: sourceFile.fileName,
          fileService,
        });

        if (match.type === 'reexport' && dest && match.whole) {
          // we delay recording the whole reexport specifier until we have traversed the whole graph
          // since we don't know if the vertex exists yet
          wholeReexportSpecifiers.push({
            file,
            dest,
            specifier: match.specifier,
          });
        }

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
      vertex.data.depth = depth;
    }
  }

  for (const file of untouched.values()) {
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
        const dest = getFileFromModuleSpecifierText({
          specifier: match.specifier,
          program,
          fileName: sourceFile.fileName,
          fileService,
        });

        if (match.type === 'reexport' && dest && match.whole) {
          // we delay recording the whole reexport specifier until we have traversed the whole graph
          // since we don't know if the vertex exists yet
          wholeReexportSpecifiers.push({
            file,
            dest,
            specifier: match.specifier,
          });
        }

        if (dest && files.has(dest)) {
          graph.addEdge(sourceFile.fileName, dest);
        }

        return;
      }
    };

    sourceFile.forEachChild(visit);

    const vertex = graph.vertexes.get(file);

    if (vertex) {
      vertex.data.depth = Infinity;
    }
  }

  for (const item of wholeReexportSpecifiers) {
    graph.vertexes
      .get(item.file)
      ?.data.wholeReexportSpecifier.set(item.dest, item.specifier);
  }

  return graph;
};
