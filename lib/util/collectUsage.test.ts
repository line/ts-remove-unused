import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectUsage } from './collectUsage.js';

describe('collectUsage', () => {
  it('should collect a single named import', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
    });
  });

  it('should collect multiple named imports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b, c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b', 'c']),
    });
  });

  it('should collect aliased named imports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b as c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
    });
  });

  it('should collect a single default import', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['default']),
    });
  });

  it('should collect when default and named imports are mixed', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import b, { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['default', 'c']),
    });
  });

  it('should collect when the default specifier is used in a named import', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { default as b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['default']),
    });
  });

  it('should collect when there are imports to multiple files', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b } from "./b"; import { c } from "./c";',
      destFiles: new Set(['/app/b.ts', '/app/c.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
      '/app/c.ts': new Set(['c']),
    });
  });

  it('should collect when there are multiple import declarations referencing the same file', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import { b } from "./b"; import { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b', 'c']),
    });
  });

  it('should collect namespace imports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import * as b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['*']),
    });
  });

  it('should collect a single export declaration', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export { b } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
    });
  });

  it('should collect multiple named exports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export { b, c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b', 'c']),
    });
  });

  it('should collect aliased named exports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export { b as c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
    });
  });

  it('should collect when there are exports to multiple files', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export { b } from "./b"; export { c } from "./c";',
      destFiles: new Set(['/app/b.ts', '/app/c.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b']),
      '/app/c.ts': new Set(['c']),
    });
  });

  it('should collect when there are multiple export declarations referencing the same file', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export { b } from "./b"; export { c } from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['b', 'c']),
    });
  });

  it('should collect namespace exports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export * as b from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['*']),
    });
  });

  it('should collect whole reexports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'export * from "./b";',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      '/app/b.ts': new Set(['*']),
    });
  });

  it('should collect dynamic imports', () => {
    const result = collectUsage({
      file: '/app/a.ts',
      content: 'import("./b");',
      destFiles: new Set(['/app/b.ts']),
    });

    assert.deepEqual(result, {
      // for now, we don't know what's being imported so we just add a wildcard
      '/app/b.ts': new Set(['*']),
    });
  });
});
