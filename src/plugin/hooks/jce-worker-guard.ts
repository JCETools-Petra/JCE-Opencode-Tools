const COMPLETION_PATTERNS = [
  /\b(?:is\s+)?complete(?:d)?\.?\s*$/im,
  /\band\s+(?:is\s+)?complete\b/i,
  /\b(?:all|everything)\s+(?:is\s+)?done\b/i,
  /\bI(?:'ve|'m|\s+have)\s+(?:finished|completed|done)\b/i,
  /\bsuccessfully\s+(?:implemented|completed|fixed|resolved)\b/i,
  /\bready\s+(?:for\s+review|to\s+merge|to\s+ship)\b/i,
  /\b(?:task|work|implementation|feature|fix|bug|update)\s+(?:is\s+)?complete(?:d)?\b/i,
  /\bfinished\s+(?:implementing|fixing|building|coding|and)\b/i,
  /\bimplemented\s+(?:the|this|all)\b/i,
];
const EVIDENCE_PATTERNS = [/\bverification\b/i, /\bbun test\b/i, /\btypecheck\b/i, /\bpassed\b/i, /\bbuild\b/i, /\btests?\s+pass/i, /\bno\s+errors?\b/i];

export const VERIFICATION_WARNING = "\n\nVERIFICATION CHECK: This looks like a completion claim without clear verification evidence. Return to verification, or explicitly state what has not yet been verified.";

export function looksLikeCompletionClaim(text: string): boolean {
  return COMPLETION_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldWarnForMissingVerification(text: string): boolean {
  const hasEvidence = EVIDENCE_PATTERNS.some((pattern) => pattern.test(text));
  return looksLikeCompletionClaim(text) && !hasEvidence;
}
