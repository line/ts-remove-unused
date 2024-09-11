declare module 'node:process' {
  import { Socket } from 'node:net';

  interface Process extends NodeJS.Process {
    stdout: Socket | NodeJS.Process['stdout'];
  }

  const process: Process;

  export = process;
}
