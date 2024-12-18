import ts from 'typescript';
import { Vertexes } from './DependencyGraph.js';
import { parseFile } from './parseFile.js';

const ALL_EXPORTS_OF_UNKNOWN_FILE = '__all_exports_of_unknown_file__';

const getExportsOfFile = ({
  targetFile,
  files,
  fileNames,
  options,
}: {
  targetFile: string;
  files: Map<string, string>;
  fileNames: Set<string>;
  options: ts.CompilerOptions;
}) => {
  const result: string[] = [];

  const stack = [targetFile];

  while (stack.length) {
    const item = stack.pop();

    if (!item) {
      break;
    }

    const { exports } = parseFile({
      file: item,
      content: files.get(item) || '',
      destFiles: fileNames,
      options,
    });

    exports.forEach((it) => {
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
  fileNames,
}: {
  targetFile: string;
  vertexes: Vertexes;
  files: Map<string, string>;
  fileNames: Set<string>;
  options: ts.CompilerOptions;
}) => {
  const result: string[] = [];
  const exportsOfTargetFile = getExportsOfFile({
    targetFile,
    files,
    fileNames,
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

    const { imports } = parseFile({
      file,
      content: files.get(file) || '',
      destFiles: fileNames,
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
    result.filter(
      (it) =>
        exportsOfTargetFile.has(it) || it === '*' || it === '#side-effect',
    ),
  );
};
