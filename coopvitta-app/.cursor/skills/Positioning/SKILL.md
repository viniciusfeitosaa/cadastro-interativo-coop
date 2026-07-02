---
name: positioning
description: Positioning and landing page workflows. (A) Analyze and optimize SaaS landing page copy using April Dunford's methodology (competitive alternatives, unique features, value themes, target customers, market category), then generate prompts for Replit/Lovable. Use when user wants to analyze a landing page URL, improve copy, or get a vibe-coding prompt. (B) Generate prompts for Replit Design Mode: extract design tokens from a reference screenshot, then build section-by-section with Style Token Extractor and Section Builder. Use when user wants "create landing page", "Replit design mode", "build section by section", or "design mode prompt". Triggers on positioning, landing page copy, Replit, Lovable, design tokens, or section building.
---

# Positioning

Unified skill for landing page positioning, copy optimization, and prompt generation. Two workflows:

- **Workflow A: Copy Optimizer** — Analyze URL → April Dunford positioning → optimized copy → final prompt (Replit/Lovable).
- **Workflow B: Replit Design Mode** — Reference screenshot → design tokens (global.css) → section-by-section build prompts.

Choose the workflow from the user's goal (analyze/optimize copy + full prompt vs. build page in Replit Design Mode step by step).

---

# Part A: Landing Page Copy Optimizer

Analyze and optimize SaaS landing page copy using April Dunford's methodology, then generate implementation-ready prompts for vibe coding tools.

## Workflow A Overview

1. **Fetch & Analyze** - Read current copy from user's URL
2. **Positioning Analysis** - Apply April Dunford methodology
3. **Validation** - Confirm features/alternatives with user
4. **Positioning Draft** - Present for approval
5. **New Copy** - Generate optimized copy for all sections → approval
6. **Asset Collection** - Request screenshots + visual reference
7. **Final Prompt** - Generate detailed vibe coding prompt with design.json

## Step A1: Fetch & Analyze

Use `web_fetch` on the user's URL. Extract:
- Current copy (headlines, descriptions, CTAs)
- Product/service being sold
- Apparent target audience
- Existing social proof
- Current page structure
- **Language and tone** (match these in output)

## Step A2: Positioning Analysis

Apply April Dunford's methodology **in this exact order**:

### A2.1 Competitive Alternatives
Infer what customers would use if this product didn't exist:
- **Direct competitors**: Similar SaaS products
- **Indirect alternatives**: Spreadsheets, manual processes, hiring someone, doing nothing

### A2.2 Unique Features/Capabilities
Identify features ONLY this product has. **Always ask user to confirm/add features.**

### A2.3 Value Themes
For each unique feature, define the customer benefit. Group into **maximum 3 value themes**.

### A2.4 Target Customer Characteristics
Behaviors, pain points, why alternatives don't work for them.

### A2.5 Market Category
Existing category + differentiating modifier. Avoid creating new categories.

## Step A3: Validation Questions

**Always ask** about competitive alternatives, unique features, and target customer. Wait for explicit approval before generating copy.

## Step A4: Positioning Draft

Present positioning summary (Market Category, Competitive Alternatives, Unique Features, Value Themes, Target Customer). **Wait for explicit approval before proceeding.**

## Step A5: New Copy Generation

Generate copy for all sections. See [references/copy-structure.md](references/copy-structure.md).

Section order: Hero, Social Proof, Product vs. Alternatives, Features & Value, How It Works, Testimonials, Target Customers, CTA, FAQ, Footer.

Guidelines: Match language and tone; hero answers "What is this?" and "Why different?"; features = only unique; FAQ addresses objections. **Present copy for approval.**

## Step A6: Asset Collection

Ask for product screenshots and/or visual reference. Extract design patterns into design.json if reference provided.

## Step A7: Final Prompt Generation

Generate prompt for Replit/Lovable. See [references/prompt-template.md](references/prompt-template.md). Include design.json, section specs, image prompts, animation suggestions. Output copy-paste ready.

---

# Part B: Replit Design Mode Prompt Generator

Guides users through two phases: design tokens from a reference screenshot, then section-by-section build prompts.

## Workflow B Overview

```
PHASE 1: DESIGN TOKENS → User provides full landing screenshot → Style Token Extractor prompt → user configures global.css → confirm
PHASE 2: SECTION BUILDING → User provides full copy + section name + section screenshot → Section Builder prompt → repeat per section
```

## State (Workflow B)

- phase: "not_started" | "phase_1_pending" | "phase_1_complete" | "phase_2_active"
- design_reference_provided: boolean
- landing_page_copy: string | null
- sections_completed: string[]

## Starting Workflow B

Ask for a **screenshot of a landing page design** as visual reference. Explain Phase 1 (design tokens → global.css) and Phase 2 (section-by-section building).

## Phase 1: Design Token Extraction

- Validate: image attached, looks like a landing page.
- If valid: read `references/TEMPLATE-1-STYLE-EXTRACTOR.md` if present; analyze screenshot; generate copy-paste-ready Style Token Extractor prompt.
- After output: ask user to run in Replit and say "Phase 1 complete" or "Done with tokens".

## Phase 1 Complete → Start Phase 2

Ask for: (1) full landing page copy by section, (2) which section to build first, (3) screenshot of that section.

## Phase 2: Section Building

- Store landing page copy when provided.
- For each section: require section name + section screenshot + copy (already or in message).
- Read `references/TEMPLATE-2-SECTION-BUILDER.md` if present; analyze section screenshot; use copy for content; generate Section Builder prompt.
- After each prompt: list sections completed and remaining; ask which section next.

Subsequent requests: section name/number + screenshot (copy already stored).

## Validation (Workflow B)

- Do not generate prompt without an attached image that looks like a landing/section screenshot.
- Do not generate section prompt without copy + target section + section screenshot.

## Response Language (Workflow B)

- Agent responses and generated prompts in **English**.
- User's landing page copy can be any language — use as-is in prompts; do not translate.

## Template Files (Workflow B)

- `references/TEMPLATE-1-STYLE-EXTRACTOR.md` — Phase 1 design token extraction
- `references/TEMPLATE-2-SECTION-BUILDER.md` — Phase 2 section building

Read before generating prompts when present.

## Error Handling (Workflow B)

- **User skips Phase 1:** Explain need for design tokens; offer start Phase 1 or skip if already configured.
- **Low-quality screenshot:** Ask for clear, full-resolution screenshot.
- **Section not in copy:** List sections you have; ask which they mean or if they want to add content.

---

## References

- [references/copy-structure.md](references/copy-structure.md) — Section copy requirements (Workflow A)
- [references/positioning-methodology.md](references/positioning-methodology.md) — April Dunford framework detail
- [references/prompt-template.md](references/prompt-template.md) — Vibe coding prompt structure (Workflow A)
