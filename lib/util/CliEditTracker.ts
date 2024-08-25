import chalk from 'chalk';
import { EditTracker } from './EditTracker.js';
import { Logger } from './Logger.js';

class EditTrackerError extends Error {}

type FileStatus =
  | {
      status: 'delete';
      content: string;
    }
  | {
      status: 'processing' | 'done';
      content: string;
      removedExports: { position: number; code: string }[];
    };

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

export class CliEditTracker implements EditTracker {
  #logger: Logger;
  #status: Map<string, FileStatus> = new Map();
  #mode: 'check' | 'write';

  constructor(logger: Logger, mode: 'check' | 'write') {
    this.#logger = logger;
    this.#mode = mode;
  }

  #getProcessingFile(file: string) {
    const item = this.#status.get(file);

    if (!item) {
      throw new EditTrackerError('file not found in EditTracker');
    }

    if (item.status !== 'processing') {
      throw new EditTrackerError(`unexpected status: ${item.status}`);
    }

    return item;
  }

  get #isCheck() {
    return this.#mode === 'check';
  }

  start(file: string, content: string): void {
    this.#status.set(file, {
      content,
      status: 'processing',
      removedExports: [],
    });
  }

  end(file: string): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      ...item,
      status: 'done',
    });
  }

  delete(file: string): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      status: 'delete',
      content: item.content,
    });

    this.#logger.write(`${badge('delete')} ${file}\n`);
  }

  removeExport(
    file: string,
    { code, position }: { code: string; position: number },
  ): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      ...item,
      removedExports: [...item.removedExports, { position, code }],
    });

    if (this.#isCheck) {
      this.#logger.write(
        `${badge('edit')}   ${file}:${chalk.gray(
          getLinePosition(item.content, position).padEnd(7),
        )} ${chalk.gray(`'${code}'`)}\n`,
      );
    }
  }

  result() {
    const values = Array.from(this.#status.values());
    this.#logger.write(
      chalk.yellow(
        `\ndelete ${format(
          values.filter((v) => v.status === 'delete').length,
        )}, edit ${format(
          values.flatMap((v) => (v.status === 'done' ? v.removedExports : []))
            .length,
        )}\n`,
      ),
    );
  }
}

const format = (count: number) => {
  if (count === 0) {
    return 'no files';
  }

  if (count === 1) {
    return '1 file';
  }

  return `${count} files`;
};

const badge = (text: string) => `[${chalk.yellow(text)}]`;
