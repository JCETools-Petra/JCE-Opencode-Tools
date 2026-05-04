interface MessageLike {
  role: string;
  content: string;
}

const INCOMPLETE_TODO_PATTERN = /^[\s]*-\s*\[\s*\]/m;

export function shouldEnforceContinuation(messages: MessageLike[]): boolean {
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    if (INCOMPLETE_TODO_PATTERN.test(msg.content)) {
      return true;
    }
  }
  return false;
}

export const CONTINUATION_PROMPT = `⚠️ BOULDER CHECK: You have incomplete todo items. You are NOT done. Keep bouldering — complete all remaining items before stopping.`;
