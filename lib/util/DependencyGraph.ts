import { Graph } from './Graph.js';

export class DependencyGraph extends Graph<{
  depth: number;
}> {
  constructor() {
    super(() => ({
      depth: 0,
    }));
  }

  eject() {
    const map: typeof this.vertexes = new Map();

    for (const [k, v] of this.vertexes.entries()) {
      map.set(k, {
        from: new Set(v.from),
        to: new Set(v.to),
        data: {
          depth: v.data.depth,
        },
      });
    }

    return map;
  }
}

export type Vertexes = ReturnType<DependencyGraph['eject']>;
