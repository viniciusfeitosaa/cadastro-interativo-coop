# GSD (Get Shit Done) — reference mirror

**Canonical source:** [github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) (MIT). **Package:** [npmjs.com/package/get-shit-done-cc](https://www.npmjs.com/package/get-shit-done-cc). This file condenses the upstream README, `docs/ARCHITECTURE.md`, `docs/COMMANDS.md`, and `docs/CONFIGURATION.md` opening schema; for line-level flags and edge cases, use the raw URLs below.

**Raw docs (replace `main` if you pin a release):**

- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/README.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/USER-GUIDE.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/COMMANDS.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/CONFIGURATION.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/ARCHITECTURE.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/FEATURES.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/CLI-TOOLS.md`
- `https://raw.githubusercontent.com/gsd-build/get-shit-done/main/docs/INVENTORY.md`

---

## One-line pitch (from README)

Light-weight **meta-prompting**, **context engineering**, and **spec-driven development** for Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, **Cursor**, Windsurf, and more—solves **context rot** (quality drop as the AI fills its context window).

---

## Install

```bash
npx get-shit-done-cc@latest
```

- **Profiles:** `--profile=core` (six core-loop skills), `--profile=standard` (core + phase management), default full install; compose e.g. `--profile=core,audit`; `--minimal` ≡ `--profile=core`.
- **Automation:** upstream documents `claude --dangerously-skip-permissions` as the intended frictionless mode for Claude Code.
- **Containers / Docker:** set `CLAUDE_CONFIG_DIR` before install to avoid tilde-expansion issues.
- **Re-install:** same `npx` command is idempotent.

---

## Returning to GSD (README callout)

1. Run `/gsd-map-codebase` to re-index the codebase.  
2. Run `/gsd-new-project` to rebuild GSD planning context.  
3. Check [CHANGELOG](https://github.com/gsd-build/get-shit-done/blob/main/CHANGELOG.md) for release notes.

---

## Why it works (README)

1. **Context bloat** — Heavy work in **fresh** subagent contexts; main session stays ~30–40%.  
2. **No shared memory** — Structured artefacts in `.planning/` survive session resets.  
3. **No verification** — `/gsd-verify-work` plus debug agents and fix plans before “done”.

---

## Main loop commands (README table)

| Command | Role |
|---------|------|
| `/gsd-new-project` | Questions → research → requirements → roadmap |
| `/gsd-discuss-phase [N]` | Capture implementation decisions before planning |
| `/gsd-plan-phase [N]` | Research + plan + verify |
| `/gsd-execute-phase` | Execute plans in parallel waves |
| `/gsd-verify-work [N]` | Manual acceptance testing |
| `/gsd-ship [N]` | Create PR from verified phase work |
| `/gsd-progress --next` | Auto-detect and run next step |
| `/gsd-complete-milestone` | Archive milestone and tag release |
| `/gsd-new-milestone` | Start next version |
| `/gsd:surface` | Enable/disable skill clusters at runtime (Gemini colon namespace spelling where applicable) |

---

## Command syntax (from COMMANDS.md)

- **Claude Code / Copilot / OpenCode / Kilo:** `/gsd-command-name [args]` (hyphen form).  
- **Gemini CLI:** `/gsd:command-name [args]` (colon form — namespaced).  
- **Codex:** `$gsd-command-name [args]`.

---

## Namespace meta-skills (v1.40, #2792)

Six routers (~120 tokens) replace flat eager listing of many skills; **all concrete commands stay directly invocable**.

| Command | Routes to |
|---------|-----------|
| `/gsd-workflow` | discuss / plan / execute / verify / phase / progress |
| `/gsd-project` | milestones, audits, summary |
| `/gsd-quality` | code review, debug, audit, security, eval, ui |
| `/gsd-context` | map, graphify, docs, learnings |
| `/gsd-manage` | config, workspace, workstreams, thread, update, ship, inbox |
| `/gsd-ideate` | explore, sketch, spike, spec, capture |

---

## Core workflow commands (detail summary)

- **`/gsd-new-project`** — Prereq: no `.planning/PROJECT.md`. Produces PROJECT, REQUIREMENTS, ROADMAP, STATE, `config.json`, `research/`, `CLAUDE.md`. Flags: `--auto @file.md`.  
- **`/gsd-workspace`** — Isolated workspaces/worktrees; `--new`, `--list`, `--remove`, `--repos`, `--strategy worktree|clone`, etc.  
- **`/gsd-discuss-phase`** — Produces `{phase}-CONTEXT.md`, `{phase}-DISCUSSION-LOG.md`. Flags: `--all`, `--auto`, `--batch`, `--analyze`, `--power`, `--assumptions`.  
- **`/gsd-ui-phase`** — `{phase}-UI-SPEC.md` for UI-heavy phases.  
- **`/gsd-plan-phase`** — `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`, `{phase}-VALIDATION.md`. Flags include `--skip-research`, `--research-phase`, `--view`, `--gaps`, `--skip-verify`, `--prd`, `--ingest`, `--reviews`, `--validate`, `--bounce`, `--skip-bounce`, `--auto`. Package legitimacy / slopcheck behaviour v1.42.1 documented in USER-GUIDE.  
- **`/gsd-plan-review-convergence`** — Cross-AI plan/review loops; `--codex` / `--gemini` / `--claude` / `--opencode`, `--all`, `--max-cycles`.  
- **`/gsd-ultraplan-phase`** — BETA: remote ultraplan + `/gsd-import`.  
- **`/gsd-execute-phase`** — Waves; `--wave N`, `--validate`, `--cross-ai`, `--no-cross-ai`. Install failures → human checkpoint (no silent package rename).  
- **`/gsd-verify-work`** — `{phase}-UAT.md`, fix plans.  
- **`/gsd-ship`** — PR via `gh`; `--draft`; body from planning artefacts + optional `ship.pr_body_sections`.  
- **`/gsd-ui-review`**, **`/gsd-audit-uat`**, **`/gsd-audit-milestone`**, **`/gsd-complete-milestone`**, **`/gsd-milestone-summary`**, **`/gsd-new-milestone`**, **`/gsd-phase`**, **`/gsd-validate-phase`** — Phase/milestone CRUD and audits.

---

## Navigation and session

- **`/gsd-progress`** — Status; `--next` auto-routes; `--do "..."` intent dispatch; `--forensic` integrity audit.  
- **`/gsd-resume-work`**, **`/gsd-pause-work`** (`--report`), **`/gsd-manager`** (dashboard, background execute, checkpoint heartbeats #2410, `manager.flags` in config), **`/gsd-help`**.

---

## Utility and quality

- **`/gsd-explore`**, **`/gsd-undo`** (`--last`, `--phase`, `--plan`), **`/gsd-import`**, **`/gsd-ingest-docs`**, **`/gsd-quick`** (`--full`, `--validate`, `--discuss`, `--research`), **`/gsd-autonomous`**, **`/gsd-debug`**, **`/gsd-add-tests`**, **`/gsd-stats`**, **`/gsd-profile-user`**, **`/gsd-health`**, **`/gsd-cleanup`**, **`/gsd-spike`**, **`/gsd-sketch`**, **`/gsd-forensics`**, **`/gsd-extract-learnings`**, **`/gsd-workstreams`**, **`/gsd-settings`**, **`/gsd-config`**, **`/gsd-surface`**.

---

## Context and codebase

- **`/gsd-map-codebase`**, **`/gsd-graphify`**, **`/gsd-ai-integration-phase`**, **`/gsd-eval-review`**, **`/gsd-update`**.

---

## Review, security, docs

- **`/gsd-code-review`**, **`/gsd-audit-fix`**, **`/gsd-fast`**, **`/gsd-review`**, **`/gsd-pr-branch`**, **`/gsd-secure-phase`**, **`/gsd-docs-update`**, **`/gsd-capture`**, **`/gsd-review-backlog`**, **`/gsd-thread`**.

*(Authoritative per-command flags and examples: `docs/COMMANDS.md` — >1400 lines.)*

---

## Architecture (condensed from ARCHITECTURE.md)

**Stack:** User → **commands** (`commands/gsd/*.md`) → **workflows** (`get-shit-done/workflows/*.md`) → **agents** (`agents/*.md`, fresh context) → **CLI** (`gsd-sdk query`, `gsd-tools.cjs`) → **`.planning/`** filesystem state.

**Design principles**

1. Fresh context per agent (up to ~200K, more for 1M-class models with adaptive enrichment).  
2. Thin orchestrators (workflows spawn; they do not “implement” features).  
3. File-based state (Markdown + JSON; git-friendly).  
4. **Absent = enabled** for workflow feature flags in config.  
5. Defense in depth: plan check, atomic commits per task, verification, UAT.

**Wave execution** — Plans grouped by dependencies; parallel within a wave, sequential across waves. Parallel commit safety: e.g. `--no-verify` during parallel agent commits + hook run after wave; `STATE.md` lockfile for RMW races.

**Components:** commands, workflows (size tiers XL/LARGE/DEFAULT; `discuss-phase` split into `modes/` + `templates/`), agents (~31 shipped per INVENTORY), references (`get-shit-done/references/*.md`), templates, hooks (`gsd-statusline.js`, `gsd-context-monitor.js`, `gsd-prompt-guard.js`, … — see INVENTORY), SDK bridge, `bin/` modules (`core.cjs`, `state.cjs`, `phase.cjs`, `roadmap.cjs`, `config.cjs`, `verify.cjs`, …).

**Primary agent categories (taxonomy):** Researchers, Synthesizers, Planners, Checkers, Executors, Verifiers, Mappers, Debuggers, Auditors, Doc Writers, Profilers, Analyzers — see ARCHITECTURE for the full table.

---

## `.planning/` artefacts (conceptual)

| Artefact | Role |
|----------|------|
| `PROJECT.md` | Vision |
| `REQUIREMENTS.md` | Scope |
| `ROADMAP.md` | Phases |
| `STATE.md` | Current position and decisions |
| `CONTEXT.md` (per phase) | Implementation decisions from discuss |
| `config.json` | Mode, models, workflow toggles, git, gates, parallelization, … |
| `phases/`, `research/` | Phase dirs and research outputs |
| Plans / summaries / verification | `{phase}-*PLAN.md`, `SUMMARY.md`, `VERIFICATION.md`, `UAT.md`, etc. |

---

## Configuration file (from CONFIGURATION.md)

Path: **`.planning/config.json`**. Created by `/gsd-new-project`, edited via `/gsd-settings`.

**Documented default-shaped schema (upstream; keys may evolve):**

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "models": {},
  "dynamic_routing": null,
  "planning": {
    "commit_docs": true,
    "search_gitignored": false,
    "sub_repos": []
  },
  "context": null,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "ui_review": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "max_discuss_passes": 3,
    "skip_discuss": false,
    "human_verify_mode": "end-of-phase",
    "tdd_mode": false,
    "text_mode": false,
    "use_worktrees": true,
    "code_review": true,
    "code_review_depth": "standard",
    "plan_bounce": false,
    "plan_bounce_script": null,
    "plan_bounce_passes": 2,
    "plan_chunked": false,
    "code_review_command": null,
    "cross_ai_execution": false,
    "cross_ai_command": null,
    "cross_ai_timeout": 300,
    "security_enforcement": true,
    "security_asvs_level": 1,
    "security_block_on": "high",
    "post_planning_gaps": true,
    "build_command": null,
    "test_command": null
  },
  "code_quality": {
    "fallow": {
      "enabled": false,
      "scope": "phase",
      "profile": "standard",
      "mcp": false
    }
  },
  "ship": {
    "pr_body_sections": []
  },
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "statusline": {
    "context_position": "end"
  },
  "review": {
    "default_reviewers": null,
    "models": {}
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "create_tag": true,
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "project_code": null,
  "agent_skills": {},
  "response_language": null,
  "features": {
    "thinking_partner": false,
    "global_learnings": false
  }
}
```

**README configuration highlights**

| Area | Meaning |
|------|---------|
| `mode` | `interactive` vs `yolo` (auto-approve) |
| Model profiles | `quality` / `balanced` / `budget` |
| `workflow.research` / `plan_check` / `verifier` | Quality agents (tokens + time) |
| `parallelization.enabled` | Parallel independent plans |
| `code_quality.fallow` | Optional structural pre-pass for code review; `FALLOW.json`; needs `fallow` npm or Rust binary v2.70+ per README |

ADR-0011 documents profile / runtime surface budget module.

---

## Troubleshooting (from README)

- **Commands missing:** restart the IDE/agent after install. Install paths differ by runtime (e.g. `~/.claude/skills/gsd-*/`, `~/.codex/skills/`).  
- **Codex:** minimum CLI **0.130.0**; older versions could duplicate skill roots.  
- **Broken install:** re-run `npx get-shit-done-cc@latest`.  
- **Full table:** USER-GUIDE troubleshooting + uninstall sections.

---

## MCP and token budget (ARCHITECTURE note)

Heavy MCP servers can dominate per-turn tokens; GSD addresses listing cost via namespace routers—**MCP toggles live in the host** (e.g. Claude `enabledMcpjsonServers` / `disabledMcpjsonServers`), not inside GSD config.

---

## License

MIT — see upstream `LICENSE`.
