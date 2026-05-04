import type { PluginModule, Plugin } from "@opencode-ai/plugin";

const jcePlugin: Plugin = async (_input, _options) => {
  return {};
};

const pluginModule: PluginModule = {
  id: "opencode-jce",
  server: jcePlugin,
};

export default pluginModule;
