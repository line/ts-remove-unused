import { SourceFile, ts } from 'ts-morph';

export const removeExportKeyword = (file: SourceFile, nodes: ts.Node[]) => {
  if (nodes.length === 0) {
    return;
  }

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const visitor = (node: ts.Node): ts.Node | undefined => {
        if (nodes.includes(node) && node.kind === ts.SyntaxKind.ExportKeyword) {
          return undefined;
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor);
    };
  };

  const transformedSourceFile = ts.transform(file.compilerNode, [transformer])
    .transformed[0];
  const printer = ts.createPrinter();
  const result = printer.printFile(transformedSourceFile);

  file.replaceWithText(result);
};
