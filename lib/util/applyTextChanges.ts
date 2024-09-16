import ts from 'typescript';

const regex = /\n{2,}$/;

const pushClean = (list: string[], value: string) => {
  if (value === '') {
    return;
  }

  const count = value.match(/^\n+/)?.[0].length || 0;

  if (count === 0) {
    list.push(value);

    return;
  }

  const last = list.pop() || '';

  list.push(`${last}${value.slice(0, count)}`.replace(regex, '\n\n'));

  const rest = value.slice(count);

  if (rest) {
    list.push(rest);
  }
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
    pushClean(result, change.newText);

    currentPos = change.span.start + change.span.length;
  }

  pushClean(result, oldContent.slice(currentPos));

  return result
    .join('')
    .replace(/^\n+/, '')
    .replace(/\n{1,}$/, '\n');
};
