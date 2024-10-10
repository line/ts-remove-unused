import ts from 'typescript';
import { Graph } from './Graph.js';
import { FileService } from './FileService.js';

export const collectImports = ({
  fileService,
  program,
}: {
  fileService: FileService;
  program: ts.Program;
}) => {
  const graph = new Graph();

  // fixme
  console.log(Object.keys({ fileService, program }));

  return graph;
};
