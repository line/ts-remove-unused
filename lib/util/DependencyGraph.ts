import { Graph } from './Graph.js';

export class DependencyGraph extends Graph<{
  depth: number;
  hasReexport: boolean;
  fromDynamic: Set<string>;
}> {
  constructor() {
    super(() => ({
      depth: 0,
      hasReexport: false,
      fromDynamic: new Set<string>(),
    }));
  }

  deleteVertex(vertex: string) {
    const selected = this.vertexes.get(vertex);

    if (!selected) {
      return;
    }

    for (const v of selected.to) {
      const target = this.vertexes.get(v);

      if (!target) {
        continue;
      }

      target.data.fromDynamic.delete(vertex);
    }

    super.deleteVertex(vertex);
  }
}
