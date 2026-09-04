# 2026-09-12 — AI Pipeline Evaluation Harness

> **Superseded**: this entry's golden set had a methodology flaw — the
> same session that built the pipeline also authored its answer key,
> which measures self-consistency, not correctness. Corrected in
> `docs/decision-log/2026-09-13-eval-golden-set-independent-ground-truth.md`,
> which replaced every transcript/expected file with PM-authored,
> PM-approved ground truth. The harness mechanics described below
> (`backend/scripts/eval.ts`'s design) are still accurate and were kept
> as-is; only the golden set's provenance changed. The specific
> numbers/examples below are from the old, invalid run and no longer
> match what's on disk — see the 09-13 entry for current results.

## Context

The Phase 6 test suite (`backend/tests/`, Vitest) mocks the single LLM
seam (`services/llm/index.ts`'s `generateStructured`) — deterministic
and offline, but it only proves the code *around* the model (retry
loop, schema validation, graceful degradation) behaves correctly. It
says nothing about whether the model itself extracts the right things,
labels FACT/INFERENCE/RECOMMENDATION correctly, or hallucinates. Before
calling ProjectIQ shippable, that needed to be measured against a
golden set with known-correct answers, using the real Claude API — the
same reasoning already established in this codebase for why
`backend/scripts/test-rls-isolation.ts` is a separate real-dependency
script outside the Vitest suite ("mocking it would make it prove
nothing," per `docs/decision-log/2026-09-03-automated-test-suite.md`).
This is that same category of thing, for the LLM axis instead of the
RLS axis.

## Design decision: call the agents directly, not `runMeetingAnalysisPipeline`

Exploration found `runMeetingAnalysisPipeline`
(`backend/src/agents/pipeline.ts`) is *not* a pure function of its
`{transcript, project, meeting}` argument — it internally calls
`listActionsByProject`/`listRisksByProject`/`listDecisionsByProject`
against the real Supabase DB to build the Context Analyst's "existing
items" list. The three extraction agents
(`runMeetingAnalyst`/`runContextAnalyst`/`runImpactAnalyst`) and the
Project Assistant (`runProjectAssistant`) are themselves pure and
DB-free — plain in-memory objects/arrays in, structured output out,
only `ANTHROPIC_API_KEY` required. The harness
(`backend/scripts/eval.ts`) calls these four functions directly,
treating each golden transcript as an isolated mini-project with no
prior history (`existingActions/Risks/Decisions: []` for the Context
Analyst — duplicate-detection quality is out of scope for this round).

Result: the entire harness runs with **zero database writes and zero
DB dependency** — only the real Anthropic API. No seed/cleanup step, no
risk of polluting the real Apex org's data, safely re-runnable any
time via `npm run eval`.

## The golden set

`docs/eval/transcripts/` — 7 synthetic Apex Manufacturing ERP
Transformation Programme transcripts (same cast as
`backend/scripts/seed.ts`'s demo data), one per required scenario:
schedule delay, supplier risk, budget overrun, formal decision,
dependency block, scope change, and — deliberately — one routine status
update with **no** real risk, to test false positives.
`docs/eval/expected/<slug>.json` — one hand-authored expected-items
file per transcript: a minimal (not exhaustive) list of items a careful
PM would expect, each with `keywords` (case-insensitive substrings
that must all appear in an extracted item's text to count as a match)
and the expected `confidence_type`. `docs/eval/assistant-questions.json`
— 5 Q&A pairs run against a hand-built, known-good mini-project
(assembled from the golden set's expected items, not the pipeline's
actual output), including one question the data does not support.

## What the harness scores

Per category: hits / misses / false positives (bipartite-matched — each
expected item consumes at most one extracted item, so results aren't
double-counted), precision, recall, and label accuracy (FACT/INFERENCE/
RECOMMENDATION correctness, scored separately from hit/miss). Items
labeled `recommendation` that don't match an expected item are reported
separately as "extra recommendations," not counted as false positives —
a recommendation is the agent's own unprompted advice, which a golden
set can't enumerate in advance. Assistant grounding is scored on
keyword presence, `data_gap` correctness, and citation correctness
(re-validated against known ids, mirroring the real
`POST /api/ai/project-query` route's defense-in-depth citation check).
Guardrails are verified two ways: structurally (every one of the four
agent schemas was confirmed to have no `approval_status`/`approved_by`
field at all — auto-approval is not representable in agent output —
and the Impact Analyst's `confidence_type` is `z.literal('inference')`
in its schema), and empirically (the harness asserts
`validationPassed === true` on every real call as proof those
structural guardrails held for real model output, not just
hypothetically).

## Results (full detail: `docs/eval/reports/2026-09-04-eval-run.md`)

100% recall, 100% label accuracy on all golden-set-defined items, zero
extracted items on the false-positive-trap transcript, 5/5 assistant
grounding, guardrails held on all 26 real API calls. The raw precision
numbers (11–50% per category) look weak in isolation but are a
golden-set completeness artifact, not a pipeline defect — manually
auditing all 41 items scored as "false positives" found zero fabricated
content; every one traces to something actually said in its transcript.
Two real, specific over-extraction patterns did surface from that
manual audit (not from the automated score): actions routinely get
duplicated as near-identical decisions (5 of 7 transcripts), and
`change_signal` impact statements occasionally get labeled `fact` for
what's really a forward projection — less rigorously than the
equivalent, already-well-handled risk-severity guardrail. Specific
prompt-edit proposals for both are written up in the eval report.
**Neither has been applied** — `backend/src/agents/meeting-analyst/
prompt.ts` was not touched in this task, per the explicit instruction
to propose only and wait for approval.

## One self-correction worth recording

The first run scored a real hit as a miss: the `scope-change` golden
file's keyword was `"regulatory"`, but the model's actual (entirely
correct) output used the word `"regulation"` — a harness bug, not a
pipeline bug. Fixed the keyword to the stem `"regulat"` and re-ran the
full eval for a clean final report, rather than leave a known-wrong
number in the permanent record. Both runs are otherwise consistent.

## Note on the report's date

`docs/eval/reports/2026-09-04-eval-run.md` is named from the actual
system clock at run time (the script's own `today()` helper), which is
independent of this decision-log entry's sequential dating — both are
accurate to when each was actually produced.

## Explicitly not done

No changes to `backend/src/agents/*/prompt.ts` or `schema.ts`, the data
model, migrations, RLS, or approval logic. `npx tsc -b` (backend) is
clean, including the new `scripts/eval.ts`.
