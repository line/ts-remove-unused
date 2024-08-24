import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { FileService } from '../src/FileService.js';
import { removeExport } from '../src/removeExport.js';

const fixIdDelete = 'unusedIdentifier_delete';
const fixIdDeleteImports = 'unusedIdentifier_deleteImports';

type FixId = typeof fixIdDelete | typeof fixIdDeleteImports;

const applyTextChanges = (
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

const applyCodeFix = ({
  fixId,
  languageService,
  fileName,
  fileService,
}: {
  fixId: FixId;
  languageService: ts.LanguageService;
  fileName: string;
  fileService: FileService;
}) => {
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
    fileService.set(
      change.fileName,
      applyTextChanges(fileService.get(change.fileName), change.textChanges),
    );
  }
};

describe('cli', () => {
  const setup = () => {
    const fileService = new FileService();

    const languageService = ts.createLanguageService({
      getCompilationSettings() {
        return {};
      },
      getScriptFileNames() {
        return fileService.getFileNames();
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getScriptVersion(fileName) {
        return fileService.getVersion(fileName);
      },
      getScriptSnapshot(fileName) {
        return ts.ScriptSnapshot.fromString(fileService.get(fileName));
      },
      getCurrentDirectory: () => '.',

      getDefaultLibFileName(options) {
        return ts.getDefaultLibFileName(options);
      },
      fileExists: (name) => fileService.exists(name),
      readFile: (name) => fileService.get(name),
    });

    return { languageService, fileService };
  };

  it('should remove the export keyword', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      'main.ts',
      `import { add } from './util/operations.js';
              export const main = () => {};
            `,
    );

    fileService.set(
      'util/operations.ts',
      `export const add = (a: number, b: number) => a + b;
              export const subtract = (a: number, b: number) => a - b;
              const multiply = (a: number, b: number) => a * b;
              export const divide = (a: number, b: number) => a / b;
              `,
    );

    removeExport({
      fileService,
      targetFile: 'util/operations.ts',
      languageService,
    });

    const content = fileService.get('util/operations.ts');

    assert.equal(content.match(/export/g)?.length, 1);
  });

  it('should clean up unused identifiers', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      'main.ts',
      `import { add } from './util/operations.js';
              const main = () => {};
            `,
    );

    fileService.set(
      'util/operations.ts',
      `export const add = (a: number, b: number) => a + b;
            const subtract = (a: number, b: number) => a - b;
            const multiply = (a: number, b: number) => a * b;
            const divide = (a: number, b: number) => a / b;
              `,
    );

    applyCodeFix({
      fixId: fixIdDelete,
      languageService,
      fileService,
      fileName: 'util/operations.ts',
    });

    assert.equal(
      fileService.get('util/operations.ts').trim(),
      'export const add = (a: number, b: number) => a + b;',
    );
  });

  it('should clean up unused imports', () => {
    const { languageService, fileService } = setup();
    fileService.set(
      'main.ts',
      `import { add } from './util/operations.js';
        `,
    );

    fileService.set(
      'util/operations.ts',
      `import { readFileSync } from 'node:fs';
        export const add = (a: number, b: number) => a + b;
`,
    );

    applyCodeFix({
      fixId: fixIdDeleteImports,
      languageService,
      fileService,
      fileName: 'util/operations.ts',
    });

    assert.equal(
      fileService.get('util/operations.ts').trim(),
      'export const add = (a: number, b: number) => a + b;',
    );
  });
});
