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
      removedExports: { start: number; length: number }[];
    };

export class CliEditTracker implements EditTracker {
  #logger: Logger;
  #status: Map<string, FileStatus> = new Map();

  constructor(logger: Logger) {
    this.#logger = logger;
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

    this.#logger.write(
      `${chalk.green.bold('✓')} ${file} ${
        item.removedExports.length > 0 ? chalk.gray('(modified)') : ''
      }\n`,
    );
  }

  delete(file: string): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      status: 'delete',
      content: item.content,
    });

    this.#logger.write(
      `${chalk.green.bold('✓')} ${file} ${chalk.gray('(deleted)')}\n`,
    );
  }

  removeExport(file: string, span: { start: number; length: number }): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      ...item,
      removedExports: [...item.removedExports, span],
    });
  }

  result() {
    console.log(this.#status.values());
  }
}
