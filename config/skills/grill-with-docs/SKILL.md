---
name: grill-with-docs
description: Plan challenge with docs, domain language, context files, and ADRs. Use when reviewing plans, architecture choices, PRDs, domain models, or decisions before implementation.
---

# Skill: Grill With Docs

Use this skill before approving a plan or architecture decision.

## Rules
- Read local context before judging: `.opencode-context.md`, `.opencode-jce/context/`, `CONTEXT.md`, `docs/adr/`, README, and domain docs when present.
- Challenge terminology against existing domain language.
- Ask whether proposed names, boundaries, and workflows match current code.
- Prefer one reversible decision over broad redesign.
- If decision is durable, record it in context or ADR format.

## Review Questions
- What existing concept does this overlap?
- What invariant can this break?
- What user behavior changes?
- What simpler option was rejected, and why?
- What evidence proves this plan fits current architecture?

## Output
- Decision: accept, revise, or reject.
- Risks: concrete failure modes.
- Required docs/context updates.
- Smallest next step.
