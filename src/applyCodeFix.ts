import ts from 'typescript';
import { FileService } from './FileService.js';
import { applyTextChanges } from './util/applyTextChanges.js';

export const fixIdDelete = 'unusedIdentifier_delete';
export const fixIdDeleteImports = 'unusedIdentifier_deleteImports';

type FixId = typeof fixIdDelete | typeof fixIdDeleteImports;

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
