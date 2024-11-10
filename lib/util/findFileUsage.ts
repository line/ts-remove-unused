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

const getUsed = ({
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
  const stack: { file: string; to: string }[] = [];
  vertexes
    .get(targetFile)
    ?.from.forEach((file) => stack.push({ file, to: targetFile }));

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
          stack.push({ file: f, to: it.file });
        });
        return;
      }

      if (typeof it === 'string') {
        result.push(it);
        return;
      }
    });
  }

  return result;
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
  const used = getUsed({ targetFile, options, vertexes, files });
  return new Set(used);
};
