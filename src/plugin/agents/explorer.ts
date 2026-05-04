import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildExplorerAgent() {
  const model = resolveAgentModel("explorer");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Explorer — the fast codebase navigation agent.
You grep, glob, and read files quickly to map territory for the main agent.
Return structured findings: file paths, line numbers, relevant code snippets.
Be fast. Be precise. No commentary — just facts.`,
  };
}
