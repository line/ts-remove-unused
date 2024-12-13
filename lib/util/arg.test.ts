import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arg } from './arg.js';

// todo: consider adding tests for type inference
describe('arg', () => {
  it('should work with string option', () => {
    const options = [
      {
        name: 'foo',
        type: 'string',
        default: 'bar',
      },
    ] as const;

    const { parse } = arg(options);

    assert.equal(parse([]).foo, 'bar');
    assert.equal(parse(['--foo', 'baz']).foo, 'baz');
  });

  it('should work with string option with alias', () => {
    const options = [
      {
        name: 'foo',
        alias: 'f',
        type: 'string',
        default: 'bar',
      },
    ] as const;

    const { parse } = arg(options);

    assert.equal(parse([]).foo, 'bar');
    assert.equal(parse(['-f', 'baz']).foo, 'baz');
  });

  it('should work with boolean option', () => {
    const options = [
      {
        name: 'foo',
        type: 'boolean',
        default: false,
      },
    ] as const;

    const { parse } = arg(options);

    assert.equal(parse(['--foo']).foo, true);
    assert.equal(parse([]).foo, false);
  });

  it('should work with boolean option with alias', () => {
    const options = [
      {
        name: 'foo',
        alias: 'f',
        type: 'boolean',
        default: false,
      },
    ] as const;

    const { parse } = arg(options);

    assert.equal(parse([]).foo, false);
    assert.equal(parse(['-f']).foo, true);
  });

  it('should work with multiple options', () => {
    const options = [
      {
        name: 'foo',
        type: 'string',
        default: 'baz',
      },
      {
        name: 'bar',
        type: 'boolean',
        default: false,
      },
    ] as const;

    const { parse } = arg(options);
    assert.equal(parse([]).foo, 'baz');
    assert.equal(parse([]).bar, false);
    assert.equal(parse(['--foo', 'hello', '--bar']).foo, 'hello');
    assert.equal(parse(['--foo', 'hello', '--bar']).bar, true);
  });

  it('should throw on unknown option', () => {
    const options = [] as const;

    const { parse } = arg(options);
    assert.throws(() => parse(['--bar']), {
      message: 'Unknown option: --bar',
    });
  });
});
