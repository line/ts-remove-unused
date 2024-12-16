import ts from 'typescript';
import { memoize } from './memoize.js';
import { namespaceUsage } from './namespaceUsage.js';

const getLeadingComment = (node: ts.Node) => {
  const fullText = node.getSourceFile().getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

  if (!ranges) {
    return '';
  }

  return ranges.map((range) => fullText.slice(range.pos, range.end)).join('');
};

const SKIP_KEYWORD = ['tsr-skip', 'ts-remove-unused-skip'] as const;

const skip = (node: ts.Node) => {
  const comment = getLeadingComment(node);

  return SKIP_KEYWORD.some((keyword) => comment.includes(keyword));
};

// ref. https://github.com/microsoft/TypeScript/blob/d701d908d534e68cfab24b6df15539014ac348a3/src/compiler/utilities.ts#L2048
const isGlobalScopeAugmentation = (module: ts.ModuleDeclaration) =>
  !!(module.flags & ts.NodeFlags.GlobalAugmentation);

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

const getChange = (
  node:
    | ts.VariableStatement
    | ts.FunctionDeclaration
    | ts.InterfaceDeclaration
    | ts.ClassDeclaration
    | ts.TypeAliasDeclaration
    | ts.ExportDeclaration
    | ts.ExportAssignment
    | ts.EnumDeclaration,
) => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
    return {
      code: node.getFullText(),
      span: {
        start: node.getFullStart(),
        length: node.getFullWidth(),
      },
    };
  }

  if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    !node.name
  ) {
    // when the name is not found, it's likely a default export of an unnamed function/class declaration.
    // in this case, we want to remove the whole declaration
    return {
      code: node.getFullText(),
      isUnnamedDefaultExport: true,
      span: {
        start: node.getFullStart(),
        length: node.getFullWidth(),
      },
    };
  }

  /**
   * The syntax list contains the keywords that can be found before the actual declaration.
   * We want to remove everything that is not a decorator.
   */
  const syntaxListIndex = node
    .getChildren()
    .findIndex((n) => n.kind === ts.SyntaxKind.SyntaxList);

  const syntaxList = node.getChildren()[syntaxListIndex];

  if (!syntaxList) {
    throw new Error('syntaxlist missing');
  }

  const firstKeywordToDeleteIndex = syntaxList
    .getChildren()
    .findIndex((n) => n.kind !== ts.SyntaxKind.Decorator);

  const firstKeywordToDelete =
    syntaxList.getChildren()[firstKeywordToDeleteIndex];

  if (!firstKeywordToDelete) {
    throw new Error(
      'Unexpected syntax list when looking for keywords after decorators',
    );
  }

  const nextSibling = node.getChildren()[syntaxListIndex + 1];

  if (!nextSibling) {
    throw new Error('No sibling after syntax list');
  }

  return {
    code: node
      .getSourceFile()
      .getFullText()
      .slice(firstKeywordToDelete.getStart(), nextSibling.getStart()),
    span: {
      start: firstKeywordToDelete.getStart(),
      length: nextSibling.getStart() - firstKeywordToDelete.getStart(),
    },
  };
};

type Export =
  | {
      kind: ts.SyntaxKind.VariableStatement;
      name: string[];
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    }
  | {
      kind: ts.SyntaxKind.FunctionDeclaration;
      name: string;
      change: {
        code: string;
        isUnnamedDefaultExport?: boolean;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    }
  | {
      kind: ts.SyntaxKind.InterfaceDeclaration;
      name: string;
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    }
  | {
      kind: ts.SyntaxKind.TypeAliasDeclaration;
      name: string;
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    }
  | {
      kind: ts.SyntaxKind.ExportAssignment;
      name: 'default';
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      type: 'named';
      name: string[];
      skip: boolean;
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
      start: number;
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      type: 'namespace';
      name: string;
      start: number;
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
    }
  | {
      kind: ts.SyntaxKind.ExportDeclaration;
      type: 'whole';
      // will be null if the file is not found within the destFiles, i.e. the file is not part of the project
      file: string | null;
      specifier: string;
      start: number;
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
    }
  | {
      kind: ts.SyntaxKind.ClassDeclaration;
      name: string;
      change: {
        code: string;
        isUnnamedDefaultExport?: boolean;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    }
  | {
      kind: ts.SyntaxKind.EnumDeclaration;
      name: string;
      change: {
        code: string;
        span: {
          start: number;
          length: number;
        };
      };
      skip: boolean;
      start: number;
    };

type AmbientDeclaration = {
  kind: ts.SyntaxKind.ModuleDeclaration;
};

const collectName = (node: ts.BindingName): string[] => {
  if (ts.isIdentifier(node)) {
    return [node.getText()];
  }

  if (ts.isObjectBindingPattern(node)) {
    return node.elements.flatMap((element) => collectName(element.name));
  }

  if (ts.isArrayBindingPattern(node)) {
    return node.elements.flatMap((element) =>
      ts.isOmittedExpression(element) ? [] : collectName(element.name),
    );
  }

  return [];
};

const findDynamicImports = ({
  destFiles,
  sourceFile,
  file,
  options,
}: {
  destFiles: Set<string>;
  sourceFile: ts.SourceFile;
  file: string;
  options: ts.CompilerOptions;
}) => {
  const result: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const resolved = resolve({
          specifier: node.arguments[0].text,
          destFiles,
          file,
          options,
        });

        if (!resolved) {
          return;
        }

        result.push(resolved);
      }

      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);
  return result;
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
  const ambientDeclarations: AmbientDeclaration[] = [];

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
        const name = node.declarationList.declarations.flatMap((d) =>
          collectName(d.name),
        );

        exports.push({
          kind: ts.SyntaxKind.VariableStatement,
          name,
          change: getChange(node),
          skip: skip(node),
          start: node.getStart(),
        });
      }

      return;
    }

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node)
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
            change: getChange(node),
            skip: skip(node),
            start: node.getStart(),
          });
        } else {
          exports.push({
            kind: node.kind,
            name: node.name?.getText() || '',
            change: getChange(node),
            skip: skip(node),
            start: node.getStart(),
          });
        }
      }

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
          change: getChange(node),
          skip: skip(node),
          start: node.getStart(),
        });
      }

      return;
    }

    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      exports.push({
        kind: ts.SyntaxKind.ExportAssignment,
        name: 'default',
        change: getChange(node),
        skip: skip(node),
        start: node.getStart(),
      });

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
        change: getChange(node),
        skip: skip(node),
        start: node.getStart(),
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
        change: getChange(node),
        skip: false,
        start: node.getStart(),
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
        start: node.getStart(),
        change: getChange(node),
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
        specifier: node.moduleSpecifier.text,
        start: node.getStart(),
        change: getChange(node),
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
        const usage = namespaceUsage({ sourceFile });
        imports[resolved]?.push(
          ...usage.get(node.importClause.namedBindings.name.text),
        );

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

    if (ts.isModuleDeclaration(node)) {
      // is ambient module
      // ref. https://github.com/microsoft/TypeScript/blob/d701d908d534e68cfab24b6df15539014ac348a3/src/compiler/utilities.ts#L2002
      if (
        node.name.kind === ts.SyntaxKind.StringLiteral ||
        isGlobalScopeAugmentation(node)
      ) {
        ambientDeclarations.push({
          kind: ts.SyntaxKind.ModuleDeclaration,
        });

        return;
      }

      return;
    }

    return;
  };

  sourceFile.forEachChild(visit);

  if (content.includes('import(')) {
    findDynamicImports({
      destFiles,
      file,
      sourceFile,
      options,
    }).forEach((resolved) => {
      imports[resolved] ||= [];
      imports[resolved]?.push('*');
    });
  }

  return { imports, exports, ambientDeclarations };
};

export const parseFile = memoize(fn, {
  key: (arg) =>
    `${arg.file}::${arg.content}::${key(arg.destFiles)}::${arg.options ? key(arg.options) : ''}`,
});

const weakMap = new WeakMap<object, number>();
let current = 0;

const key = (obj: object) => {
  if (weakMap.has(obj)) {
    return weakMap.get(obj)!;
  }

  current++;
  weakMap.set(obj, current);
  return current;
};
