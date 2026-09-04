# 2026-09-13 — Eval Golden Set Rebuilt on Independent (PM-Verified) Ground Truth

## Context

The 2026-09-12 evaluation harness (`backend/scripts/eval.ts`,
`docs/eval/`) had a methodology flaw the PM correctly identified: I
wrote both the golden set's transcripts *and* their expected-results
files, in the same pass, with no independent verification. That
measures whether the pipeline agrees with itself, not whether it's
correct — a model (or the session that built the pipeline) grading its
own extraction against an answer key it also invented proves nothing
credible. This entry documents the fix: the golden set was rebuilt
end-to-end with the PM as the sole author of ground truth, and the
pipeline was re-evaluated against it.

## The corrected process

For each of the 7 transcripts, in order, across this conversation:

1. **Checklist first.** I proposed a short, plain-language checklist —
   the exact actions/risks/issues/decisions/dependencies/change-signals
   the transcript would contain, each tagged FACT/INFERENCE/
   RECOMMENDATION — and stopped. The PM edited/approved it (in one
   case splitting a combined item into a separate issue + risk; in
   several cases trimming ambiguous discussion out of the planned
   transcript before it was even written). This became the fixed
   ground truth.
2. **Transcript only after approval.** I wrote a synthetic transcript
   engineered to contain exactly the approved items and nothing else,
   and stopped again for confirmation. The PM asked for specific lines
   removed twice (a contractual-SLA tangent in the supplier-risk
   transcript, and two discussion lines in the formal-decision
   transcript) specifically to eliminate ambiguity that could let the
   model extract an unintended extra item — a direct, hands-on
   editorial check on the test instrument itself, not just the answer
   key.
3. **Expected file = the approved checklist, transcribed, not
   re-derived.** Only after both approvals did I write
   `docs/eval/expected/<slug>.json` — a direct transcription of the
   already-approved checklist into `eval.ts`'s existing
   `{keywords, confidence_type}` per-item JSON shape, not a fresh
   reading of the transcript I'd just written.

Same 7 scenarios as before (schedule delay, supplier risk, budget
overrun, formal decision, dependency block, scope change, and one
routine-status transcript with no real risk — the false-positive
trap), and the same 5-question assistant-grounding set — but this time
the 5 questions and their expected answers/citations were also
presented for PM approval before being written, per the PM's explicit
instruction that those "answers I confirm" too.

`backend/scripts/eval.ts` itself required no changes — its comparison
logic never depended on who authored the golden set, only on the JSON
shape, which is unchanged. The old, invalid `docs/eval/reports/
2026-09-04-eval-run.md` was deleted (its numbers no longer correspond
to what's on disk) rather than left to be mistaken for current.

## Results (full detail + assessment: `docs/eval/reports/2026-09-04-eval-run.md`)

100% recall, 100% label accuracy on all 17 PM-approved items, zero
extracted items on the false-positive-trap transcript, 5/5 assistant
grounding, guardrails held on all 26 real API calls. Precision is
noticeably higher than the prior (invalid) run (e.g. actions 78% vs.
50%, risks 60% vs. 30%) — most likely a side effect of the PM-review
loop naturally producing tighter, more deliberately-scoped transcripts,
not a pipeline change between runs.

Manually auditing every item scored as a false positive (now a
methodologically meaningful exercise, since the ground truth isn't
self-authored) found, again, **zero fabricated content** — every one
traces to something actually said in its transcript. Three real
over-extraction patterns emerged, one of them a new finding this run
that wasn't as clearly visible with the smaller/noisier prior golden
set:

1. Actions get duplicated as near-identical decisions (recurring
   finding, unchanged from the prior run).
2. **`dependencies` triggers on almost any two-step relationship, not
   just true blockers — the dominant pattern this run, in 5 of 7
   transcripts** (vs. a single instance previously). Sharper evidence
   now that the golden set only contains one deliberately clean,
   explicitly-stated dependency (finance migration blocking production
   planning) — everything else the model calls a "dependency" is
   comparatively weak, sequencing-only inference.
3. Confidence-type labeling loses precision when one extracted item
   bundles a stated fact with a projection — concretely, the same
   $250k–$260k figure is correctly `inference` as a risk but `fact` as
   a change_signal, in the same transcript (`budget-overrun`).

All three have specific proposed prompt edits to
`backend/src/agents/meeting-analyst/prompt.ts` written up in the eval
report. **None have been applied** — the file was not touched in this
task, per the explicit instruction to propose only and wait for
approval, then re-run the eval to confirm any change actually helped.

## Explicitly not done

No changes to `backend/src/agents/*/prompt.ts` or `schema.ts`, the data
model, migrations, RLS, or approval logic. `npx tsc -b` (backend) is
clean.
