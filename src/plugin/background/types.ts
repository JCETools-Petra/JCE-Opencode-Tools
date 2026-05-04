export type TaskStatus = "pending" | "running" | "completed" | "error" | "cancelled";

export interface BackgroundTask {
  id: string;
  description: string;
  prompt: string;
  agent: string;
  parentSessionId: string;
  parentMessageId: string;
  sessionId?: string;
  status: TaskStatus;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface LaunchInput {
  description: string;
  prompt: string;
  agent: string;
  parentSessionId: string;
  parentMessageId: string;
}

export interface BackgroundManagerOptions {
  maxConcurrency: number;
}
