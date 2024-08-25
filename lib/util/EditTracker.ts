export interface EditTracker {
  start(file: string, content: string): void;
  end(file: string): void;
  delete(file: string): void;
  removeExport(
    file: string,
    { position, code }: { position: number; code: string },
  ): void;
}
