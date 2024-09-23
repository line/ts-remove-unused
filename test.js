import { run } from 'node:test';
import { stdout } from 'node:process';
import { spec } from 'node:test/reporters';

run({
  globPatterns: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
})
  .compose(spec)
  .pipe(stdout);
