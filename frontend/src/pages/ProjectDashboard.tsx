import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  getProjectDashboard,
  type Action,
  type ChangeSignal,
  type Decision,
  type Dependency,
  type HealthLevel,
  type Issue,
  type IntelligenceFeedItem,
  type ProjectDashboard as ProjectDashboardData,
  type RecordType,
  type Risk,
} from '../lib/api';
import { SkeletonBlock, SkeletonCard, SkeletonStat } from '../components/Skeleton';
import AskProjectIQ from '../components/AskProjectIQ';
import DocumentUpload from '../components/DocumentUpload';
import { Card as CardShell, CardTitle } from '../components/ui/Card';
import { ErrorBanner } from '../components/ui/StatusBanner';
import { Badge, ConfidenceBadge, HealthBadge, SeverityBadge } from '../components/ui/Badge';

const INTELLIGENCE_TYPE_LABELS: Record<IntelligenceFeedItem['type'], string> = {
  action: 'Action',
  risk: 'Risk',
  issue: 'Issue',
  decision: 'Decision',
  dependency: 'Dependency',
  change_signal: 'Change Signal',
};

// Recent-intelligence items use the singular, underscore entity name; the
// drill-down route uses the plural, kebab-case URL segment.
const FEED_TYPE_TO_RECORD_TYPE: Record<IntelligenceFeedItem['type'], RecordType> = {
  action: 'actions',
  risk: 'risks',
  issue: 'issues',
  decision: 'decisions',
  dependency: 'dependencies',
  change_signal: 'change-signals',
};

const HEALTH_BORDER: Record<HealthLevel, string> = {
  green: 'border-l-green-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
};

// Small hand-authored inline SVGs — no icon library added for a handful of glyphs.
const ICONS = {
  overdue: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  risk: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10 3l7.5 13H2.5L10 3z" strokeLinejoin="round" />
      <path d="M10 8.5v3" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  decision: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  issues: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 8h6M7 12h4" strokeLinecap="round" />
    </svg>
  ),
  change: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6h9l-2.5-2.5M16 14H7l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  feed: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 5h14M3 10h14M3 15h9" strokeLinecap="round" />
    </svg>
  ),
};

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

function SubHealthCard({ label, level }: { label: string; level: HealthLevel }) {
  return (
    <div className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${HEALTH_BORDER[level]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2">
        <HealthBadge level={level} />
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold text-navy">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function OverdueActionsList({ actions }: { actions: Action[] }) {
  if (!actions.length) return <EmptyState text="No overdue actions." />;
  return (
    <ul className="space-y-2">
      {actions.map((a) => (
        <li key={a.id} className="text-sm">
          <p className="text-slate-800">{a.description}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Owner: {a.owner ?? 'unassigned'} · Due {a.due_date}
          </p>
        </li>
      ))}
    </ul>
  );
}

function TopRisksList({ risks }: { risks: Risk[] }) {
  if (!risks.length) return <EmptyState text="No high/critical risks." />;
  return (
    <ul className="space-y-3">
      {risks.map((r) => (
        <li key={r.id} className="text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-800">{r.description}</p>
            <div className="flex shrink-0 items-center gap-1">
              <SeverityBadge severity={r.severity} />
              {r.previous_severity && <Badge text="worsened" tone="red" />}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Owner: {r.owner ?? 'unassigned'}</p>
        </li>
      ))}
    </ul>
  );
}

function DecisionsList({ decisions }: { decisions: Decision[] }) {
  if (!decisions.length) return <EmptyState text="No decisions awaiting approval." />;
  return (
    <ul className="space-y-2">
      {decisions.map((d) => (
        <li key={d.id} className="text-sm text-slate-800">
          {d.decision}
        </li>
      ))}
    </ul>
  );
}

function IssuesAndDependencies({
  projectId,
  issues,
  dependencies,
}: {
  projectId: string;
  issues: Issue[];
  dependencies: Dependency[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <Link
          to={`/projects/${projectId}/issues?view=open`}
          className="text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600 hover:underline"
        >
          Open Issues ({issues.length})
        </Link>
        {issues.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">None.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {issues.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-2 text-sm text-slate-800">
                <span>{i.description}</span>
                <SeverityBadge severity={i.severity} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <Link
          to={`/projects/${projectId}/dependencies?view=open`}
          className="text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600 hover:underline"
        >
          Open Dependencies ({dependencies.length})
        </Link>
        {dependencies.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">None.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {dependencies.map((d) => (
              <li key={d.id} className="text-sm text-slate-800">
                {d.description}
                {(d.upstream_activity || d.downstream_activity) && (
                  <span className="text-slate-500">
                    {' '}
                    ({d.upstream_activity ?? '?'} → {d.downstream_activity ?? '?'})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChangeSignalsList({ signals }: { signals: ChangeSignal[] }) {
  if (!signals.length) return <EmptyState text="No open change signals." />;
  return (
    <ul className="space-y-2">
      {signals.map((c) => (
        <li key={c.id} className="text-sm text-slate-800">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            [{c.change_type ?? 'unspecified'}]
          </span>{' '}
          {c.description}
        </li>
      ))}
    </ul>
  );
}

function IntelligenceFeed({ projectId, items }: { projectId: string; items: IntelligenceFeedItem[] }) {
  if (!items.length) return <EmptyState text="No recent activity." />;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <Link
            to={`/projects/${projectId}/${FEED_TYPE_TO_RECORD_TYPE[item.type]}`}
            className="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-start gap-2">
              <Badge text={INTELLIGENCE_TYPE_LABELS[item.type]} tone="slate" />
              <p className="text-sm text-slate-800">{item.text}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConfidenceBadge type={item.confidence_type} />
              <span className="text-xs text-slate-400">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-56" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
        <SkeletonBlock className="h-6 w-20" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="mt-8">
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProjectDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getProjectDashboard(id)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = data ? `ProjectIQ · ${data.project.name}` : 'ProjectIQ · Dashboard';
  }, [data]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }
  if (!data || !id) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Hero — the "executive health view at a glance" the Overall Health
          number leads with: health-tinted border + larger badge, project
          identity secondary. */}
      <div
        className={`rounded-lg border border-l-4 bg-white p-5 shadow-sm ${HEALTH_BORDER[data.project.health]} flex flex-col justify-between gap-4 sm:flex-row sm:items-center`}
      >
        <div>
          <h2 className="text-xl font-semibold text-navy sm:text-2xl">{data.project.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.project.status} · {data.project.start_date ?? '?'} → {data.project.target_date ?? '?'}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall Health</p>
          <div className="mt-1.5">
            <HealthBadge level={data.project.health} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SubHealthCard label="Schedule" level={data.sub_health.schedule} />
        <SubHealthCard label="Budget" level={data.sub_health.budget} />
        <SubHealthCard label="Scope" level={data.sub_health.scope} />
        <SubHealthCard label="Resources" level={data.sub_health.resources} />
      </div>

      <div className="mt-8">
        <DocumentUpload key={id} projectId={id} />
      </div>

      <div className="mt-8">
        <AskProjectIQ key={id} projectId={id} />
      </div>

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          New Since Last Meeting
          {data.new_since_last_meeting.since && (
            <span className="ml-2 font-normal normal-case text-slate-400">
              (since {data.new_since_last_meeting.since})
            </span>
          )}
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCell label="Actions" value={data.new_since_last_meeting.actions} />
          <StatCell label="Risks" value={data.new_since_last_meeting.risks} />
          <StatCell label="Decisions" value={data.new_since_last_meeting.decisions} />
          <StatCell label="Issues" value={data.new_since_last_meeting.issues} />
        </div>
      </section>

      {/* 3-column at xl so 5 cards land 3-then-2 — no card ever sits stranded
          alone in its own row at any breakpoint. */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardShell>
          <CardTitle icon={ICONS.overdue} linkTo={`/projects/${id}/actions?view=overdue`}>
            Overdue Actions ({data.overdue_actions.length})
          </CardTitle>
          <div className="mt-3">
            <OverdueActionsList actions={data.overdue_actions} />
          </div>
        </CardShell>
        <CardShell>
          <CardTitle icon={ICONS.risk} linkTo={`/projects/${id}/risks?view=top`}>
            Top Risks ({data.top_risks.length})
          </CardTitle>
          <div className="mt-3">
            <TopRisksList risks={data.top_risks} />
          </div>
        </CardShell>
        <CardShell>
          <CardTitle icon={ICONS.decision} linkTo={`/projects/${id}/decisions?view=pending`}>
            Decisions Needing Attention ({data.decisions_needing_attention.length})
          </CardTitle>
          <div className="mt-3">
            <DecisionsList decisions={data.decisions_needing_attention} />
          </div>
        </CardShell>
        <CardShell>
          <CardTitle icon={ICONS.issues}>Issues &amp; Dependencies</CardTitle>
          <div className="mt-3">
            <IssuesAndDependencies
              projectId={id}
              issues={data.open_issues}
              dependencies={data.open_dependencies}
            />
          </div>
        </CardShell>
        <CardShell>
          <CardTitle icon={ICONS.change} linkTo={`/projects/${id}/change-signals?view=open`}>
            Change Signals ({data.change_signals.length})
          </CardTitle>
          <div className="mt-3">
            <ChangeSignalsList signals={data.change_signals} />
          </div>
        </CardShell>
      </div>

      <div className="mt-8">
        <CardShell>
          <CardTitle icon={ICONS.feed}>Recent Project Intelligence</CardTitle>
          <div className="mt-3">
            <IntelligenceFeed projectId={id} items={data.recent_intelligence} />
          </div>
        </CardShell>
      </div>
    </div>
  );
}
