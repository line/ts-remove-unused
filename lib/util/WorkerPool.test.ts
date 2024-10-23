import { describe, it } from 'node:test';
import { WorkerPool } from './WorkerPool.js';
import assert from 'node:assert/strict';

describe('WorkerPool', () => {
  it('should run single task', async () => {
    const pool = new WorkerPool({
      name: 'add',
      url: new URL('../../test/fixtures/worker/worker.js', import.meta.url)
        .href,
    });

    const result = await pool.run({ a: 1, b: 2 });
    await pool.close();

    assert.equal(result, 3);
  });

  it('should run multiple tasks', async () => {
    const pool = new WorkerPool({
      name: 'add',
      url: new URL('../../test/fixtures/worker/worker.js', import.meta.url)
        .href,
    });

    const results = await Promise.all([
      pool.run({ a: 1, b: 2 }),
      pool.run({ a: 3, b: 4 }),
      pool.run({ a: 5, b: 6 }),
    ]);

    await pool.close();

    assert.deepEqual(results, [3, 7, 11]);
  });

  it('should run more tasks than workers', async () => {
    const pool = new WorkerPool({
      name: 'add',
      url: new URL('../../test/fixtures/worker/worker.js', import.meta.url)
        .href,
    });

    const tasks = Array.from({ length: 20 }, (_, i) =>
      pool.run({ a: i, b: i }),
    );

    const results = await Promise.all(tasks);

    assert.deepEqual(
      results,
      Array.from({ length: 20 }, (_, i) => i * 2),
    );

    await pool.close();
  });
});
