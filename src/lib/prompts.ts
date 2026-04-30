import { join, basename } from "path";
import { existsSync, readdirSync } from "fs";
import { readFile } from "fs/promises";
import { getConfigDir } from "./config.js";
import { loadAgents, saveAgents } from "./agents.js";

/**
 * Get the path to the prompts directory.
 */
export function getPromptsDir(): string {
  return join(getConfigDir(), "prompts");
}

/**
 * List all available prompt template names (without .txt extension).
 */
export function listPromptTemplates(): string[] {
  const promptsDir = getPromptsDir();

  if (!existsSync(promptsDir)) {
    return [];
  }

  return readdirSync(promptsDir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => basename(f, ".txt"));
}

/**
 * Load the content of a prompt template by name.
 * Returns null if not found.
 */
export async function loadPromptTemplate(name: string): Promise<string | null> {
  const promptPath = join(getPromptsDir(), `${name}.txt`);

  if (!existsSync(promptPath)) {
    return null;
  }

  return await readFile(promptPath, "utf-8");
}

/**
 * Apply a prompt template to an agent by prepending it to the system prompt.
 * Returns false if agent or template not found.
 */
export async function applyPromptToAgent(templateName: string, agentId: string): Promise<{ success: boolean; error?: string }> {
  const template = await loadPromptTemplate(templateName);

  if (template === null) {
    return { success: false, error: `Template "${templateName}" not found.` };
  }

  const agents = await loadAgents();
  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    return { success: false, error: `Agent "${agentId}" not found.` };
  }

  // Prepend template to system prompt (avoid duplicating if already applied)
  const marker = `[${templateName}] `;
  if (agent.systemPrompt.startsWith(marker)) {
    // Already has a template marker — replace it
    const existingEnd = agent.systemPrompt.indexOf("\n\n");
    if (existingEnd !== -1) {
      agent.systemPrompt = `${marker}${template}\n\n${agent.systemPrompt.substring(existingEnd + 2)}`;
    } else {
      agent.systemPrompt = `${marker}${template}`;
    }
  } else {
    agent.systemPrompt = `${marker}${template}\n\n${agent.systemPrompt}`;
  }

  await saveAgents(agents);
  return { success: true };
}

/**
 * Reset an agent's system prompt by removing any prepended template.
 * Returns false if agent not found.
 */
export async function resetAgentPrompt(agentId: string): Promise<{ success: boolean; error?: string }> {
  const agents = await loadAgents();
  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    return { success: false, error: `Agent "${agentId}" not found.` };
  }

  // Remove template marker prefix if present
  const markerMatch = agent.systemPrompt.match(/^\[[\w-]+\] .+?\n\n/s);
  if (markerMatch) {
    agent.systemPrompt = agent.systemPrompt.substring(markerMatch[0].length);
    await saveAgents(agents);
  }

  return { success: true };
}
