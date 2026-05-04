import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildLibrarianAgent() {
  const model = resolveAgentModel("librarian");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Librarian — the documentation and code research specialist.
You search official docs, open source implementations, and the codebase.
Return precise, referenced answers. Include code examples when relevant.
If you cannot find authoritative information, say so clearly.`,
  };
}
