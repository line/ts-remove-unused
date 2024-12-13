import { relative } from 'node:path';
import { Logger } from './Logger.js';
import pc from 'picocolors';
import { formatCount } from './formatCount.js';
import { Output } from './Output.js';

const getLinePosition = (content: string, position: number) => {
  const result = {
    line: 0,
    pos: 0,
  };

  for (let i = 0; i < content.length; i++) {
    if (i === position) {
      return `${result.line}:${result.pos}`;
    }

    if (content[i] === '\n') {
      result.line++;
      result.pos = 0;
    } else {
      result.pos++;
    }
  }

  throw new Error('position is out of range');
};

export class CliOutput implements Output {
  #removedExportCount = 0;
  #deletedFileCount = 0;
  #projectRoot: string;
  #logger: Logger;
  #mode: 'check' | 'write';

  constructor({
    logger,
    projectRoot,
    mode,
  }: {
    logger: Logger;
    projectRoot: string;
    mode: 'check' | 'write';
  }) {
    this.#logger = logger;
    this.#mode = mode;
    this.#projectRoot = projectRoot;
  }

  deleteFile(file: string): void {
    this.#logger.write(`${pc.yellow('file')}   ${this.#relativePath(file)}\n`);
    this.#deletedFileCount++;
  }

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
  }): void {
    this.#logger.write(
      `${pc.yellow('export')} ${this.#relativePath(file)}:${pc.gray(
        getLinePosition(content, position).padEnd(7),
      )} ${pc.gray(`'${code}'`)}\n`,
    );
    this.#removedExportCount++;
  }

  done() {
    const result = [
      this.#deletedFileCount > 0
        ? `${this.#mode === 'check' ? 'delete' : 'deleted'} ${formatCount(this.#deletedFileCount, 'file')}`
        : '',
      this.#removedExportCount > 0
        ? `${this.#mode === 'check' ? 'remove' : 'removed'} ${formatCount(this.#removedExportCount, 'export')}`
        : '',
    ].filter((t) => !!t);

    if (this.#mode === 'check' && result.length > 0) {
      this.#logger.write(pc.red(pc.bold(`✖ ${result.join(', ')}\n`)));
      return {
        code: 1,
      };
    }

    this.#logger.write(
      pc.green(
        pc.bold(`✔ ${result.length > 0 ? result.join(', ') : 'all good!'}\n`),
      ),
    );
    return { code: 0 };
  }

  #relativePath(file: string) {
    return relative(this.#projectRoot, file).replaceAll('\\', '/');
  }
}
