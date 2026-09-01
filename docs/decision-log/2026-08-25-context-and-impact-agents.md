# 2026-08-25 — Context Analyst + Impact Analyst (3-Agent Pipeline)

## Decision
Extended the analysis pipeline from one agent to three:
**Meeting Analyst → Context Analyst → Impact Analyst → single persistence
step**. All enrichment happens in memory before anything is written to the
DB — items aren't extracted, stored, then updated; they're extracted,
enriched, then stored once, already carrying their duplicate/relationship
flags and impact assessments. Backend only, as scoped.

## Storage: JSONB columns, scoped to where each agent actually writes
New migration `20260825100000_entity_enrichment_columns.sql` adds:
- `context_flags jsonb` on `actions`, `risks`, `decisions` — the Context
  Analyst's explicit scope ("for each new risk/action/decision").
- `impact_assessment jsonb` on `risks`, `dependencies`, `change_signals` —
  the Impact Analyst's explicit scope ("especially risks, dependencies,
  change signals").
- `risks` gets both (both agents apply to risks); `issues` gets neither
  (out of scope for both agents per this task's wording).

JSONB over a normalized table: this is still-evolving AI-derived
annotation data, not yet a first-class queried/joined entity — the same
reasoning already applied to `agent_runs.raw_output`/`input_refs`. If a
later phase needs to query "all risks flagged as duplicates" efficiently
at scale, that's the trigger to normalize; not before.

## Temporary refs: how items are addressed before they have DB ids
Meeting Analyst's draft items don't have real ids yet when Context/Impact
Analyst need to reference them. `backend/src/agents/shared/refs.ts`
(`withRefs`) tags each draft item with a scoped temporary id (`action-0`,
`risk-1`, ...), visually distinct from a UUID. Context Analyst's output can
reference either an **existing** record (real uuid, from the DB) or
**another new item** (temp ref) in `related_items` — both are valid targets
for "this relates to X." Only after both enrichment stages finish does
`backend/src/agents/pipeline.ts` merge everything back onto the draft items
by ref and hand them to the route for actual `create*` calls.

## Context Analyst: flags, never merges
Per the prompt's explicit instruction, the Context Analyst **never merges,
deletes, or blocks creation** — every new item still becomes its own
pending row. What it adds is the annotation that turns two indistinguishable
pending risks into "this looks like it restates risk X" for the human
reviewer. This was tested meaningfully, not just schema-shape-checked: the
sample meeting had already been analyzed twice before (see
`docs/decision-log/2026-08-23-meeting-analyst-agent.md`), so this run's
Context Analyst had real prior data to compare against — and correctly
flagged 6/6 actions, 2/2 decisions, and 2/3 risks as likely duplicates of
the earlier runs' records, with specific, correct relationship annotations
(`"depends on"`, `"addresses"`, `"implements"`) for the rest.

One defensive measure added after reasoning through failure modes: the
model could return a `duplicate_of_id` that doesn't match any real existing
record (a hallucinated id). `pipeline.ts` validates every returned
`duplicate_of_id` against the actual set of existing ids fetched from the
DB and nulls it out if it doesn't match, while keeping the qualitative
signal (`is_likely_duplicate`, `duplicate_reasoning`) — a human still gets
useful information even if the hard link couldn't be verified.

## Impact Analyst: confidence structurally locked to inference
The task explicitly requires impact assessments be "expressed as
clearly-labelled INFERENCE." Rather than trust the model to always choose
"inference" out of three options, `impact_assessment_annotation`'s
`confidence_type` is `z.literal('inference')` in the schema — the model
literally cannot return anything else and pass validation. `applicable`
is always stored (true or false), so "the agent considered this and found
no material impact" is a recorded, auditable outcome rather than a missing
entry that looks like an oversight.

Verified live output includes concrete, well-reasoned assessments — e.g.
the licensing change signal got `cost_impact: "The increase from 120 to
148 named user licences is driving an estimated £86,000 budget overrun..."`
with `schedule_impact`/`resource_impact` left `null` (correctly, since
nothing in that item concerns schedule or resourcing) rather than padded
with a generic guess in every field.

## Graceful degradation, not all-or-nothing
If Context or Impact Analyst fails validation after its retries (or hits
an API error), that stage's enrichment is left `null` on the affected
items — the pipeline still persists the Meeting Analyst's extraction.
Only a Meeting Analyst failure fails the whole pipeline, since there's
nothing to enrich otherwise. Every stage's outcome (success or failure) is
still logged to `agent_runs` — now 3 rows per `analyse-meeting` call
instead of 1, one per agent, each with its own `model`/`prompt_version`/
`validation_passed`.

## Refactor: shared retry/repair loop and confidence enum
With three agents now needing the identical "call the model → validate
with zod → repair-prompt retry" loop, it was extracted from
`meeting-analyst/run.ts` into `backend/src/services/llm/runStructured.ts`
(generic, parameterized). Meeting Analyst's own `run.ts` was refactored to
use it too — no behavior change, just removing the soon-to-be-triplicated
code before it triplicated. Likewise `confidenceTypeSchema` moved from
`meeting-analyst/schema.ts` to `backend/src/agents/shared/confidence.ts`,
imported by all three agents instead of redefined per-agent.

## Verified
- `npm run db:migrate` / `npm run db:verify` — new columns confirmed
  present on the correct tables via a direct column-select check (table
  existence alone doesn't prove a column was added).
- Full backend typecheck clean throughout.
- Live run against the sample Apex transcript meeting: `201`, 3
  `agent_runs` rows (one per agent, all `validation_passed: true`),
  enriched `context_flags`/`impact_assessment` populated on the expected
  item types, correct duplicate detection against real prior data (see
  above), well-reasoned per-field impact assessments.

## What It Affects
- `supabase/migrations/20260825100000_entity_enrichment_columns.sql` (new).
- `backend/src/db/types.ts` (`ContextFlags`, `ImpactAssessment`, extended
  `Action`/`Risk`/`Decision`/`Dependency`/`ChangeSignal`),
  `backend/src/db/tables/{actions,risks,decisions,dependencies,changeSignals}.ts`
  (extended `create*` inputs).
- `backend/src/services/llm/runStructured.ts` (new, shared retry/repair).
- `backend/src/agents/shared/{confidence,refs}.ts` (new, shared across agents).
- `backend/src/agents/meeting-analyst/{schema,run}.ts` (refactored to use
  the shared pieces — no behavior change).
- `backend/src/agents/context-analyst/*` (new — `schema.ts`, `prompt.ts`,
  `run.ts`, `types.ts`, `index.ts`).
- `backend/src/agents/impact-analyst/*` (new — same shape).
- `backend/src/agents/pipeline.ts` (new orchestrator).
- `backend/src/routes/ai.ts` (calls the pipeline; persists enriched items;
  logs 3 `agent_runs` rows instead of 1).
- `CLAUDE.md` — Architecture (pipeline order corrected — Impact Analyst
  runs pre-approval on every new item, not only on approved changes as
  originally sketched), Database Conventions (new columns), AI Rules (the
  3-agent pipeline's specific guarantees).
