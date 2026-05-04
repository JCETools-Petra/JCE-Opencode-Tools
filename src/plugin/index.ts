import type { PluginModule, Plugin, Hooks } from "@opencode-ai/plugin";
import { BackgroundManager } from "./background/manager.js";
import { buildDispatchTool, buildStatusTool, buildCollectTool } from "./tools/dispatch.js";
import { buildAgentConfigs } from "./config.js";
import { analyzeCommentDensity, COMMENT_WARNING } from "./hooks/comment-checker.js";

const jcePlugin: Plugin = async (input) => {
  const { client } = input;
  const manager = new BackgroundManager({ maxConcurrency: 5 });
  const agents = buildAgentConfigs();

  const hooks: Hooks = {
    config: async (config) => {
      if (!config.agent) (config as any).agent = {};
      for (const [id, agentConfig] of Object.entries(agents)) {
        if (!(config as any).agent[id]) {
          (config as any).agent[id] = agentConfig;
        }
      }
    },

    event: async ({ event }) => {
      // Future: monitor session.idle to check todo completion
    },

    tool: {
      dispatch: buildDispatchTool(manager, client),
      bg_status: buildStatusTool(manager),
      bg_collect: buildCollectTool(manager),
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool === "Write" || input.tool === "Edit") {
        const filePath = input.args?.filePath || input.args?.path || "";
        const content = output.output || "";
        if (filePath && content && typeof content === "string") {
          const analysis = analyzeCommentDensity(content, filePath);
          if (analysis.excessive) {
            output.output = `${output.output}\n\n${COMMENT_WARNING}`;
          }
        }
      }
    },
  };

  return hooks;
};

const pluginModule: PluginModule = {
  id: "opencode-jce",
  server: jcePlugin,
};

export default pluginModule;
