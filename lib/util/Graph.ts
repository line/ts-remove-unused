export class Graph {
  vertexes = new Map<string, { to: Set<string>; from: Set<string> }>();

  private addVertex(vertex: string) {
    const selected = this.vertexes.get(vertex);
    if (selected) {
      return selected;
    }

    const created = { to: new Set<string>(), from: new Set<string>() };

    this.vertexes.set(vertex, created);

    return created;
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

      target.from.delete(vertex);

      if (target.from.size === 0 && target.to.size === 0) {
        this.vertexes.delete(v);
      }
    }

    for (const v of selected.from) {
      const target = this.vertexes.get(v);

      if (!target) {
        continue;
      }

      target.to.delete(vertex);

      if (target.from.size === 0 && target.to.size === 0) {
        this.vertexes.delete(v);
      }
    }

    this.vertexes.delete(vertex);
  }

  addEdge(source: string, destination: string): void {
    const s = this.addVertex(source);
    const d = this.addVertex(destination);
    s.to.add(destination);
    d.from.add(source);
  }
}
