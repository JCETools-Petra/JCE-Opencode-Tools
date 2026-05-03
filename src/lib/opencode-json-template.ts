/**
 * Default opencode.json template for fresh installs.
 * Contains all MCP servers and plugin config that should be active out-of-the-box.
 *
 * Format: OpenCode native (NOT Claude Desktop format).
 * - MCP: { "type", "command"/"url", "env", "enabled" }
 * - LSP: left empty — populated after user installs LSP servers.
 */

import { join } from "path";

/**
 * Build the default opencode.json content.
 * @param configDir - The resolved config directory (e.g., ~/.config/opencode)
 *                    Used to compute the context-keeper path.
 */
export function buildDefaultOpenCodeJson(configDir: string): Record<string, unknown> {
  const contextKeeperPath = join(configDir, "cli", "src", "mcp", "context-keeper.ts")
    .replace(/\\/g, "/");

  return {
    $schema: "https://opencode.ai/config.json",
    plugin: [
      "superpowers@git+https://github.com/obra/superpowers.git",
    ],
    mcp: {
      "context7": {
        type: "remote",
        url: "https://mcp.context7.com/mcp",
        enabled: true,
      },
      "sequential-thinking": {
        type: "local",
        command: ["mcp-server-sequential-thinking"],
        enabled: true,
      },
      "playwright": {
        type: "local",
        command: ["playwright-mcp"],
        enabled: true,
      },
      "github-search": {
        type: "local",
        command: ["mcp-server-github"],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}",
        },
        enabled: true,
      },
      "memory": {
        type: "local",
        command: ["mcp-server-memory"],
        enabled: true,
      },
      "context-keeper": {
        type: "local",
        command: ["bun", "run", contextKeeperPath],
        enabled: true,
      },
    },
    lsp: {},
  };
}
