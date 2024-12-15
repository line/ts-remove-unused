import ts from 'typescript';

export const namespaceUsage = ({
  sourceFile,
}: {
  sourceFile: ts.SourceFile;
}) => {
  const program = createProgram({ sourceFile });
  const checker = program.getTypeChecker();

  const result = new Map<string, string[]>();

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);

      const declaration = symbol?.declarations?.find((d) => d);

      if (declaration && ts.isNamespaceImport(declaration)) {
        switch (true) {
          case ts.isNamespaceImport(node.parent): {
            // it's the import statement itself
            break;
          }
          case ts.isPropertyAccessExpression(node.parent): {
            const usage = node.parent.name.text;
            const importedNamespace = declaration.name.text;
            const prev = result.get(importedNamespace) || [];

            if (!prev.includes('*')) {
              result.set(importedNamespace, [...prev, usage]);
            }

            break;
          }
          default: {
            result.set(declaration.name.text, ['*']);
            break;
          }
        }
      }
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return {
    get(name: string) {
      return result.get(name) || [];
    },
  };
};

export const createProgram = ({
  sourceFile,
}: {
  sourceFile: ts.SourceFile;
}) => {
  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName) => {
      if (fileName === sourceFile.fileName) {
        return sourceFile;
      }

      return undefined;
    },
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    writeFile: () => {
      throw new Error('not implemented');
    },
    getCurrentDirectory: () => '/',
    fileExists: (fileName) => fileName === sourceFile.fileName,
    readFile: (fileName) =>
      fileName === sourceFile.fileName ? sourceFile.text : undefined,
    getCanonicalFileName: (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  // for now, not passing the user's ts.CompilerOptions to ts.createProgram should work
  const program = ts.createProgram([sourceFile.fileName], {}, compilerHost);

  return program;
};
