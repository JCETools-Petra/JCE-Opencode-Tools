import type { BackgroundTask, BackgroundManagerOptions, LaunchInput } from "./types.js";

export class BackgroundManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private maxConcurrency: number;

  constructor(options: BackgroundManagerOptions) {
    this.maxConcurrency = options.maxConcurrency;
  }

  createTask(input: LaunchInput): BackgroundTask {
    const task: BackgroundTask = {
      id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      parentSessionId: input.parentSessionId,
      parentMessageId: input.parentMessageId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status === "completed" || task.status === "cancelled") return false;
    task.status = "cancelled";
    return true;
  }

  completeTask(id: string, result: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "completed";
    task.result = result;
    task.completedAt = new Date().toISOString();
  }

  failTask(id: string, error: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "error";
    task.error = error;
    task.completedAt = new Date().toISOString();
  }

  markRunning(id: string, sessionId: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "running";
    task.sessionId = sessionId;
  }

  getRunningCount(): number {
    return this.listTasks().filter((t) => t.status === "running").length;
  }

  canLaunch(): boolean {
    return this.getRunningCount() < this.maxConcurrency;
  }
}
