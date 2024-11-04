import ts from 'typescript';

const resolve = ({
  specifier,
  file,
  destFiles,
  options,
}: {
  specifier: string;
  file: string;
  destFiles: Set<string>;
  options: ts.CompilerOptions;
}) =>
  ts.resolveModuleName(specifier, file, options, {
    fileExists(f) {
      return destFiles.has(f);
    },
    readFile(f) {
      throw new Error(`Unexpected readFile call: ${f}`);
    },
  }).resolvedModule?.resolvedFileName;

export const collectUsage = ({
  file,
  content,
  destFiles,
  options = {},
}: {
  file: string;
  content: string;
  destFiles: Set<string>;
  options?: ts.CompilerOptions;
}) => {
  const result: { [file: string]: string[] } = {};

  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext);

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const resolved = resolve({
        specifier: node.moduleSpecifier.text,
        destFiles,
        file,
        options,
      });

      if (!resolved) {
        return;
      }

      if (
        node.importClause?.namedBindings?.kind === ts.SyntaxKind.NamedImports
      ) {
        const namedImports = node.importClause?.namedBindings;

        namedImports.elements.forEach((element) => {
          result[resolved] ||= [];
          result[resolved].push(
            element.propertyName?.text || element.name.text,
          );
        });
      }

      // we have a default import; i.e. `import foo from './foo';`
      if (node.importClause?.name) {
        result[resolved] ||= [];
        result[resolved].push('default');
      }
    }
  };

  sourceFile.forEachChild(visit);

  return result;
};
