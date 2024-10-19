import { describe, it } from 'node:test';
import { TaskManager } from './TaskManager.js';
import assert from 'node:assert/strict';

// const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('TaskManager', () => {
  it('should execute tasks', async () => {
    let result = '';

    const taskManager = new TaskManager(async (c) => {
      result += `${c.file}\n`;
    });

    await taskManager.execute(['a', 'b', 'c']);

    assert.equal(result, 'a\nb\nc\n');
  });
});
