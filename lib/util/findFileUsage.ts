import ts from 'typescript';
import { Vertexes } from './DependencyGraph.js';
import { getFileInfo } from './getFileInfo.js';

const cache = new Map<string, ReturnType<typeof getFileInfo>>();

const memoizedGetFileInfo: typeof getFileInfo = ({
  file,
  content,
  destFiles,
  options,
}) => {
  const key = JSON.stringify({
    file,
    content,
    destFiles: Array.from(destFiles).sort(),
    options,
  });

  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const result = getFileInfo({ file, content, destFiles, options });
  cache.set(key, result);
  return result;
};

const createFallbackVertex = () => ({
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
  const vertex = vertexes.get(targetFile) || createFallbackVertex();

  for (const fromFile of vertex.from) {
    const v = vertexes.get(fromFile) || createFallbackVertex();

    const collected = memoizedGetFileInfo({
      file: fromFile,
      content: files.get(fromFile) || '',
      destFiles: new Set(v.to),
      options,
    });

    const list = collected[targetFile];

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
