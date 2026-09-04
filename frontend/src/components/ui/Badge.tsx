/**
 * Single source of truth for badge styling — previously redefined
 * independently in ProjectDashboard/MeetingResults/AskProjectIQ/
 * DocumentUpload/ProjectRecords (same shell, five slightly different
 * color-key maps). One shell, one set of semantic tone maps, imported
 * everywhere. The tone→color mapping is deliberately unchanged from
 * what each screen already used — this is a de-duplication, not a
 * re-theming of what green/amber/red/etc. mean.
 */

export type BadgeTone =
  | 'green'
  | 'amber'
  | 'orange'
  | 'red'
  | 'blue'
  | 'purple'
  | 'slate'
  | 'navy'
  | 'cyan'
  | 'coral';

const TONE_STYLES: Record<BadgeTone, string> = {
  green: 'bg-green-100 text-green-800 border-green-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  slate: 'bg-slate-100 text-slate-600 border-slate-300',
  // Brand-token tones (navy/cyan/coral) — used for FACT/INFERENCE/
  // RECOMMENDATION confidence chips only, per the ProjectIQ brand system.
  // `cyan` reuses the `brand` ramp's 100/700/300 shades for solid text
  // contrast rather than resting text on the single flat `cyan` hex.
  navy: 'bg-navy/10 text-navy border-navy/30',
  cyan: 'bg-brand-100 text-brand-700 border-brand-300',
  coral: 'bg-coral/10 text-coral border-coral/30',
};

export function Badge({ text, tone, className = '' }: { text: string; tone: BadgeTone; className?: string }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONE_STYLES[tone]} ${className}`}
    >
      {text}
    </span>
  );
}

// --- Domain tone maps (colocated — these are the "five slightly different
// color-key maps" the audit found, now defined exactly once each) ---

// FACT/INFERENCE/RECOMMENDATION → navy/cyan/coral per the ProjectIQ brand
// system (2026-09-10). RAG health (HEALTH_TONE) and approval status
// (APPROVAL_TONE) keep the original green/amber/red/slate semantics —
// this recolor is scoped to confidence-type chips only.
export const CONFIDENCE_TONE: Record<'fact' | 'inference' | 'recommendation', BadgeTone> = {
  fact: 'navy',
  inference: 'cyan',
  recommendation: 'coral',
};

export const HEALTH_TONE: Record<'green' | 'amber' | 'red', BadgeTone> = {
  green: 'green',
  amber: 'amber',
  red: 'red',
};

export const HEALTH_LABEL: Record<'green' | 'amber' | 'red', string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
};

export const SEVERITY_TONE: Record<'low' | 'medium' | 'high' | 'critical', BadgeTone> = {
  low: 'green',
  medium: 'amber',
  high: 'orange',
  critical: 'red',
};

export const APPROVAL_TONE: Record<'pending' | 'approved' | 'rejected', BadgeTone> = {
  pending: 'slate',
  approved: 'green',
  rejected: 'red',
};

export const INGESTION_TONE: Record<'pending' | 'processing' | 'completed' | 'failed', BadgeTone> = {
  pending: 'slate',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
};

// --- Convenience wrappers for the most common call sites ---

export function ConfidenceBadge({ type }: { type: 'fact' | 'inference' | 'recommendation' | null }) {
  if (!type) return null;
  return <Badge text={type} tone={CONFIDENCE_TONE[type]} />;
}

export function HealthBadge({ level }: { level: 'green' | 'amber' | 'red' }) {
  return <Badge text={HEALTH_LABEL[level]} tone={HEALTH_TONE[level]} />;
}

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null;
  const tone = (SEVERITY_TONE as Record<string, BadgeTone>)[severity] ?? 'slate';
  return <Badge text={severity} tone={tone} />;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    (APPROVAL_TONE as Record<string, BadgeTone>)[status] ??
    (INGESTION_TONE as Record<string, BadgeTone>)[status] ??
    'slate';
  return <Badge text={status} tone={tone} />;
}
