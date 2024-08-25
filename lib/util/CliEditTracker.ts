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

    if (this.#isCheck) {
      this.#logger.write(`${chalk.underline(file)}\n`);
    }
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

    this.#logger.write(`\t${chalk.gray('0:0')}\t${chalk.red('deletable')}\n`);
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
        `\t${chalk.gray(position)}\t${chalk.red('unused')}\t\t'${code}'\n`,
      );
    }
  }

  result() {
    const values = Array.from(this.#status.values());
    this.#logger.write(
      chalk.red(
        `${
          values.filter((v) => v.status === 'delete').length
        } file deletable, ${
          values.flatMap((v) => (v.status === 'done' ? v.removedExports : []))
            .length
        } exports removable\n`,
      ),
    );
  }
}
