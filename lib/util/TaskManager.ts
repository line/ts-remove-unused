type TaskHandler = ({
  file,
  signal,
  add,
}: {
  file: string;
  signal: AbortSignal;
  add: (...files: string[]) => void;
}) => Promise<void>;

type Task = {
  file: string;
  controller: AbortController;
  promise: Promise<void>;
  isFulfilled: boolean;
};

export class TaskManager {
  #handler: TaskHandler;
  #queue: string[] = [];
  #ongoing: Task[] = [];

  constructor(handler: TaskHandler) {
    this.#handler = handler;
  }

  #startQueued() {
    while (this.#queue.length > 0) {
      const file = this.#queue.shift();

      if (!file) {
        break;
      }

      const controller = new AbortController();
      const signal = controller.signal;

      const task = {
        file,
        controller,
        promise: this.#handler({
          file,
          signal,
          add: (...files) => {
            this.#ongoing
              .filter((t) => files.includes(t.file))
              .forEach((t) => t.controller.abort());
            this.#queue.push(...files);
          },
        }).then(() => {
          task.isFulfilled = true;
        }),
        isFulfilled: false,
      };

      this.#ongoing.push(task);
    }
  }

  async execute(files: string[]) {
    this.#queue.push(...files);

    while (this.#queue.length > 0 || this.#ongoing.length > 0) {
      this.#startQueued();
      await Promise.race(this.#ongoing.map((t) => t.promise));
      this.#ongoing = this.#ongoing.filter((t) => !t.isFulfilled);
    }
  }
}
