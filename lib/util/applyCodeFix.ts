import ts from 'typescript';
import { applyTextChanges } from './applyTextChanges.js';

export const fixIdDelete = 'unusedIdentifier_delete';
export const fixIdDeleteImports = 'unusedIdentifier_deleteImports';

type FixId = typeof fixIdDelete | typeof fixIdDeleteImports;

// we don't want to remove unused positional parameters from functions
export const filterChanges = ({
  sourceFile,
  textChanges,
}: {
  sourceFile: ts.SourceFile;
  textChanges: readonly ts.TextChange[];
}) => {
  const result: { start: number; end: number }[] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) &&
      node.parameters.length > 0
    ) {
      const start = node.parameters[0]?.getStart();
      const end = node.parameters[node.parameters.length - 1]?.getEnd();

      if (typeof start === 'number' && typeof end === 'number') {
        result.push({ start, end });
      }
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return textChanges.filter((change) => {
    const start = change.span.start;
    const end = change.span.start + change.span.length;

    return !result.some((r) => r.start <= start && end <= r.end);
  });
};

export const applyCodeFix = ({
  fixId,
  languageService,
  fileName,
}: {
  fixId: FixId;
  fileName: string;
  languageService: ts.LanguageService;
}) => {
  const program = languageService.getProgram();

  if (!program) {
    throw new Error('program not found');
  }

  const sourceFile = program.getSourceFile(fileName);

  if (!sourceFile) {
    throw new Error(`source file not found: ${fileName}`);
  }

  let content = sourceFile.getFullText();

  const actions = languageService.getCombinedCodeFix(
    {
      type: 'file',
      fileName,
    },
    fixId,
    {},
    {},
  );

  for (const change of actions.changes) {
    const textChanges =
      fixId === fixIdDelete
        ? filterChanges({ sourceFile, textChanges: change.textChanges })
        : change.textChanges;
    content = applyTextChanges(content, textChanges);
  }

  return content;
};
