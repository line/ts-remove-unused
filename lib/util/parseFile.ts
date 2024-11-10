import ts from 'typescript';
import { memoize } from './memoize.js';

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

type Export =
  | {
      kind: ts.SyntaxKind.VariableStatement;
      name: string[];
    }
  | {
      kind: ts.SyntaxKind.FunctionDeclaration;
      name: string;
    }
  | {
      kind: ts.SyntaxKind.InterfaceDeclaration;
      name: string;
    }
  | {
      kind: ts.SyntaxKind.TypeAliasDeclaration;
      name: string;
    }
  | {
      kind: ts.SyntaxKind.ExportAssignment;
      name: 'default';
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      name: string[];
    }
  | {
      kind: ts.SyntaxKind.ClassDeclaration;
      name: string;
    };

const fn = ({
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
  const exports: Export[] = [];

  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.ESNext,
    true,
  );

  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );

      if (isExported) {
        const name = node.declarationList.declarations.map((d) =>
          d.name.getText(),
        );

        exports.push({
          kind: ts.SyntaxKind.VariableStatement,
          name,
        });
      }

      ts.forEachChild(node, visit);
      return;
    }

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node)
    ) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );

      if (isExported) {
        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
        ) {
          exports.push({
            kind: node.kind,
            name: 'default',
          });
        } else {
          exports.push({
            kind: node.kind,
            name: node.name?.getText() || '',
          });
        }
      }

      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isTypeAliasDeclaration(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );

      if (isExported) {
        exports.push({
          kind: node.kind,
          name: node.name.getText(),
        });
      }

      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      exports.push({
        kind: ts.SyntaxKind.ExportAssignment,
        name: 'default',
      });

      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isExportDeclaration(node)) {
      if (node.exportClause?.kind === ts.SyntaxKind.NamedExports) {
        exports.push({
          kind: ts.SyntaxKind.ExportDeclaration,
          // we always collect the name not the propertyName because its for exports
          name: node.exportClause.elements.map((element) => element.name.text),
        });
      }

      // if it includes a module specifier, it's a re-export
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
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
      }

      return;
    }

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

  return { imports, exports };
};

export const parseFile = memoize(fn, {
  key: (arg) =>
    JSON.stringify({
      file: arg.file,
      content: arg.content,
      destFiles: Array.from(arg.destFiles).sort(),
      options: arg.options,
    }),
});
