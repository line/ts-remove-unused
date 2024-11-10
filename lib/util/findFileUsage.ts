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
  const result = new Set<string>();

  // vertex doesn't exist when
  // - there are no imports in the entrypoint
  // - the file is unreachable from the entrypoint and has no connections between other unreachable files
  const vertex = vertexes.get(targetFile) || fallback();

  for (const fromFile of vertex.from) {
    const v = vertexes.get(fromFile) || fallback();

    const collected = parseFile({
      file: fromFile,
      content: files.get(fromFile) || '',
      destFiles: new Set(v.to),
      options,
    });

    const list = collected.imports[targetFile];

    if (!list) {
      continue;
    }

    for (const item of list) {
      if (typeof item === 'string') {
        result.add(item);
        continue;
      }

      const n = vertexes.get(item.file);

      if (!n) {
        continue;
      }

      // is entrypoint
      if (n.data.depth === 0) {
        result.add('*');
        continue;
      }

      findFileUsage({
        targetFile: item.file,
        vertexes,
        files,
        options,
      }).forEach((it) => result.add(it));
    }
  }

  return result;
};
