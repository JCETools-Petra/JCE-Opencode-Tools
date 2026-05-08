/** @jsxImportSource @opentui/solid */
import type { PluginOptions } from "@opencode-ai/plugin";
import type { TuiPluginApi, TuiPluginMeta } from "@opencode-ai/plugin/tui";
import { loadExecutionMemory } from "./lib/execution-memory.js";

function renderContextBudgetLine(api: TuiPluginApi): string {
  const projectRoot = api.state.path.directory || api.state.path.worktree;
  if (!projectRoot) return "~0 token(s) saved";

  const summary = loadExecutionMemory(projectRoot).memory.contextBudgetSummary;
  if (!summary || summary.tasks === 0) return "~0 token(s) saved";

  return `~${summary.estimatedTokensSaved ?? 0} token(s) saved`;
}

export async function tui(api: TuiPluginApi, _options: PluginOptions | undefined, _meta: TuiPluginMeta): Promise<void> {
  api.slots.register({
    order: 600,
    slots: {
      sidebar_content: (_ctx: unknown, _props: { session_id: string }) => {
        const line = renderContextBudgetLine(api);

        return (
          <box>
            <text fg={api.theme.current.text}>
              <b>Token Savings</b>
            </text>
            <text fg={api.theme.current.textMuted}>{line}</text>
          </box>
        );
      },
    },
  });
}

export default {
  id: "opencode-jce-token-savings",
  tui,
};
