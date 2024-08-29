import ts from 'typescript';

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
