import type { TaskGraph } from "./types.js";

export interface GraphRegistrySnapshot {
  activeGraphId: string | null;
  graphIds: string[];
}

/**
 * Lightweight multi-graph registry.
 *
 * Controller execution remains active-graph based for backward compatibility,
 * but graphs are no longer only an overwritten field: completed/superseded
 * graphs can be retained, inspected, and explicitly re-activated.
 */
export class GraphRegistry {
  private graphs = new Map<string, TaskGraph>();
  private activeGraphId: string | null = null;

  setActive(graph: TaskGraph): void {
    this.graphs.set(graph.id, graph);
    this.activeGraphId = graph.id;
  }

  update(graph: TaskGraph): void {
    this.graphs.set(graph.id, graph);
    if (!this.activeGraphId) this.activeGraphId = graph.id;
  }

  getActive(): TaskGraph | null {
    return this.activeGraphId ? this.graphs.get(this.activeGraphId) ?? null : null;
  }

  get(id: string): TaskGraph | undefined {
    return this.graphs.get(id);
  }

  switchActive(id: string): boolean {
    if (!this.graphs.has(id)) return false;
    this.activeGraphId = id;
    return true;
  }

  list(): TaskGraph[] {
    return [...this.graphs.values()];
  }

  /** Drop all graphs and clear the active pointer (fresh batch start). */
  reset(): void {
    this.graphs.clear();
    this.activeGraphId = null;
  }

  snapshot(): GraphRegistrySnapshot {
    return { activeGraphId: this.activeGraphId, graphIds: [...this.graphs.keys()] };
  }
}
