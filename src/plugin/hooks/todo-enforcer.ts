interface MessageLike {
  role: string;
  content: string;
}

const INCOMPLETE_TODO_PATTERN = /^[\s]*-\s*\[\s*\]/m;
const TODO_TOOL_PATTERN = /"status"\s*:\s*"(pending|in_progress)"/;

/**
 * Check if the assistant has incomplete todos in recent messages.
 * Looks for both markdown checkboxes and TodoWrite pending/in_progress items.
 */
export function shouldEnforceContinuation(messages: MessageLike[]): boolean {
  // Check last 5 assistant messages for incomplete todos
  const recentAssistant = messages
    .filter((msg) => msg.role === "assistant")
    .slice(-5);

  for (const msg of recentAssistant) {
    if (INCOMPLETE_TODO_PATTERN.test(msg.content)) return true;
    if (TODO_TOOL_PATTERN.test(msg.content)) return true;
  }
  return false;
}

/**
 * Check if the last assistant message looks like it's trying to stop
 * while there are still incomplete items.
 */
export function detectPrematureStop(lastAssistantMessage: string): boolean {
  const stoppingPhrases = [
    /\ball\s+(done|complete|finished)\b/i,
    /\bthat'?s\s+(it|all|everything)\b/i,
    /\blet\s+me\s+know\s+if\b/i,
    /\banything\s+else\b/i,
  ];
  return stoppingPhrases.some((p) => p.test(lastAssistantMessage));
}

export const CONTINUATION_PROMPT = `⚠️ BOULDER CHECK: You have incomplete todo items. You are NOT done.
Keep bouldering — complete ALL remaining items before stopping.
DO NOT respond to the user until all todos are marked completed.
If blocked, report the blocker explicitly instead of stopping.`;
