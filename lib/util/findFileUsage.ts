import ts from 'typescript';
import { Vertexes } from './DependencyGraph.js';
import { parseFile } from './parseFile.js';

const fallback = () => ({
  from: new Set<string>(),
  to: new Set<string>(),
  data: {
    depth: Infinity,
    wholeReexportSpecifier: new Map<string, string>(),
  },
});

const ALL_EXPORTS_OF_UNKNOWN_FILE = '__all_exports_of_unknown_file__';

const getExportsOfFile = ({
  targetFile,
  vertexes,
  files,
  options,
}: {
  targetFile: string;
  vertexes: Vertexes;
  files: Map<string, string>;
  options: ts.CompilerOptions;
}) => {
  const result: string[] = [];

  const stack = [targetFile];

  while (stack.length) {
    const item = stack.pop();

    if (!item) {
      break;
    }

    const vertex = vertexes.get(item) || fallback();

    const { exports } = parseFile({
      file: item,
      content: files.get(item) || '',
      destFiles: new Set(vertex.to),
      options,
    });

    exports.forEach((it) => {
      if (it.kind === ts.SyntaxKind.ModuleDeclaration) {
        return;
      }

      if (it.kind === ts.SyntaxKind.ExportDeclaration && it.type === 'whole') {
        if (it.file) {
          stack.push(it.file);
        } else {
          // unknown file
          result.push(ALL_EXPORTS_OF_UNKNOWN_FILE);
        }

        return;
      }

      result.push(...(Array.isArray(it.name) ? it.name : [it.name]));
    });
  }

  return new Set(result);
};

export const findFileUsage = ({
  targetFile,
  options,
  vertexes,
  files,
}: {
  targetFile: string;
  vertexes: Vertexes;
  files: Map<string, string>;
  options: ts.CompilerOptions;
}) => {
  const result: string[] = [];
  const exportsOfTargetFile = getExportsOfFile({
    targetFile,
    vertexes,
    files,
    options,
  });
  const stack: { file: string; to: string }[] = [];
  vertexes.get(targetFile)?.from.forEach((file) =>
    stack.push({
      file,
      to: targetFile,
    }),
  );

  while (stack.length) {
    const item = stack.pop()!;

    if (!item) {
      break;
    }

    const { file, to } = item;

    const vertex = vertexes.get(file) || fallback();

    const { imports } = parseFile({
      file,
      content: files.get(file) || '',
      destFiles: new Set(vertex.to),
      options,
    });

    const list = imports[to] || [];

    list.forEach((it) => {
      if (typeof it === 'object' && it.type === 'wholeReexport') {
        const n = vertexes.get(it.file);

        if (!n) {
          return;
        }

        // is entrypoint
        if (n.data.depth === 0) {
          result.push('*');
          return;
        }

        vertexes.get(it.file)?.from.forEach((f) => {
          stack.push({
            file: f,
            to: it.file,
          });
        });
        return;
      }

      if (typeof it === 'string') {
        result.push(it);
        return;
      }
    });
  }

  if (exportsOfTargetFile.has(ALL_EXPORTS_OF_UNKNOWN_FILE)) {
    return new Set(result);
  }

  return new Set(
    result.filter((it) => exportsOfTargetFile.has(it) || it === '*'),
  );
};
