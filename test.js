/* global process */
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

run({
  globPatterns: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
})
  .on('test:fail', () => {
    process.exitCode = 1;
  })
  .compose(spec)
  .pipe(process.stdout);
