export interface FileService {
  set(name: string, content: string): void;
  get(name: string): string;
  delete(name: string): void;
  getVersion(name: string): string;
  getFileNames(): string[];
  exists(name: string): boolean;
  eject(): Map<string, string>;
}
