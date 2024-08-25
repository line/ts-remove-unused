export interface Logger {
  write(text: string): void;
  moveCursor(dx: number, dy: number): void;
  clearLine(dir: 0 | -1 | 0): void;
  isTTY: boolean;
}
