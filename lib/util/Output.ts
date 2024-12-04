export interface Output {
  deleteFile(file: string): void;
  removeExport({
    file,
    position,
    code,
    content,
  }: {
    file: string;
    position: number;
    code: string;
    content: string;
  }): void;
  done(): void;
}
