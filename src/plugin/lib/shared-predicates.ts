/**
 * Shared predicate functions used across execution-policy and final-review-gate.
 * Eliminates duplication and ensures consistent behavior.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasAcceptedReview(reviews: string[] = []): boolean {
  return reviews.some(
    (review) =>
      /^accepted(?:$|[:\s])/i.test(review.trim()) ||
      /\b(?:status|review)\s*[:=]\s*accepted\b/i.test(review),
  );
}

export function hasAcceptedAllReviews(reviews: string[]): boolean {
  return (
    reviews.length > 0 &&
    reviews.every(
      (review) =>
        /^accepted(?:$|[:\s])/i.test(review.trim()) ||
        /\b(?:status|review)\s*[:=]\s*accepted\b/i.test(review),
    )
  );
}

export function hasUnresolvedExhaustedRetry(entry: unknown): boolean {
  if (!isRecord(entry)) return false;
  if (entry.resolved === true || entry.reviewStatus === "accepted" || entry.status === "completed") return false;
  const exhaustedText = [entry.failureReason, entry.handoffReason, entry.status, entry.recoveryStatus].some(
    (value) => typeof value === "string" && /(?:retry (?:budget|limit) )?exhausted/i.test(value),
  );
  if (exhaustedText || entry.retryExhausted === true || entry.exhausted === true) return true;
  const failureMarker =
    [entry.status, entry.reviewStatus, entry.logicalState].some(
      (value) => typeof value === "string" && /^(blocked|error|failed)$/i.test(value.trim()),
    ) ||
    typeof entry.failureReason === "string" ||
    typeof entry.handoffReason === "string";
  return (
    typeof entry.retryCount === "number" &&
    typeof entry.maxRetries === "number" &&
    Number.isFinite(entry.maxRetries) &&
    entry.maxRetries >= 0 &&
    entry.retryCount >= entry.maxRetries &&
    failureMarker
  );
}
