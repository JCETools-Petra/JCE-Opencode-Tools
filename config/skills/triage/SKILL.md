---
name: triage
description: Issue and bug triage workflow. Use when classifying reports, prioritizing bugs, assigning labels, identifying repro steps, or deciding whether work is ready.
---

# Skill: Triage

Use this skill for incoming issues, bug reports, and vague requests.

## States
- Needs info: missing repro, environment, expected behavior, or logs.
- Needs reproduction: enough detail exists, but not verified.
- Confirmed: reproduced or evidence is strong.
- Duplicate: same root cause already tracked.
- Out of scope: not owned by this project.
- Ready: has scope, acceptance criteria, and verification path.

## Checklist
- Identify product area and affected version.
- Extract expected vs actual behavior.
- Find smallest repro path.
- Estimate severity from user impact, not noise.
- Add labels only from project vocabulary when known.
- Do not promise fix before root cause evidence.

## Output
- State.
- Severity.
- Missing info.
- Suggested owner/agent.
- Next action.
