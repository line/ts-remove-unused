export interface EditTracker {
  start(file: string, content: string): void;
  end(file: string): void;
  delete(file: string): void;
  removeExport(file: string, span: { start: number; length: number }): void;
}
