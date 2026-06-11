/**
 * Multi-workstream detector.
 *
 * Decides whether a user message describes SEVERAL independent workstreams that
 * should each become their own concurrent graph, versus a single task.
 *
 * Design priority: PRECISION over recall. A false positive spawns extra
 * background graphs (expensive, possible runaway), so this only fires on
 * explicit structural signals:
 *   1. A numbered/bulleted list of 2+ items that each read like an action.
 *   2. An explicit "in parallel / secara paralel" framing joined across 2+
 *      clearly separated action clauses.
 *
 * Plain multi-step prose ("do X then Y") is intentionally NOT split — that is
 * a single sequential workstream the normal planner already handles.
 */

const ACTION_LEAD = /\b(fix|debug|investigate|implement|update|refactor|audit|review|analyze|analyse|check|verify|repair|add|remove|clean|create|migrate|optimize|optimise|build|test|document|prepare|deploy|ship|release|setup|configure|write|implementasikan|lanjutkan|perbaiki|cek|analisis|ubah|hapus|rapikan|buat(?:kan)?|tambah(?:kan)?|optimalkan|uji|dokumentasikan|siapkan|rilis)\b/i;

const PARALLEL_HINT = /\b(in parallel|concurrently|simultaneously|at the same time|secara paralel|paralel|bersamaan|sekaligus)\b/i;

export interface WorkstreamDetection {
  isMulti: boolean;
  workstreams: string[];
  reason: string;
}

function single(reason: string): WorkstreamDetection {
  return { isMulti: false, workstreams: [], reason };
}

function looksLikeAction(text: string): boolean {
  return ACTION_LEAD.test(text) && text.trim().length >= 6;
}

/** Extract numbered (1. / 1)) or bulleted (- / *) list items, one per line. */
function extractListItems(message: string): string[] {
  const items: string[] = [];
  for (const rawLine of message.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(?:\d+[.)]|[-*•])\s+(.{3,200})$/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

export function detectWorkstreams(message: string, maxWorkstreams = 4): WorkstreamDetection {
  const trimmed = (message ?? "").trim();
  if (!trimmed) return single("empty message");

  // Signal 1: explicit list of independent action items.
  const listItems = extractListItems(trimmed);
  const actionableItems = listItems.filter(looksLikeAction);
  if (actionableItems.length >= 2) {
    return {
      isMulti: true,
      workstreams: actionableItems.slice(0, maxWorkstreams),
      reason: `explicit list of ${actionableItems.length} independent action item(s)`,
    };
  }

  // Signal 2: explicit parallel framing across separated action clauses.
  if (PARALLEL_HINT.test(trimmed)) {
    const clauses = trimmed
      .split(/\s*(?:[;\n]|,\s*(?:dan|and)\s+|\b(?:dan|and)\b)\s*/i)
      .map((c) => c.replace(PARALLEL_HINT, "").trim())
      .filter((c) => looksLikeAction(c));
    const unique = Array.from(new Set(clauses));
    if (unique.length >= 2) {
      return {
        isMulti: true,
        workstreams: unique.slice(0, maxWorkstreams),
        reason: `explicit parallel framing across ${unique.length} action clause(s)`,
      };
    }
  }

  return single("no explicit multi-workstream signal");
}
