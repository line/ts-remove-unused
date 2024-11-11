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

const getExportKeywordPosition = (
  node:
    | ts.VariableStatement
    | ts.FunctionDeclaration
    | ts.InterfaceDeclaration
    | ts.ClassDeclaration
    | ts.TypeAliasDeclaration,
) => {
  if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    !node.name
  ) {
    // when the name is not found, it's likely a default export of an unnamed function/class declaration.
    // in this case, we want to remove the whole declaration
    return {
      start: node.getFullStart(),
      length: node.getFullWidth(),
    };
  }

  // we want to correctly remove 'default' when its a default export so we get the syntaxList node instead of the exportKeyword node
  // note: the first syntaxList node should contain the export keyword
  const syntaxListIndex = node
    .getChildren()
    .findIndex((n) => n.kind === ts.SyntaxKind.SyntaxList);

  const syntaxList = node.getChildren()[syntaxListIndex];
  const nextSibling = node.getChildren()[syntaxListIndex + 1];

  if (!syntaxList || !nextSibling) {
    throw new Error('Unexpected syntax');
  }

  return {
    start: syntaxList.getStart(),
    length: nextSibling.getStart() - syntaxList.getStart(),
  };
};

type Export =
  | {
      kind: ts.SyntaxKind.VariableStatement;
      name: string[];
      deleteSpan: {
        start: number;
        length: number;
      };
    }
  | {
      kind: ts.SyntaxKind.FunctionDeclaration;
      name: string;
      deleteSpan: {
        start: number;
        length: number;
      };
    }
  | {
      kind: ts.SyntaxKind.InterfaceDeclaration;
      name: string;
      deleteSpan: {
        start: number;
        length: number;
      };
    }
  | {
      kind: ts.SyntaxKind.TypeAliasDeclaration;
      name: string;
      deleteSpan: {
        start: number;
        length: number;
      };
    }
  | {
      kind: ts.SyntaxKind.ExportAssignment;
      name: 'default';
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      type: 'named';
      name: string[];
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      type: 'namespace';
      name: string;
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      type: 'whole';
      // will be null if the file is not found within the destFiles, i.e. the file is not part of the project
      file: string | null;
    }
  | {
      kind: ts.SyntaxKind.ClassDeclaration;
      name: string;
      deleteSpan: {
        start: number;
        length: number;
      };
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
    [file: string]: (string | { type: 'wholeReexport'; file: string })[];
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
          deleteSpan: getExportKeywordPosition(node),
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
            deleteSpan: getExportKeywordPosition(node),
          });
        } else {
          exports.push({
            kind: node.kind,
            name: node.name?.getText() || '',
            deleteSpan: getExportKeywordPosition(node),
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
          deleteSpan: getExportKeywordPosition(node),
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

    // export { foo };
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause?.kind === ts.SyntaxKind.NamedExports &&
      !node.moduleSpecifier
    ) {
      exports.push({
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'named',
        // we always collect the name not the propertyName because its for exports
        name: node.exportClause.elements.map((element) => element.name.text),
      });

      return;
    }

    // export { foo } from './foo';
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause?.kind === ts.SyntaxKind.NamedExports &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      exports.push({
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'named',
        // we always collect the name not the propertyName because its for exports
        name: node.exportClause.elements.map((element) => element.name.text),
      });

      const resolved = resolve({
        specifier: node.moduleSpecifier.text,
        destFiles,
        file,
        options,
      });

      if (resolved) {
        imports[resolved] ||= [];
        node.exportClause.elements.forEach((element) => {
          imports[resolved] ||= [];
          imports[resolved]?.push(
            element.propertyName?.text || element.name.text,
          );
        });
      }

      return;
    }

    // export * as foo from './foo';
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause?.kind === ts.SyntaxKind.NamespaceExport &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      exports.push({
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'namespace',
        name: node.exportClause.name.text,
      });

      const resolved = resolve({
        specifier: node.moduleSpecifier.text,
        destFiles,
        file,
        options,
      });

      if (resolved) {
        imports[resolved] ||= [];
        imports[resolved]?.push('*');
      }

      return;
    }

    // export * from './foo';
    if (
      ts.isExportDeclaration(node) &&
      !node.exportClause &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const resolved = resolve({
        specifier: node.moduleSpecifier.text,
        destFiles,
        file,
        options,
      });

      exports.push({
        kind: ts.SyntaxKind.ExportDeclaration,
        type: 'whole',
        file: resolved || null,
      });

      if (resolved) {
        imports[resolved] ||= [];
        imports[resolved]?.push({ type: 'wholeReexport', file });
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
        imports[resolved] ||= [];
        imports[resolved]?.push('*');

        return;
      }

      if (
        node.importClause?.namedBindings?.kind === ts.SyntaxKind.NamedImports
      ) {
        const namedImports = node.importClause?.namedBindings;

        namedImports.elements.forEach((element) => {
          imports[resolved] ||= [];
          imports[resolved]?.push(
            element.propertyName?.text || element.name.text,
          );
        });
      }

      // we have a default import; i.e. `import foo from './foo';`
      if (node.importClause?.name) {
        imports[resolved] ||= [];
        imports[resolved]?.push('default');
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

      imports[resolved] ||= [];
      imports[resolved]?.push('*');

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
