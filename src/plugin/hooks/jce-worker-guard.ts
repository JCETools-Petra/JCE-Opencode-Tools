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
  /\b(?:selesai|beres|sudah\s+(?:selesai|beres|kelar))\b/i,
];
const EVIDENCE_PATTERNS = [/\bverification\b/i, /\bbun test\b/i, /\btypecheck\b/i, /\bpassed\b/i, /\bbuild\b/i, /\btests?\s+pass/i, /\bno\s+errors?\b/i];

const STOP_EARLY_PATTERNS = [
  /\blet\s+me\s+know\s+if\b/i,
  /\banything\s+else\b/i,
  /\b(?:continue|lanjut)\s+(?:later|nanti)\b/i,
  /\b(?:I'll|I\s+will|saya\s+akan)\s+(?:wait|tunggu)\b/i,
  /\b(?:please|mohon|tolong)\s+(?:confirm|konfirmasi)\b/i,
  /\b(?:can|could)\s+you\s+confirm\b/i,
  /\b(?:stop|stopping|berhenti)\s+(?:here|di\s+sini|dulu)\b/i,
  /\b(?:sisanya|selebihnya|tinggal)\b/i,
  /\b(?:kurang\s+lebih|roughly|more\s+or\s+less)\b/i,
];

export const VERIFICATION_WARNING = "\n\nVERIFICATION CHECK: This looks like a completion claim without clear verification evidence. Return to verification, or explicitly state what has not yet been verified.";

export function looksLikeCompletionClaim(text: string): boolean {
  return COMPLETION_PATTERNS.some((pattern) => pattern.test(text));
}

export function looksLikeStopEarlyOrConfirmation(text: string): boolean {
  return looksLikeCompletionClaim(text) || STOP_EARLY_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldWarnForMissingVerification(text: string): boolean {
  const hasEvidence = EVIDENCE_PATTERNS.some((pattern) => pattern.test(text));
  return looksLikeCompletionClaim(text) && !hasEvidence;
}
