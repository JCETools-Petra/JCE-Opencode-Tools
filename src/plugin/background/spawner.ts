import type { BackgroundManager } from "./manager.js";
import type { LaunchInput } from "./types.js";

/**
 * Spawns a background agent session via the OpenCode SDK client.
 * The client is injected from the plugin entry point at runtime.
 */
export async function spawnBackgroundTask(
  manager: BackgroundManager,
  client: any,
  input: LaunchInput,
): Promise<string> {
  const task = manager.createTask(input);

  if (!manager.canLaunch()) {
    return task.id;
  }

  try {
    const session = await client.session.create({
      body: { parentID: input.parentSessionId },
    });

    if (!session?.id) {
      manager.failTask(task.id, "Failed to create child session");
      return task.id;
    }

    manager.markRunning(task.id, session.id);

    client.session
      .chat({
        params: { id: session.id },
        body: { content: input.prompt, agent: input.agent },
      })
      .then(() => {
        manager.completeTask(task.id, "Task completed");
      })
      .catch((err: Error) => {
        manager.failTask(task.id, err.message);
      });
  } catch (err) {
    manager.failTask(task.id, err instanceof Error ? err.message : String(err));
  }

  return task.id;
}
