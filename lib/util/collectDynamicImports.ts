import ts from 'typescript';
import { getFileFromModuleSpecifierText } from './getFileFromModuleSpecifierText.js';
import { FileService } from './FileService.js';

export const collectDynamicImports = ({
  program,
  fileService,
}: {
  program: ts.Program;
  fileService: FileService;
}) => {
  const result = new Set<string>();
  const files = fileService.getFileNames();
  for (const file of files) {
    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      continue;
    }

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const file = getFileFromModuleSpecifierText({
          specifier: node.arguments[0].text,
          program,
          fileService,
          fileName: sourceFile.fileName,
        });

        if (file) {
          result.add(file);
        }

        return;
      }

      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);
  }

  return result;
};
