import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from './Graph.js';

describe('Graph', () => {
  it('should add edges correctly', () => {
    const graph = new Graph();
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');

    assert.equal(graph.vertexes.size, 3);
    assert.deepEqual(graph.vertexes.get('A')?.to, new Set(['B', 'C']));
    assert.deepEqual(graph.vertexes.get('B')?.from, new Set(['A']));
    assert.deepEqual(graph.vertexes.get('C')?.from, new Set(['A']));
  });

  it('should delete vertex correctly', () => {
    const graph = new Graph();
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'C');

    graph.deleteVertex('A');

    assert.equal(graph.vertexes.size, 2);
    assert.equal(graph.vertexes.has('A'), false);
    assert.deepEqual(graph.vertexes.get('B')?.to, new Set(['C']));
    assert.deepEqual(graph.vertexes.get('C')?.from, new Set(['B']));
  });

  it('should remove vertexes without any edges', () => {
    const graph = new Graph();
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'C');
    graph.deleteVertex('B');

    assert.equal(graph.vertexes.size, 2);
    assert.equal(graph.vertexes.has('B'), false);
    assert.equal(graph.vertexes.has('A'), true);
    assert.equal(graph.vertexes.has('C'), true);
    assert.deepEqual(graph.vertexes.get('A')?.to, new Set(['C']));
    assert.deepEqual(graph.vertexes.get('A')?.from.size, 0);
    assert.equal(graph.vertexes.get('C')?.to.size, 0);
    assert.deepEqual(graph.vertexes.get('C')?.from, new Set(['A']));
  });
});
