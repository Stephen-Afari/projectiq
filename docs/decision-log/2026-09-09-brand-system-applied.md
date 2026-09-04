# 2026-09-09 — ProjectIQ Brand System Applied

## Context

The 2026-09-08 design-polish pass built the first design-system layer
(brand token, Inter font, `components/ui/{Badge,Card,StatusBanner}`) but
used a placeholder identity — a generic indigo, a "P" monogram, and
Manrope/cyan hadn't yet been chosen. Real ProjectIQ brand assets (logo
lockups, icon mark, favicons, `site.webmanifest`) and the approved
palette (`ProjectIQ_Brand_Assets_Manifest.json`) became available this
session. This entry covers wiring the approved brand into the existing
design system — a re-skin of what was already built, not a new system,
and not a change to any screen's structure, data, or behavior.

Before this pass began, `tailwind.config.js` had already been retheme
d (brand token → the Bright Cyan ramp, `#00B6D1`; additive `navy`/`cyan`/
`mint`/`coral`/`canvas` tokens) and `index.html` already pointed at
Manrope and the real favicon set — both done directly by the user ahead
of this session. This session's work was applying that palette to the
remaining components.

## What changed

- **New `frontend/src/components/ui/Logo.tsx`**: a single `<Logo>`
  component wrapping the three approved raster assets
  (`projectiq-logo.png`, `projectiq-logo-reversed.png`,
  `projectiq-mark.png`, imported from `src/assets/`). Height-constrained
  (`height` prop, default `28`px) with `width: auto` so the lockup is
  never stretched; `onDark` swaps to the reversed white-on-navy lockup
  for dark surfaces; `mark` renders just the icon glyph for tight spaces.
- **`App.tsx`**: the old inline "P"-monogram `Wordmark` function is gone,
  replaced by `<Logo />` in the header (full lockup from `sm` up,
  `<Logo mark />` below `sm` where a full wordmark would crowd the
  header) and on the pre-auth shell above `<Login />`. Added a footer
  strip (`INTELLIGENCE · AUTOMATION · EXCELLENCE` in brand-cyan
  letter-spaced caps, `© 2026 ProjectIQ` below it in muted slate) to both
  the authenticated and unauthenticated app shells. Both shells' page
  background moved from `bg-slate-50` to `bg-canvas` (`#F2F4F7`, the
  approved neutral) — cards stay `bg-white` per the brief, only the
  outer shell background changed.
- **`Login.tsx`**: `<Logo height={36} />` above the sign-in card; heading
  moved to `text-navy`; the Sign in button's disabled state changed from
  `disabled:opacity-40` (which read as a washed-out, ambiguous grey — the
  reported issue) to an explicit `disabled:bg-slate-300
  disabled:text-slate-500 disabled:cursor-not-allowed` — a deliberate
  "this control is inactive" state rather than a partially-transparent
  brand color that looked like a bug.
- **Page headings / primary text → `text-navy`**: every `text-slate-900`
  instance across `MeetingResults.tsx`, `NewMeeting.tsx`,
  `ProjectDashboard.tsx`, `ProjectList.tsx`, `ProjectRecords.tsx` (page
  `<h2>` titles, item-card title text, dashboard stat values) now reads
  `text-navy`. This was a mechanical find-and-replace scoped to that one
  class — no structural change to any of these files.
- **`components/ui/Badge.tsx` tone maps are byte-for-byte unchanged** —
  confirmed via `git diff` showing zero delta on that file. The semantic
  slate/green/amber/red/blue/purple/orange colors that encode approval-
  status, confidence-type, health, and severity meaning were explicitly
  out of scope and were not touched.

## What was explicitly not touched

No changes to `backend/`, `supabase/migrations/`, any API contract, RLS
policy, approval-status transition logic, or the Badge tone maps. This
is a `frontend/` presentation-layer pass only, per the instruction to
stop and ask before going outside presentation — nothing required going
outside it.

## Verification

- `npx tsc -b` — clean, zero errors.
- `npm run build` — production build succeeds:
  `dist/assets/index-*.css` (22.42 kB, 4.63 kB gzip), `index-*.js`
  (440.51 kB, 124.22 kB gzip), plus the three logo PNGs copied into
  `dist/assets/` unmodified. Build completed in ~6s with no warnings.
- Both already-running dev servers (frontend on `:5173`, backend on
  `:3001`) picked up every change live via Vite HMR; `curl` against both
  confirmed `200` after the change set landed.
- **No visual/browser screenshot was taken** — this environment has no
  browser-automation tool, the same disclosed limitation noted in the
  2026-09-08 decision-log entry and every prior frontend phase in this
  project. What follows is a description of the resulting markup/styles,
  not a captured image:
  - **Login**: white header with the full-color logo lockup on the left;
    `bg-canvas` page body; centered sign-in card with a navy "Sign in to
    ProjectIQ" heading, the full-color logo above the card, and a solid
    cyan (`bg-brand-600`) button that goes a visibly muted slate-grey
    (not a translucent cyan) only while the form is incomplete or
    submitting; a cyan/navy-on-white footer strip at the very bottom.
  - **Dashboard**: same `bg-canvas`/white-card shell; the project name
    heading and dashboard stat numbers render in navy; the health-status
    badges (green/amber/red) are visually unchanged, sitting against the
    new canvas/navy surroundings rather than the old slate palette.

## Follow-ups noted, not actioned

- `frontend/_brand_backup_delete_me/` (containing `index.html.bak` and
  `tailwind.config.js.bak`) exists in the working tree from before this
  session — left alone, since deleting files outside this task's
  explicit scope wasn't requested.
- `projectiq-logo.png` is ~314 kB uncompressed in the production bundle
  (vs. ~77 kB for the reversed lockup and ~38 kB for the mark) — worth a
  re-export/compression pass if bundle size becomes a concern, but no
  action taken here since it wasn't part of the brief.
