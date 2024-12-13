import mri from 'mri';

type Value = {
  string: string;
  boolean: boolean;
};

type Parsed<T extends Option> = T extends {
  name: infer K extends string;
}
  ? { [key in K]: Value[T['type']] }
  : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type Flatten<T> = {
  [K in keyof T]: T[K];
} & {};

type Option =
  | {
      name: string;
      alias?: string;
      type: 'string';
      default: string;
    }
  | {
      name: string;
      alias?: string;
      type: 'boolean';
      default: boolean;
    };

export const arg = <T extends Readonly<Option[]>>(options: T) => {
  const config = options.reduce(
    (acc, cur) => {
      switch (cur.type) {
        case 'boolean': {
          acc.boolean.push(cur.name);
          break;
        }
        case 'string': {
          acc.string.push(cur.name);
          break;
        }
        default: {
          throw new Error(`Unknown type: ${cur satisfies never}`);
        }
      }

      acc.default[cur.name] = cur.default;

      if ('alias' in cur && cur.alias) {
        acc.alias[cur.name] = cur.alias;
      }

      return acc;
    },
    {
      boolean: [] as string[],
      string: [] as string[],
      default: {} as Record<string, string | boolean>,
      alias: {} as Record<string, string>,
      unknown,
    },
  );

  return {
    parse: (args: string[]) =>
      mri<Flatten<UnionToIntersection<Parsed<T[number]>>>>(args, config),
  };
};

const unknown = (option: string) => {
  throw new Error(`Unknown option: ${option}`);
};
