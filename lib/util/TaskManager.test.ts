import { describe, it } from 'node:test';
import { TaskManager } from './TaskManager.js';
import assert from 'node:assert/strict';

describe('TaskManager', () => {
  it('should execute tasks', async () => {
    let result = '';

    const taskManager = new TaskManager(async (c) => {
      result += `${c.file}\n`;
    });

    await taskManager.execute(['a', 'b', 'c']);

    assert.equal(result, 'a\nb\nc\n');
  });

  it('should execute tasks that were added after the execution has started', async () => {
    let result = '';

    const taskManager = new TaskManager(async (c) => {
      result += `${c.file}\n`;

      if (c.file === 'a') {
        c.add('c');
      }
    });

    await taskManager.execute(['a', 'b']);

    assert.equal(result, 'a\nb\nc\n');
  });

  it('should prioritize new tasks over existing tasks', async () => {
    let result = '';
    const count = { a: 0, b: 0, c: 0 };

    const taskManager = new TaskManager(async (c) => {
      count[c.file as 'a' | 'b' | 'c']++;
      await Promise.resolve();

      if (c.signal.aborted) {
        return;
      }

      result += `${c.file}:${count[c.file as 'a' | 'b' | 'c']}\n`;

      if (c.file === 'a') {
        c.add('b');
      }
    });

    await taskManager.execute(['a', 'b', 'c']);

    assert.equal(result, 'a:1\nc:1\nb:2\n');
  });
});
