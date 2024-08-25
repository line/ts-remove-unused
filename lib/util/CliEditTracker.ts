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
  #total = 0;

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

  setTotal(total: number) {
    this.#total = total;
  }

  #cleanStatus() {
    if (this.#logger.isTTY) {
      this.#logger.cursorTo(0);
      this.#logger.clearLine(0);
    } else {
      this.#logger.write('\n');
    }
  }

  start(file: string, content: string): void {
    this.#status.set(file, {
      content,
      status: 'processing',
      removedExports: [],
    });

    this.#logger.write(chalk.gray(`${this.#status.size}/${this.#total}`));
  }

  end(file: string): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      ...item,
      status: 'done',
    });

    if (item.removedExports.length === 0) {
      this.#cleanStatus();
    }
  }

  delete(file: string): void {
    const item = this.#getProcessingFile(file);

    this.#status.set(file, {
      status: 'delete',
      content: item.content,
    });

    this.#cleanStatus();
    this.#logger.write(`${chalk.yellow('file')}   ${file}\n`);
  }

  removeExport(
    file: string,
    { code, position }: { code: string; position: number },
  ): void {
    const item = this.#getProcessingFile(file);

    if (item.removedExports.length === 0) {
      this.#cleanStatus();
    }

    this.#status.set(file, {
      ...item,
      removedExports: [...item.removedExports, { position, code }],
    });

    this.#logger.write(
      `${chalk.yellow('export')} ${file}:${chalk.gray(
        getLinePosition(item.content, position).padEnd(7),
      )} ${chalk.gray(`'${code}'`)}\n`,
    );
  }

  logResult() {
    const values = Array.from(this.#status.values());

    const deleteCount = values.filter((v) => v.status === 'delete').length;
    const editCount = values.flatMap((v) =>
      v.status === 'done' ? v.removedExports : [],
    ).length;

    if (this.#mode === 'check') {
      const result = [
        deleteCount > 0 ? `delete ${deleteCount} file(s)` : '',
        editCount > 0 ? `remove ${editCount} export(s)` : '',
      ];

      if (result.length > 0) {
        this.#logger.write(
          chalk.red.bold(`\n✖ ${result.filter((t) => !!t).join(', ')}\n`),
        );

        return;
      }

      this.#logger.write(chalk.green.bold('\n✔ all good!\n'));
      return;
    } else {
      const result = [
        deleteCount > 0 ? `deleted ${deleteCount} file(s)` : '',
        editCount > 0 ? `removed ${editCount} export(s)` : '',
      ];

      this.#logger.write(
        chalk.green.bold(
          `\n✔ ${
            result.length > 0
              ? result.filter((t) => !!t).join(', ')
              : 'no changes required'
          }\n`,
        ),
      );
    }
  }

  get isClean() {
    return !Array.from(this.#status.values()).some(
      (v) => v.status === 'delete' || v.removedExports.length > 0,
    );
  }
}
