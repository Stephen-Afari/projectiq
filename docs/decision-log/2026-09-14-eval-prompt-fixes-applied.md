# 2026-09-14 — Meeting Analyst Prompt Fixes Applied, Re-Measured

## Context

The 2026-09-13 evaluation (PM-verified golden set) surfaced three real
over-extraction/mislabeling patterns via manual audit and proposed
specific prompt edits — not applied at the time, per the standing
instruction to propose and wait. The PM approved applying all three.
This entry documents the edits, the results of re-running the eval
against them, a regression caught by that re-run, and the fix.

## Edits applied

`backend/src/agents/meeting-analyst/prompt.ts`'s system prompt
(`PROMPT_VERSION`: `meeting-analyst-v2` → `v3` → `v4`):

1. **Decisions**: added "do not also extract a task assignment as a
   decision if it's already captured as an action" to the category
   definition, targeting the action/decision duplication pattern.
2. **Dependencies**: tightened the definition to require an explicit
   or clearly-implied blocking relationship, explicitly excluding
   routine sequencing ("I'll review it once you send it") from
   counting as a dependency.
3. **Change signals**: added a worked-example paragraph after the
   existing risk-severity example, extending the FACT/INFERENCE
   guardrail to `potential_impact` — a forward cost/schedule/scope
   projection is inference even when bundled with a stated fact.

## First re-run: two real wins, one regression

Re-ran `npm run eval` (`v3`) against the live API. `dependencies` false
positives dropped 6→3, `decisions` false positives dropped 5→3 (one
transcript's duplicate decisions eliminated entirely) — proposals 1 and
3 measured as real improvements, not just plausible-sounding ones.

Proposal 2 **regressed**: `scope-change`'s change_signal — the golden
set's cleanest possible FACT (a directly-stated new requirement, no
projection involved) — was mislabeled `inference`. The added wording
("label the whole item inference — never fact" when a fact and
projection are mixed) read to the model as blanket caution on
change_signals generally, not the narrower "only when a projection is
actually present" case intended. Caught because the eval was re-run
after the edit rather than trusted on inspection of the prompt text
alone — exactly the value of having a repeatable harness.

## Fix and final re-run

Refined the change_signal wording (`v4`) to explicitly state that a
directly-stated change with no projection is still a fact, and narrowed
the inference case to only the projected-outcome portion of an item.
Re-ran again: `scope-change`'s change_signal is correctly `fact` again;
overall label accuracy returned to 100%, with the `dependencies`/
`decisions` improvements from the first re-run intact.

## Net result across all three runs (pre-fix → v3 → v4)

- `dependencies` false positives: 6 → 3 → 3 (held).
- `decisions` false positives: 5 → 3 → 3 (held).
- `change_signals` label accuracy: 100% → 50% (regression) → 100%
  (fixed).
- `risks` recall reads 67% in both `v3` and `v4` (one miss) — confirmed
  as a golden-set keyword-matching artifact: the same underlying claim
  was extracted both times, just re-categorized/re-worded by the model
  between runs in a way that no longer contains the golden set's single
  matching keyword ("productive"). Not a real regression; not adjusted
  in the golden set post-hoc, since that would undermine the
  fixed-in-advance design — flagged for a future golden-set revision
  instead.
- Guardrails held (26/26 real API calls passed schema validation) and
  assistant grounding stayed 5/5 across every run — neither is affected
  by Meeting Analyst prompt changes.

## Explicitly not done

No changes to any other agent's prompt/schema, the data model,
migrations, RLS, or approval logic. `npx tsc -b` (backend) is clean
after every edit.
