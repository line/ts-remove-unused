export class FileService {
  #files: Map<string, { content: string; version: number }>;

  constructor() {
    this.#files = new Map();
  }

  set(name: string, content: string) {
    const currentVersion = this.#files.get(name)?.version || 0;
    this.#files.set(name, {
      content,
      version: currentVersion + 1,
    });
  }

  get(name: string) {
    const file = this.#files.get(name);

    // todo: should we return an empty string or undefined?
    return file ? file.content : '';
  }

  delete(name: string) {
    this.#files.delete(name);
  }

  getVersion(name: string) {
    const file = this.#files.get(name);

    return file ? file.version.toString() : '';
  }

  getFileNames() {
    return Array.from(this.#files.keys());
  }

  exists(name: string) {
    return this.#files.has(name);
  }
}
