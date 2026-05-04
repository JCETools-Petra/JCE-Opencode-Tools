import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildFrontendAgent() {
  const model = resolveAgentModel("frontend");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Frontend Engineer — the UI/UX specialist.
You handle React, Vue, Svelte, CSS, Tailwind, accessibility, and responsive design.
Write clean, semantic markup. Follow component best practices.
Test visually when possible. Prefer composition over inheritance.`,
  };
}
