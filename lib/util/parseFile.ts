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
      // it seems that this is never called in ts.resolveModuleName so we can just throw
      throw new Error(`Unexpected readFile call: ${f}`);
    },
  }).resolvedModule?.resolvedFileName;

export const parseFile = ({
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
  const imports: {
    [file: string]: Set<string | { type: 'wholeReexport'; file: string }>;
  } = {};

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
        node.importClause?.namedBindings?.kind === ts.SyntaxKind.NamespaceImport
      ) {
        imports[resolved] ||= new Set();
        imports[resolved]?.add('*');

        return;
      }

      if (
        node.importClause?.namedBindings?.kind === ts.SyntaxKind.NamedImports
      ) {
        const namedImports = node.importClause?.namedBindings;

        namedImports.elements.forEach((element) => {
          imports[resolved] ||= new Set();
          imports[resolved]?.add(
            element.propertyName?.text || element.name.text,
          );
        });
      }

      // we have a default import; i.e. `import foo from './foo';`
      if (node.importClause?.name) {
        imports[resolved] ||= new Set();
        imports[resolved]?.add('default');
      }

      return;
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
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

      // export * as foo from './foo';
      if (node.exportClause?.kind === ts.SyntaxKind.NamespaceExport) {
        imports[resolved] ||= new Set();
        imports[resolved]?.add('*');

        return;
      }

      // export { foo, bar } from './foo';
      if (node.exportClause?.kind === ts.SyntaxKind.NamedExports) {
        const namedExports = node.exportClause;

        namedExports.elements.forEach((element) => {
          imports[resolved] ||= new Set();
          imports[resolved]?.add(
            element.propertyName?.text || element.name.text,
          );
        });

        return;
      }

      // export * from './foo';
      if (typeof node.exportClause === 'undefined') {
        imports[resolved] ||= new Set();
        imports[resolved]?.add({ type: 'wholeReexport', file });

        return;
      }

      return;
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const resolved = resolve({
        specifier: node.arguments[0].text,
        destFiles,
        file,
        options,
      });

      if (!resolved) {
        return;
      }

      imports[resolved] ||= new Set();
      imports[resolved]?.add('*');

      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return { imports };
};
