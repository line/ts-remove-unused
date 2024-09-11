export type Logger =
  | {
      write(text: string): void;
      clearLine(dir: -1 | 0 | 1): void;
      cursorTo(x: number): void;
      isTTY: true;
    }
  | {
      write(text: string): void;
      isTTY: false;
    };
