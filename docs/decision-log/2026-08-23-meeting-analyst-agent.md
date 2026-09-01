# 2026-08-23 — Meeting Analyst Agent (`POST /api/ai/analyse-meeting`)

## Decision
Implemented the first of the four AI agents: the Meeting Analyst. Given a
`meeting_id`, it loads the stored transcript, calls Claude via a
provider-agnostic LLM client, extracts six categories of structured project
intelligence with a FACT/INFERENCE/RECOMMENDATION tag on every item, and
persists everything with `approval_status = 'pending'`, linked to the
meeting and project. Backend only, as scoped — no UI wiring.

## Structured output: tool-use + one shared zod schema
Rather than asking Claude for free-text JSON and hoping it's well-formed,
the agent forces a tool call (`tool_choice`) whose `input_schema` is a JSON
Schema generated from a single zod schema
(`backend/src/agents/meeting-analyst/schema.ts`, via `zod-to-json-schema`).
That same zod schema then validates the response with `.safeParse()`. One
schema, two uses — the "what we told the model to produce" and "what we
accept" literally cannot diverge, which is exactly the kind of drift that
would otherwise silently break the FACT/INFERENCE/RECOMMENDATION guardrail
or let malformed enum values slip through.

## The FACT/INFERENCE/RECOMMENDATION guardrail
Every extracted item (action, risk, issue, decision, dependency, change
signal) carries a required `confidence_type` field —
`fact | inference | recommendation` — enforced two ways:
1. **Structurally**: it's a required enum field in the JSON Schema/zod
   schema; the model cannot omit it, and Claude's tool-use rejects
   fabricated enum values outside the three options.
2. **In the system prompt**: explicit definitions of all three (fact =
   directly/explicitly stated; inference = the agent's own reasonable
   judgement, not a verbatim claim; recommendation = a suggested step
   nobody in the transcript proposed), with an explicit instruction that
   mislabeling an inference as a fact is treated as a serious error, and to
   default to "inference" whenever uncertain rather than over-claiming
   "fact".

Every item also carries `source_text` — a real transcript excerpt for
traceability — enforced by the same required-field mechanism, with an
explicit prompt instruction never to fabricate a quote.

## Retry/repair, not blind retry
If the model's response fails zod validation, `run.ts` retries (up to 3
attempts total) with a **repair prompt**: the previous (invalid) output
plus the exact zod validation errors, asking Claude to fix specifically
those problems. This is meaningfully different from resending the same
prompt — it gives the model the information it needs to actually converge.

API-level failures (auth, billing, rate limits, network) are **not**
retried — retrying doesn't fix a billing error — and are surfaced
immediately. This was found via a real failure during verification (see
"What we hit" below) and fixed: the first version let API errors bubble
straight out of `runMeetingAnalyst`, skipping the `agent_runs` log entirely
and returning a bare, unlogged `500`. Fixed so `run.ts` catches API errors
per-attempt and returns a normal (failed) result object instead of
throwing, so the caller always gets to log the attempt and return a clean
`502`.

## Model abstraction
`backend/src/services/llm/` defines a provider-agnostic `LlmClient`
interface (`generateStructured()`); `backend/src/services/llm/index.ts` is
the single place that picks an implementation, based on
`config.llmProvider` (`LLM_PROVIDER` env var, default `anthropic`).
`config.anthropicModel` (`ANTHROPIC_MODEL` env var, default
`claude-sonnet-5`) is the single place the model id lives — no agent code
references a model string directly. The `openrouter` branch throws "not
implemented" rather than being half-built, per the no-speculative-
abstraction convention — implement it when a second real case exists.

## Persistence
Orchestration lives in the route handler (`backend/src/routes/ai.ts`), not
the agent itself — the agent (`run.ts`) is pure extraction with no DB
access, consistent with CLAUDE.md's "agents don't call each other /
orchestration happens in routes." The route: loads the meeting and project,
downloads the transcript from Supabase Storage, runs the agent, logs the
attempt to `agent_runs` (win or lose), and — only on success — creates rows
in `actions`/`risks`/`issues`/`decisions`/`dependencies`/`change_signals`
(each `approval_status` defaults to `pending` at the DB layer, never set
explicitly by the agent) plus updates `meetings.summary`.

## New: `agent_runs` table (migration `20260824090000_agent_runs.sql`)
CLAUDE.md's AI Rules already promised this (written in Phase 1) but no
table existed yet. Added now, as the first agent that needs it: `id`,
`agent_name`, `project_id`, `meeting_id`, `model`, `prompt_version`,
`input_refs`, `raw_output`, `validation_passed`, `error_message`,
`created_at`. RLS scoped the same way as other project-linked tables, with
`project_id is null` also allowed (defensive — not currently exercised,
since every run today has a project).

## Bug found and fixed: `apply-migrations.mjs` had no idempotency tracking
Adding this migration exposed that the migration runner re-executed every
`.sql` file on every run (no ledger of what had already applied) — it
worked the first time only because nothing had run twice yet. Fixed by
adding a `schema_migrations` tracking table; the script now skips
already-applied files. Backfilled the 5 pre-existing migrations into the
new tracking table (one-time, via a script written and then deleted) so
they weren't mistakenly re-run.

## `change_signals.change_type` now enum-constrained at the application layer
Phase 2 left `change_signals.change_type` as free `text` because no
candidate values existed yet. This task specifies them explicitly
(scope/schedule/cost/resource/requirement), so the agent's zod schema now
enforces that enum — the DB column itself stays `text` (no migration
needed; Postgres doesn't need to know the constraint since the agent is the
only writer today).

## What we hit: Anthropic account has insufficient credit
Live verification against the sample transcript
(`docs/samples/apex-erp-kickoff-followup-transcript.md`, uploaded as a
meeting in the previous phase) currently fails with a `400` from
Anthropic: "Your credit balance is too low to access the Anthropic API."
This is an account/billing issue, not a code defect — confirmed by the
fact that the failure is now correctly caught, logged to `agent_runs`
(`validation_passed: false`, full error message recorded), and returned as
a clean `502`, rather than crashing. Full end-to-end output (the actual
extracted JSON) is pending the user adding credit to the Anthropic account
tied to `ANTHROPIC_API_KEY`.

## What It Affects
- `supabase/migrations/20260824090000_agent_runs.sql` (new table).
- `scripts/apply-migrations.mjs` (idempotency fix), `scripts/verify-schema.mjs`
  (added `agent_runs` to the expected table list).
- `backend/src/db/types.ts` (`AgentRun`), `backend/src/db/tables/agentRuns.ts`
  (new), `backend/src/db/index.ts` (barrel export).
- `backend/src/services/llm/{types,anthropicClient,index}.ts` (new).
- `backend/src/agents/meeting-analyst/{schema,prompt,run,index}.ts` (new).
- `backend/src/services/transcriptStorage.ts` (`downloadTranscript` added).
- `backend/src/db/tables/meetings.ts` (`updateMeetingSummary` added).
- `backend/src/schemas/ai.ts` (new), `backend/src/routes/ai.ts` (real
  implementation replacing the `501` placeholder for `/analyse-meeting`;
  `/project-query` unchanged, still `501`).
- `backend/src/config.ts` (`llmProvider`, `anthropicModel`).
- `backend/package.json` (`@anthropic-ai/sdk`, `zod-to-json-schema`).
- `CLAUDE.md` — AI Rules extended with model abstraction, structured
  output, and retry/repair conventions.
