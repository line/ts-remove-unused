import { Graph } from './Graph.js';

export class DependencyGraph extends Graph<{
  depth: number;
  wholeReexportSpecifier: Map<string, string>;
}> {
  constructor() {
    super(() => ({
      depth: 0,
      // will not be updated when we delete a file,
      // but it's fine since we only use it to find the used specifier from a given file path.
      wholeReexportSpecifier: new Map<string, string>(),
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
