import { parentPort } from 'node:worker_threads';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  { key, name }: { key: (...args: Parameters<T>) => string; name: string },
) => {
  const cache = new Map<string, ReturnType<T>>();

  if (parentPort) {
    parentPort.on('message', (message) => {
      if ('broadcast' in message && message.broadcast.name === name) {
        cache.set(message.broadcast.key, message.broadcast.value);
      }
    });
  }

  return (...args: Parameters<T>) => {
    const k = key(...args);

    if (cache.has(k)) {
      return cache.get(k)!;
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(k, result);
    if (parentPort) {
      parentPort.postMessage({
        broadcast: {
          name,
          key: k,
          value: result,
        },
      });
    }
    return result;
  };
};
