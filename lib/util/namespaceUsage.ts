import ts from 'typescript';

export const namespaceUsage = ({
  sourceFile,
}: {
  sourceFile: ts.SourceFile;
}) => {
  console.log('sourceFile', sourceFile);
  return {
    get(_: string): '*' | string[] {
      return '*';
    },
  };
};
