import { FileService } from './FileService.js';

export class MemoryFileService implements FileService {
  #files: Map<string, { content: string; version: number }>;
  #fileNames = new Set<string>();

  constructor(initialFiles?: Iterable<[string, string]>) {
    this.#files = new Map();
    for (const [name, content] of initialFiles || []) {
      this.#files.set(name, {
        content,
        version: 0,
      });
    }
    this.#fileNames = new Set(this.#files.keys());
  }

  set(name: string, content: string) {
    const stored = this.#files.get(name);
    if (stored) {
      this.#files.set(name, {
        content,
        version: stored.version + 1,
      });
    } else {
      this.#files.set(name, {
        content,
        version: 0,
      });
      this.#fileNames = new Set(this.#files.keys());
    }
  }

  get(name: string) {
    const file = this.#files.get(name);

    // todo: should we return an empty string or undefined?
    return file ? file.content : '';
  }

  delete(name: string) {
    this.#files.delete(name);
    this.#fileNames = new Set(this.#files.keys());
  }

  getVersion(name: string) {
    const file = this.#files.get(name);

    return file ? file.version.toString() : '';
  }

  // todo: remove later
  getFileNames() {
    return Array.from(this.#files.keys());
  }

  getFileNamesSet() {
    return this.#fileNames;
  }

  exists(name: string) {
    return this.#files.has(name);
  }

  eject() {
    const res = new Map<string, string>();

    for (const [name, { content }] of this.#files) {
      res.set(name, content);
    }

    return res;
  }
}
