---
name: git-guardrails
description: Safe Git workflow guardrails. Use when committing, pushing, branching, merging, rebasing, tagging, or blocking dangerous git operations.
---

# Skill: Git Guardrails

Use this skill for Git operations and repository safety.

## Never Do Without Explicit Approval
- `git reset --hard`
- `git clean -fd` or stronger
- `git checkout -- <path>` to discard changes
- force push
- deleting branches or tags

## Before Commit
- Inspect `git status`.
- Inspect `git diff`.
- Inspect recent commits for message style.
- Stage only intended files.
- Do not commit secrets.

## Before Push Or Tag
- Verify branch, remote, and target.
- Run relevant tests or explain blocker.
- Confirm version/changelog sync for releases.

## Output
- Intended git action.
- Files affected.
- Verification evidence.
- Risk or rollback note.
