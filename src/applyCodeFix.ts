import ts from 'typescript';
import { applyTextChanges } from './util/applyTextChanges.js';

export const fixIdDelete = 'unusedIdentifier_delete';
export const fixIdDeleteImports = 'unusedIdentifier_deleteImports';

type FixId = typeof fixIdDelete | typeof fixIdDeleteImports;

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
    content = applyTextChanges(content, change.textChanges);
  }

  return content;
};
