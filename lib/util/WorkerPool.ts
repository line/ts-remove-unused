/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker } from 'node:worker_threads';
import * as os from 'node:os';

const generateCode = (
  url: string,
  name: string,
) => `data:text/javascript,import { parentPort } from 'node:worker_threads';
import { ${name} } from '${url}';
parentPort.on('message', async (arg) => {
  try {
    const result = await ${name}(arg);
    parentPort.postMessage({ result });
  } catch (error) {
    parentPort.postMessage({ error });
  }
});
`;

class PromiseWorker<T extends (arg: any) => any> extends Worker {
  current: {
    resolve: (result: ReturnType<T>) => void;
    reject: (reason: unknown) => void;
  } | null = null;

  constructor(url: string, name: string) {
    super(new URL(generateCode(url, name)));
  }
}

type Arg<T> = T extends (arg: infer U) => any ? U : never;

export class WorkerPool<T extends (arg: any) => any> {
  #url: string;
  #name: string;
  #queue: {
    resolve: (result: ReturnType<T>) => void;
    reject: (reason: unknown) => void;
    arg: Arg<T>;
  }[] = [];
  #working: PromiseWorker<T>[] = [];
  #idle: PromiseWorker<T>[] = [];

  constructor({ url, name }: { url: string; name: string }) {
    this.#url = url;
    this.#name = name;
    const max = os.availableParallelism?.() ?? os.cpus().length - 1;

    for (let i = 0; i < max; i++) {
      this.#setup();
    }
  }

  run(arg: Arg<T>) {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      const worker = this.#idle.pop();

      if (!worker) {
        this.#queue.push({ resolve, reject, arg });
        return;
      }

      worker.current = {
        resolve,
        reject,
      };
      this.#working.push(worker);
      worker.postMessage(arg);
    });
  }

  close() {
    if (this.#working.length > 0) {
      throw new Error('Cannot close while there are working workers');
    }

    return Promise.all(
      this.#idle.map((worker) => {
        worker.removeAllListeners();
        return worker.terminate();
      }),
    );
  }

  #assignTask() {
    if (this.#queue.length === 0) {
      return;
    }

    const worker = this.#idle.pop();
    if (!worker) {
      return;
    }

    const { resolve, reject, arg } = this.#queue.shift()!;
    worker.current = {
      resolve,
      reject,
    };
    worker.postMessage(arg);
    this.#working.push(worker);
  }

  #free(worker: PromiseWorker<T>) {
    worker.current = null;
    const index = this.#working.indexOf(worker);

    if (index === -1) {
      return;
    }

    this.#working.splice(index, 1);
    this.#idle.push(worker);
  }

  #setup() {
    const worker = new PromiseWorker(this.#url, this.#name);

    worker.on('message', (message) => {
      if (!worker.current) {
        return;
      }

      if ('error' in message) {
        worker.current.reject(message.error);
      } else {
        worker.current.resolve(message.result);
      }

      this.#free(worker);
      this.#assignTask();
    });

    worker.on('error', (error) => {
      if (!worker.current) {
        return;
      }

      worker.current.reject(error);
      this.#free(worker);
      this.#assignTask();
    });

    worker.on('exit', (code) => {
      if (code === 0) {
        console.log('here');
        return;
      }

      if (worker.current) {
        worker.current.reject(
          new Error(`Worker stopped with exit code ${code}`),
        );
        this.#free(worker);
        worker.terminate();
        this.#setup();
        return;
      }

      worker.terminate();
      this.#setup();
    });

    this.#idle.push(worker);
  }
}
