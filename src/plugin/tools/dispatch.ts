import { tool } from "@opencode-ai/plugin";
import type { ToolDefinition } from "@opencode-ai/plugin";
import type { BackgroundManager } from "../background/manager.js";
import { spawnBackgroundTask } from "../background/spawner.js";

const z = tool.schema;

export function buildDispatchTool(manager: BackgroundManager, client: any): ToolDefinition {
  return tool({
    description:
      "Launch a background agent task. The task runs in parallel and results can be collected later with bg_collect.",
    args: {
      description: z
        .string()
        .describe("Brief description of what this background task should accomplish"),
      prompt: z
        .string()
        .describe("The full prompt/instructions for the background agent"),
      agent: z
        .enum(["oracle", "librarian", "explorer", "frontend"])
        .describe("Which agent to use"),
    },
    async execute(args, context) {
      const taskId = await spawnBackgroundTask(manager, client, {
        description: args.description as string,
        prompt: args.prompt as string,
        agent: args.agent as string,
        parentSessionId: context.sessionID,
        parentMessageId: context.messageID,
      });
      return `Background task launched: ${taskId}\nAgent: ${args.agent}\nDescription: ${args.description}\n\nUse bg_status to check progress or bg_collect to retrieve results.`;
    },
  });
}

export function buildStatusTool(manager: BackgroundManager): ToolDefinition {
  return tool({
    description: "Check the status of all background tasks launched in this session.",
    args: {},
    async execute() {
      const tasks = manager.listTasks();
      if (tasks.length === 0) return "No background tasks.";
      return tasks
        .map(
          (t) =>
            `[${t.status.toUpperCase()}] ${t.id} — ${t.description} (agent: ${t.agent})`,
        )
        .join("\n");
    },
  });
}

export function buildCollectTool(manager: BackgroundManager): ToolDefinition {
  return tool({
    description: "Collect the result of a completed background task by its ID.",
    args: {
      taskId: z.string().describe("The task ID returned by dispatch"),
    },
    async execute(args) {
      const taskId = args.taskId as string;
      const task = manager.getTask(taskId);
      if (!task) return `Task not found: ${taskId}`;
      if (task.status === "pending") return `Task ${taskId} is still pending.`;
      if (task.status === "running") return `Task ${taskId} is still running.`;
      if (task.status === "cancelled") return `Task ${taskId} was cancelled.`;
      if (task.status === "error") return `Task ${taskId} failed: ${task.error}`;
      return `Task ${taskId} completed:\n\n${task.result}`;
    },
  });
}
