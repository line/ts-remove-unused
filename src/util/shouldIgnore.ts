import {
  FunctionDeclaration,
  InterfaceDeclaration,
  Node,
  TypeAliasDeclaration,
  VariableDeclaration,
} from 'ts-morph';

export const IGNORE_COMMENT = 'ts-remove-unused-skip';

const getTarget = (
  declaration:
    | VariableDeclaration
    | TypeAliasDeclaration
    | InterfaceDeclaration
    | FunctionDeclaration,
) => {
  if (Node.isVariableDeclaration(declaration)) {
    return declaration.getParent().getParent();
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return declaration;
  }

  if (Node.isInterfaceDeclaration(declaration)) {
    return declaration;
  }

  if (Node.isFunctionDeclaration(declaration)) {
    return declaration;
  }

  throw new Error(
    `unexpected declaration of type ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (declaration satisfies never as any).getType()
    }`,
  );
};

export const shouldIgnore = (
  declaration:
    | VariableDeclaration
    | TypeAliasDeclaration
    | InterfaceDeclaration
    | FunctionDeclaration,
) => {
  const comments = getTarget(declaration)
    .getLeadingCommentRanges()
    .map((comment) => comment.getText());

  const hasIgnoreComment = !!comments?.some((comment) =>
    comment.split(/\s/).includes(IGNORE_COMMENT),
  );

  return hasIgnoreComment;
};

export const isIgnorable = (
  node: Node,
): node is
  | VariableDeclaration
  | TypeAliasDeclaration
  | InterfaceDeclaration
  | FunctionDeclaration => {
  if (Node.isVariableDeclaration(node)) {
    return true;
  }

  if (Node.isTypeAliasDeclaration(node)) {
    return true;
  }

  if (Node.isInterfaceDeclaration(node)) {
    return true;
  }

  if (Node.isFunctionDeclaration(node)) {
    return true;
  }

  return false;
};
