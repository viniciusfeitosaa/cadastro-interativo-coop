---
name: get-shit-done
description: Applies the GSD (Get Shit Done) meta-prompting and spec-driven workflow—requirements, research, phased discuss/plan/execute/verify/ship, subagent-style fresh context, and .planning artifacts. Use when the user names GSD, /gsd-* commands, context rot, spec-driven development with Claude Code or Cursor, or wants behaviour aligned with https://github.com/gsd-build/get-shit-done.
disable-model-invocation: true
---

# Get Shit Done (GSD)

Upstream: [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) (MIT). GSD is a **meta-prompting, context engineering, and spec-driven** system for AI coding agents (Claude Code, Cursor, Codex, Copilot, Gemini CLI, OpenCode, Kilo, Windsurf, etc.). It targets **context rot** by moving heavy work into **fresh subagent-scale contexts** and **file-based shared memory** under `.planning/`.

## When this skill applies

- User mentions **GSD**, **get-shit-done**, **`/gsd-*`**, **spec-driven loop**, or **rebuild planning context**.
- User wants the **same phases and artefacts** (PROJECT, ROADMAP, STATE, per-phase PLAN/RESEARCH/VERIFY) without running the npm installer.
- User is **installing or troubleshooting** GSD in this repo or on a machine.

## First action

Read **[reference.md](reference.md)** in this folder for the consolidated mirror of the upstream README, architecture, full command roster, `config.json` schema summary, troubleshooting, and links to every official doc on GitHub.

## Core loop (six steps)

| Step | Command (Claude/OpenCode-style) | Role |
|------|----------------------------------|------|
| 1 | `/gsd-new-project` | Questions → research → requirements → roadmap; user approves |
| 2 | `/gsd-discuss-phase N` | Capture implementation decisions before planning |
| 3 | `/gsd-plan-phase N` | Research → plan → verify (plans sized for fresh context) |
| 4 | `/gsd-execute-phase N` | Execute plans in parallel **waves**; atomic commits per task |
| 5 | `/gsd-verify-work N` | UAT; failures get diagnosed fix plans |
| 6 | `/gsd-ship N` / `/gsd-complete-milestone` / `/gsd-new-milestone` | PR from verified work; archive milestone; next version |

**Brownfield:** `/gsd-map-codebase` first, then `/gsd-new-project`. **Stale GSD context:** README says run `/gsd-map-codebase` then `/gsd-new-project` to rebuild planning context.

**Navigation:** `/gsd-progress`, `/gsd-progress --next`, `/gsd-resume-work`, `/gsd-pause-work`.

## Install (official)

```bash
npx get-shit-done-cc@latest
```

Installer chooses runtime (includes **Cursor**) and global vs local. Profiles: `--profile=core`, `--profile=standard`, `--minimal` (alias for `core`), composable e.g. `--profile=core,audit`. See upstream [USER-GUIDE.md](https://github.com/gsd-build/get-shit-done/blob/main/docs/USER-GUIDE.md).

## Emulating GSD inside Cursor (no installer)

When the user does not have slash commands installed, approximate the same outcomes:

1. **Scaffold** `.planning/` with `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and `config.json` (use schema in [reference.md](reference.md)).
2. **Per phase:** produce `{phase}-CONTEXT.md` after discussion, `{phase}-RESEARCH.md` and `{phase}-{n}-PLAN.md` after planning, run **verification** before execution, **execute** in dependency-ordered batches, update **STATE.md** after each boundary.
3. **Keep the main chat shallow**—delegate large reads/plan/execute bursts to subagents or new sessions with only the artefact paths needed.
4. **Verify** with a checklist tied to requirements IDs before declaring a phase done.

## Namespace routers (v1.40+)

Six meta-skills reduce eager listing token cost; all concrete commands remain invocable. Table in [reference.md](reference.md#namespace-meta-skills).

## Further reading (all upstream)

| Doc | URL |
|-----|-----|
| User Guide | `https://github.com/gsd-build/get-shit-done/blob/main/docs/USER-GUIDE.md` |
| Commands | `https://github.com/gsd-build/get-shit-done/blob/main/docs/COMMANDS.md` |
| Configuration | `https://github.com/gsd-build/get-shit-done/blob/main/docs/CONFIGURATION.md` |
| Architecture | `https://github.com/gsd-build/get-shit-done/blob/main/docs/ARCHITECTURE.md` |
| Features | `https://github.com/gsd-build/get-shit-done/blob/main/docs/FEATURES.md` |
| CLI Tools | `https://github.com/gsd-build/get-shit-done/blob/main/docs/CLI-TOOLS.md` |
| Changelog | `https://github.com/gsd-build/get-shit-done/blob/main/CHANGELOG.md` |
