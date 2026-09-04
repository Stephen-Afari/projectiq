# 2026-09-10 — Brand System Finalized

## Context

The 2026-09-09 session applied the real ProjectIQ brand assets (Logo
component, Manrope, real favicons, navy headings, footer strip) on top
of the 2026-09-08 placeholder design system — but that work was never
committed, so it existed only as uncommitted changes on disk. The user
reported the running app still looked unbranded (default Tailwind
colors, system font, no logo) and re-issued the full brand brief. A
read-only audit at the start of this session confirmed:

- The uncommitted 2026-09-09 work was still present and correct on
  disk (`git status` showed the same modified/untracked files as before;
  nothing had been reverted).
- Only one clean backend/frontend dev-server pair was running (not the
  stale-process pile-up from earlier in this session) — so the most
  likely reason the brand wasn't visible in the browser was a stale
  cache (fonts/favicons/CSS are aggressively cached), not broken code.
- Auditing the *exact wording* of this session's brief against the
  existing code turned up several real, unfinished gaps anyway, closed
  in this pass.

## What was already correct (re-verified, not rebuilt)

`Logo.tsx`, its placement in `App.tsx`'s header/nav and above
`Login.tsx`'s sign-in card, the footer strip
("INTELLIGENCE · AUTOMATION · EXCELLENCE" / "© 2026 ProjectIQ"), Manrope
+ the real favicon/manifest links in `index.html`, `document.title` set
to "ProjectIQ", and `text-navy` on page headings across the app.

## What this pass closed

1. **Token rename**: `tailwind.config.js`'s `canvas` token renamed to
   `neutral` (same hex, `#F2F4F7`) to match this brief's exact naming.
   This intentionally overrides Tailwind's own built-in `neutral` grey
   ramp — confirmed via `grep` that no `neutral-*` ramp class was in use
   anywhere in the frontend, so nothing broke. `App.tsx`'s 2 `bg-canvas`
   usages updated to `bg-neutral`.
2. **Global base layer**: `frontend/src/index.css`'s `@layer base` now
   applies `bg-neutral text-navy font-sans antialiased` to `html`/`body`
   and `font-bold text-navy` to every heading tag, so the brand surface
   and text colors are inherited app-wide rather than reapplied
   per-screen. `App.tsx`'s explicit `bg-neutral` wrapper classes were
   left in place as well (harmless redundancy, guarantees coverage above
   `#root`). `Card.tsx` already satisfied "white cards, soft shadow,
   rounded corners" — no change needed.
3. **Confidence badge recolor — user-confirmed decision**: FACT/
   INFERENCE/RECOMMENDATION chips changed from green/amber/blue to
   navy/cyan/coral, per this brief. This explicitly overrides the
   2026-09-09 entry's "do not alter" instruction for that one tone
   map — the user was asked directly via a clarifying question and chose
   to recolor. `components/ui/Badge.tsx`'s `BadgeTone` union gained
   `'navy' | 'cyan' | 'coral'`; `CONFIDENCE_TONE` is now `{ fact: 'navy',
   inference: 'cyan', recommendation: 'coral' }`. No call-site changes
   were needed — `ConfidenceBadge`, `AskProjectIQ.tsx`'s citation-legend
   loop, and `MeetingResults.tsx`'s `CONFIDENCE_LEGEND` all read this one
   map already, so the new colors apply everywhere a confidence chip
   renders. `HEALTH_TONE` (RAG health: green/amber/red) and
   `APPROVAL_TONE`/`SEVERITY_TONE`/`INGESTION_TONE` are unchanged — the
   brief only asked for confidence chips to change, and explicitly asked
   for RAG health to stay a distinct green/amber/red set.
4. **Primary button / link pattern**: `Login.tsx`'s Sign in button,
   `NewMeeting.tsx`'s Save & Analyse button, and `MeetingResults.tsx`'s
   `EditForm` Save button changed from `bg-brand-600`/white text to the
   brief's literal `bg-cyan text-navy`, hovering to `bg-brand-600
   text-white` for a clear state change. The disabled state uses the
   explicit `disabled:bg-slate-300 disabled:text-slate-500
   disabled:cursor-not-allowed` pattern already proven in the 2026-09-09
   pass (an opacity-based disabled state had read as a rendering bug
   rather than an intentional inactive control). `App.tsx`'s nav links
   (New Meeting / Projects, both the full-width and collapsed-mobile
   variants) changed from `text-slate-600 hover:text-brand-600` to
   `text-cyan hover:text-brand-700`.
5. **`CLAUDE.md`** — the Design System subsection under Frontend
   Conventions rewritten to describe the actual shipped palette
   (navy/cyan/mint/coral/neutral + Manrope + the `Logo` component) in
   place of the 2026-09-08 placeholder description (indigo/Inter), and
   corrected to state that confidence-type colors are the one deliberate
   exception to "semantic palette untouched."

## Verification

- `npx tsc -b` — clean, zero errors.
- `npm run build` — production build succeeds (re-confirmed after this
  round's edits on top of the already-passing 2026-09-09 build).
- Confirmed via `git diff`/`grep` that `HEALTH_TONE`, `SEVERITY_TONE`,
  `APPROVAL_TONE`, and `INGESTION_TONE` in `Badge.tsx` are byte-for-byte
  unchanged — only `CONFIDENCE_TONE` and the `BadgeTone` union/style map
  were touched.
- No visual/browser screenshot was taken — this environment has no
  browser-automation tool, the same disclosed limitation as every prior
  frontend phase in this project. Description of the resulting render,
  based on the actual classes now in place:
  - **Login**: white header with the full-color `Logo` on the left;
    `bg-neutral` page body (inherited from the new base layer); centered
    card with the `Logo` above it, a bold Manrope "Sign in to ProjectIQ"
    heading in navy, and a `bg-cyan text-navy` Sign in button that turns
    a deliberate slate-grey (not a translucent cyan) only while the form
    is incomplete or submitting; the brand-cyan/navy footer strip at the
    page bottom.
  - **Dashboard**: same `bg-neutral` shell with white cards; project
    name and stat headings in bold navy Manrope; RAG health badges still
    green/amber/red, visually unchanged from before this pass; any
    FACT/INFERENCE/RECOMMENDATION chips on the page (e.g. in the Ask
    ProjectIQ panel) now render navy/cyan/coral instead of
    green/amber/blue.
- `git status`/`git diff --stat` confirmed the diff stayed scoped to
  `frontend/` plus this file and the `CLAUDE.md` edit — no
  `backend/`, `supabase/migrations/`, `n8n/`, RLS, webhook-auth, or
  approval-status-transition code was touched.

## Git hygiene note (not a code change)

All of this work — the 2026-09-08 placeholder pass, the 2026-09-09 real
brand wiring, and this session's finalization — remains uncommitted on
disk as of this entry. That's very likely *why* the user didn't see the
brand applied: nothing here was ever lost or reverted, it just hadn't
been committed (and the running dev servers, while serving the correct
uncommitted source, may have been viewed through a stale browser cache
from before these classes existed). Recommend committing this branch of
work as its own commit(s) once reviewed, rather than continuing to layer
uncommitted changes on uncommitted changes.
