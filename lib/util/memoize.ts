// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  { key }: { key: (...args: Parameters<T>) => string },
) => {
  const cache = new Map<string, ReturnType<T>>();

  return (...args: Parameters<T>) => {
    const k = key(...args);

    if (cache.has(k)) {
      return cache.get(k)!;
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(k, result);
    return result;
  };
};
