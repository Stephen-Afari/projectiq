import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  getProjectDashboard,
  type Action,
  type ChangeSignal,
  type ConfidenceType,
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

const HEALTH_STYLES: Record<HealthLevel, string> = {
  green: 'bg-green-100 text-green-800 border-green-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  red: 'bg-red-100 text-red-800 border-red-300',
};

const HEALTH_LABELS: Record<HealthLevel, string> = { green: 'Green', amber: 'Amber', red: 'Red' };

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

const CONFIDENCE_STYLES: Record<ConfidenceType, string> = {
  fact: 'bg-green-100 text-green-800 border-green-300',
  inference: 'bg-amber-100 text-amber-800 border-amber-300',
  recommendation: 'bg-blue-100 text-blue-800 border-blue-300',
};

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

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${className}`}
    >
      {text}
    </span>
  );
}

function HealthBadge({ level }: { level: HealthLevel }) {
  return <Badge text={HEALTH_LABELS[level]} className={HEALTH_STYLES[level]} />;
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null;
  return <Badge text={severity} className={SEVERITY_STYLES[severity] ?? ''} />;
}

function ConfidenceBadge({ type }: { type: ConfidenceType | null }) {
  if (!type) return null;
  return <Badge text={type} className={CONFIDENCE_STYLES[type]} />;
}

function Card({
  title,
  linkTo,
  children,
}: {
  title: string;
  linkTo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {linkTo ? (
          <Link to={linkTo} className="hover:text-slate-700 hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

function SubHealthCard({ label, level }: { label: string; level: HealthLevel }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
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
              {r.previous_severity && (
                <Badge text="worsened" className="bg-red-100 text-red-800 border-red-300" />
              )}
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
            className="flex items-start justify-between gap-3 py-2.5 hover:bg-slate-50"
          >
            <div className="flex items-start gap-2">
              <Badge
                text={INTELLIGENCE_TYPE_LABELS[item.type]}
                className="bg-slate-100 text-slate-600 border-slate-300"
              />
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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
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
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
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

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={load}
            className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!data || !id) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{data.project.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.project.status} · {data.project.start_date ?? '?'} → {data.project.target_date ?? '?'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall Health</p>
          <div className="mt-1">
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

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={`Overdue Actions (${data.overdue_actions.length})`}
          linkTo={`/projects/${id}/actions?view=overdue`}
        >
          <OverdueActionsList actions={data.overdue_actions} />
        </Card>
        <Card title={`Top Risks (${data.top_risks.length})`} linkTo={`/projects/${id}/risks?view=top`}>
          <TopRisksList risks={data.top_risks} />
        </Card>
        <Card
          title={`Decisions Needing Attention (${data.decisions_needing_attention.length})`}
          linkTo={`/projects/${id}/decisions?view=pending`}
        >
          <DecisionsList decisions={data.decisions_needing_attention} />
        </Card>
        <Card title="Issues & Dependencies">
          <IssuesAndDependencies
            projectId={id}
            issues={data.open_issues}
            dependencies={data.open_dependencies}
          />
        </Card>
        <Card
          title={`Change Signals (${data.change_signals.length})`}
          linkTo={`/projects/${id}/change-signals?view=open`}
        >
          <ChangeSignalsList signals={data.change_signals} />
        </Card>
      </div>

      <div className="mt-8">
        <Card title="Recent Project Intelligence">
          <IntelligenceFeed projectId={id} items={data.recent_intelligence} />
        </Card>
      </div>
    </div>
  );
}
