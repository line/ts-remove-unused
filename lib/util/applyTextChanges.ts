import ts from 'typescript';

const limitTrailingLineBreak = (value: string) => {
  const match = value.match(/\n+$/);

  if (!match) {
    return value;
  }

  if (match[0].length <= 2) {
    return value;
  }

  return `${value.slice(0, value.length - match[0].length)}\n\n`;
};

const pushClean = (list: string[], value: string) => {
  const leadingLineBreakCount = value.match(/^\n+/)?.[0].length || 0;

  if (leadingLineBreakCount === 0) {
    list.push(value);
    return;
  }

  const last = list.pop() || '';

  list.push(
    limitTrailingLineBreak(`${last}${value.slice(0, leadingLineBreakCount)}`),
    value.slice(leadingLineBreakCount),
  );
};

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
    pushClean(result, oldContent.slice(currentPos, change.span.start));

    if (change.newText) {
      pushClean(result, change.newText);
    }

    currentPos = change.span.start + change.span.length;
  }

  pushClean(result, oldContent.slice(currentPos));

  return result.join('');
};
