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

const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class CliEditTracker implements EditTracker {
  #logger: Logger;
  #status: Map<string, FileStatus> = new Map();
  #mode: 'check' | 'write';
  #total = 0;
  #progressText = '';
  #lastUpdate = performance.now();
  #spinnerIndex = 0;

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

  clearProgressOutput() {
    if (!this.#progressText) {
      return;
    }

    if (!this.#logger.isTTY) {
      return;
    }

    this.#logger.cursorTo(0);
    this.#logger.clearLine(0);
    this.#progressText = '';
  }

  updateProgressOutput() {
    if (!this.#logger.isTTY) {
      return;
    }

    const diff = performance.now() - this.#lastUpdate;

    if (diff > 50) {
      this.#spinnerIndex = (this.#spinnerIndex + 1) % spinner.length;
      const output = chalk.gray(
        `${chalk.yellow(spinner[this.#spinnerIndex])} ${this.#status.size}/${
          this.#total
        }`,
      );

      this.clearProgressOutput();
      this.#logger.write(output);
      this.#progressText = output;
      this.#lastUpdate = performance.now();
    }
  }

  start(file: string, content: string): void {
    this.#status.set(file, {
      content,
      status: 'processing',
      removedExports: [],
    });

    this.updateProgressOutput();
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

    this.clearProgressOutput();
    this.#logger.write(`${chalk.yellow('file')}   ${file}\n`);
  }

  removeExport(
    file: string,
    { code, position }: { code: string; position: number },
  ): void {
    const item = this.#getProcessingFile(file);

    if (item.removedExports.length === 0) {
      this.clearProgressOutput();
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
      ].filter((t) => !!t);

      if (result.length > 0) {
        this.#logger.write(chalk.red.bold(`\n✖ ${result.join(', ')}\n`));

        return;
      }

      this.#logger.write(chalk.green.bold('\n✔ all good!\n'));
      return;
    } else {
      const result = [
        deleteCount > 0 ? `deleted ${deleteCount} file(s)` : '',
        editCount > 0 ? `removed ${editCount} export(s)` : '',
      ].filter((t) => !!t);

      this.#logger.write(
        chalk.green.bold(
          `\n✔ ${result.length > 0 ? result.join(', ') : 'all good!'}\n`,
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
