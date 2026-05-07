# Chinese Output Auto-Translation Design

## Goal

Automatically translate detected Chinese text in AI-controlled outputs into English, without asking the user for confirmation each time.

## User Choice

The user selected replacement mode:

- Visible output should be English only when translation succeeds.
- Original Chinese text should not be shown in the normal successful path.
- If translation fails, preserve the original output and add a clear warning.

## Non-Goals

- Do not translate user input.
- Do not translate source code, file contents, commands, logs, stack traces, URLs, or structured data unless they are part of a natural-language assistant/subagent response.
- Do not add an external translation service or require API keys.
- Do not silently delete text if translation fails.
- Do not block task execution only because translation failed.

## Scope

v1 applies to outputs the plugin can reliably control:

- `bg_collect` output from delegated background agents.
- String outputs processed by `tool.execute.after` when safe.

v1 does not guarantee filtering of every top-level assistant message if OpenCode does not expose a mutable final assistant-message hook.

## Detection

Detect Chinese with Unicode script/range checks:

- CJK Unified Ideographs.
- CJK Extension blocks when supported by JavaScript regex.
- Common Chinese punctuation.

Detection should require a small threshold to avoid false positives from isolated symbols. Initial threshold:

- At least 2 Chinese characters, or
- At least 1 Chinese character plus Chinese punctuation.

## Translation Strategy

Use the existing OpenCode client/model path when available from plugin context.

Expected translator behavior:

- Input: full text that contains Chinese.
- Output: English translation preserving formatting, lists, Markdown headings, code fences, inline code, commands, URLs, file paths, and technical identifiers.
- Instruction: translate Chinese natural language to English only; do not summarize; do not add new facts.

If no translator/client is available, return original text with warning.

## Output Rules

Successful translation:

- Return translated English text.
- Append short note:
  `Chinese text was automatically translated to English.`

Failed translation:

- Return original text.
- Append warning:
  `Chinese text was detected, but automatic translation failed. Original output preserved.`

No Chinese detected:

- Return original text unchanged.

## Safety Rules

- Never translate inside fenced code blocks.
- Never translate inline code spans.
- Never alter command lines, URLs, file paths, JSON snippets, or stack traces.
- If preserving formatting cannot be done confidently, translate the whole natural-language response with strict instructions and rely on tests for code-fence preservation.
- Do not retry translation more than once in v1.

## Integration Points

### `bg_collect`

Apply filter after delegated output review/recovery formatting, before returning collected result to user.

This catches output from:

- `jce-researcher`
- `oracle`
- `explorer`
- `frontend`

### `tool.execute.after`

Apply filter to `output.output` only when:

- `output.output` is a string.
- Chinese is detected.
- The output is not file content from `Write` or `Edit` tool processing.

The filter should run after existing warning/gate text is appended, so warnings are preserved and translated output remains final.

## Components

Create `src/plugin/lib/chinese-output-filter.ts`:

- `containsChinese(text: string): boolean`
- `filterChineseOutput(text: string, translator?: ChineseTranslator): Promise<string>`
- `ChineseTranslator` type: `(text: string) => Promise<string>`
- warning/note constants.

Create translator adapter near plugin entry if OpenCode client supports chat/completion calls. If client API cannot be used safely, leave translator optional and rely on fallback warning until an adapter is confirmed.

## Testing Strategy

Unit tests for detection:

- English text returns false.
- Chinese sentence returns true.
- Single CJK symbol without punctuation returns false.
- Chinese punctuation plus Chinese char returns true.

Unit tests for filtering:

- No Chinese returns unchanged text.
- Chinese with translator returns translated text plus note.
- Chinese with translator failure returns original text plus warning.
- Mixed Markdown with code fence preserves code fence in translator input/output expectation.

Integration-style tests:

- `bg_collect` applies translation filter to completed delegated output.
- `tool.execute.after` applies translation to string output when Chinese is detected and translator is configured.

## Open Questions Resolved

- Replacement mode: English-only successful output.
- User confirmation: not required per response.
- Translation fallback: preserve original output with warning.

## Acceptance Criteria

- Chinese text in delegated agent output is automatically translated to English when translator is available.
- User is not asked whether to translate.
- Successful translation replaces visible Chinese output with English output plus a short note.
- Failed translation preserves original output and adds warning.
- English-only output is unchanged.
- Code fences and inline code are not altered by filter logic or translator instructions.
- Tests cover detection, success, failure, and delegated output integration.
