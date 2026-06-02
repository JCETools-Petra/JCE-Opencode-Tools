---
name: write-a-skill
description: Author or improve OpenCode/JCE skills with correct frontmatter, trigger descriptions, progressive disclosure, and verification. Use when creating, editing, auditing, or packaging skills.
---

# Skill: Write A Skill

Use this skill for new or changed skill files.

## Required Shape
- Folder name is lowercase hyphen-separated.
- File path is `config/skills/<name>/SKILL.md` or user skill equivalent.
- Frontmatter has `name` matching folder.
- Description says what it does and when to use it.
- Body gives concrete rules, workflow, and output contract.

## Quality Rules
- Keep trigger narrow enough to avoid noisy loading.
- Prefer reusable rules over long essays.
- Include examples only when they change behavior.
- Avoid project secrets, private paths, or user-specific assumptions.
- Verify skill count/frontmatter tests after changes.
