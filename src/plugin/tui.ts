import type { PluginOptions } from "@opencode-ai/plugin";
import type { TuiPluginApi, TuiPluginMeta } from "@opencode-ai/plugin/tui";
import { loadExecutionMemory } from "./lib/execution-memory.js";

function renderContextBudgetLine(api: TuiPluginApi): string {
  const projectRoot = api.state.path.directory || api.state.path.worktree;
  if (!projectRoot) return "~0 token(s) saved";

  const summary = loadExecutionMemory(projectRoot).memory.contextBudgetSummary;
  if (!summary || summary.tasks === 0) return "~0 token(s) saved";

  return `~${summary.estimatedTokensSaved} token(s) saved`;
}

export async function tui(api: TuiPluginApi, _options: PluginOptions | undefined, _meta: TuiPluginMeta): Promise<void> {
  api.slots.register({
    replacements: {
      sidebar_content: (props: { session_id: string; children?: unknown }) => {
        const line = renderContextBudgetLine(api);
        return api.ui.Slot({
          name: "sidebar_content",
          ...props,
          children: `${props.children ?? ""}\n▼ Token Savings\n• ${line}`,
        });
      },
    },
  });
}
