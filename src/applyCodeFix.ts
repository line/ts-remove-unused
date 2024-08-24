import ts from 'typescript';
import { FileService } from './FileService.js';

export const fixIdDelete = 'unusedIdentifier_delete';
export const fixIdDeleteImports = 'unusedIdentifier_deleteImports';

type FixId = typeof fixIdDelete | typeof fixIdDeleteImports;

export const applyTextChanges = (
  oldContent: string,
  changes: readonly ts.TextChange[],
) => {
  const result: string[] = [];

  const sortedChanges = [...changes].sort(
    (a, b) => a.span.start - b.span.start,
  );

  let currentPos = 0;

  for (const change of sortedChanges) {
    result.push(oldContent.slice(currentPos, change.span.start));
    result.push(change.newText);

    currentPos = change.span.start + change.span.length;
  }

  result.push(oldContent.slice(currentPos));

  return result.join('');
};

export const applyCodeFix = ({
  fixId,
  languageService,
  targetFile,
  fileService,
}: {
  fixId: FixId;
  languageService: ts.LanguageService;
  targetFile: string | string[];
  fileService: FileService;
}) => {
  const program = languageService.getProgram();

  if (!program) {
    throw new Error('program not found');
  }

  for (const file of Array.isArray(targetFile) ? targetFile : [targetFile]) {
    const sourceFile = program.getSourceFile(file);

    if (!sourceFile) {
      continue;
    }

    const actions = languageService.getCombinedCodeFix(
      {
        type: 'file',
        fileName: file,
      },
      fixId,
      {},
      {},
    );

    for (const change of actions.changes) {
      fileService.set(
        change.fileName,
        applyTextChanges(fileService.get(change.fileName), change.textChanges),
      );
    }
  }
};
