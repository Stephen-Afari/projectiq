import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ApiError,
  getMeetingResults,
  patchApproval,
  patchEdit,
  type ConfidenceType,
  type ContextFlags,
  type ImpactAssessment,
  type MeetingResults as MeetingResultsData,
  type ResourceKey,
} from '../lib/api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { Card, CardTitle } from '../components/ui/Card';
import { ErrorBanner } from '../components/ui/StatusBanner';
import { Badge, ConfidenceBadge, CONFIDENCE_TONE, StatusBadge } from '../components/ui/Badge';

type EntityRecord = Record<string, unknown> & {
  id: string;
  approval_status: string;
  confidence_type: ConfidenceType | null;
  source_excerpt: string | null;
  context_flags?: ContextFlags | null;
  impact_assessment?: ImpactAssessment | null;
};

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select';
  options?: readonly string[];
}

// One row per Section below — used to compute the summary bar and quick-nav
// without re-deriving counts from six separately-typed props.
const SECTION_META = [
  { key: 'actions', id: 'actions', title: 'Actions' },
  { key: 'risks', id: 'risks', title: 'Risks' },
  { key: 'issues', id: 'issues', title: 'Issues' },
  { key: 'decisions', id: 'decisions', title: 'Decisions' },
  { key: 'dependencies', id: 'dependencies', title: 'Dependencies' },
  { key: 'change_signals', id: 'change-signals', title: 'Change Signals' },
] as const satisfies ReadonlyArray<{ key: keyof MeetingResultsData; id: string; title: string }>;

const CONFIDENCE_LEGEND: Array<{ type: ConfidenceType; description: string }> = [
  { type: 'fact', description: 'directly stated in the transcript' },
  { type: 'inference', description: "the agent's derived judgement" },
  { type: 'recommendation', description: 'a suggested action, not auto-applied' },
];

function ImpactCallout({ impact }: { impact: ImpactAssessment }) {
  const dims: Array<[string, string | null]> = [
    ['Schedule', impact.schedule_impact],
    ['Cost', impact.cost_impact],
    ['Scope', impact.scope_impact],
    ['Resource', impact.resource_impact],
    ['Dependency', impact.dependency_impact],
  ];
  const populated = dims.filter(([, v]) => v);

  if (!impact.applicable) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="font-medium uppercase tracking-wide text-slate-400">Impact Analyst (inference):</span>{' '}
        no material impact identified{impact.reasoning ? ` — ${impact.reasoning}` : ''}
      </div>
    );
  }

  return (
    <div className="rounded border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
      <div className="mb-1 font-medium uppercase tracking-wide text-purple-500">
        Impact Analyst (inference)
      </div>
      <ul className="space-y-0.5">
        {populated.map(([label, value]) => (
          <li key={label}>
            <span className="font-medium">{label}:</span> {value}
          </li>
        ))}
      </ul>
      {impact.reasoning && <p className="mt-1 italic text-purple-700">{impact.reasoning}</p>}
    </div>
  );
}

function DuplicateBanner({ flags }: { flags: ContextFlags }) {
  if (!flags.is_likely_duplicate) return null;
  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-semibold uppercase tracking-wide">Possible duplicate</span>
      {flags.duplicate_reasoning && <p className="mt-0.5">{flags.duplicate_reasoning}</p>}
    </div>
  );
}

function RelatedItems({ flags }: { flags: ContextFlags }) {
  if (!flags.related_items.length) return null;
  return (
    <div className="text-xs text-slate-500">
      <span className="font-medium text-slate-600">Related:</span>{' '}
      {flags.related_items.map((r, i) => (
        <span key={i}>
          {i > 0 && '; '}
          {r.relationship} <code className="text-slate-400">{r.ref}</code> — {r.reasoning}
        </span>
      ))}
    </div>
  );
}

function EditForm({
  item,
  fields,
  onCancel,
  onSave,
}: {
  item: EntityRecord;
  fields: FieldConfig[];
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, (item[f.key] as string) ?? ''])),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      patch[f.key] = values[f.key]?.trim() ? values[f.key] : null;
    }
    onSave(patch);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded border border-slate-300 bg-white p-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-[11px] font-medium text-slate-500">{f.label}</label>
          {f.type === 'textarea' ? (
            <textarea
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              rows={2}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          ) : f.type === 'select' ? (
            <select
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 text-xs transition-colors hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemCard({
  item,
  resource,
  titleField,
  fields,
  onUpdated,
}: {
  item: EntityRecord;
  resource: ResourceKey;
  titleField: string;
  fields: FieldConfig[];
  onUpdated: (updated: EntityRecord) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDuplicate = item.context_flags?.is_likely_duplicate ?? false;
  const isPending = item.approval_status === 'pending';

  async function approve(status: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      // approved_by is derived server-side from the logged-in session —
      // no reviewer picker needed, you approve as yourself.
      const updated = await patchApproval<EntityRecord>(resource, item.id, status);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await patchEdit<EntityRecord>(resource, item.id, patch);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save edit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-shadow ${
        isDuplicate ? 'border-l-4 border-l-amber-400 border-slate-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{String(item[titleField] ?? '')}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <ConfidenceBadge type={item.confidence_type} />
          <StatusBadge status={item.approval_status} />
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
        {fields.map((f) => {
          const value = item[f.key];
          if (!value) return null;
          return (
            <div key={f.key}>
              <dt className="inline font-medium text-slate-600">{f.label}: </dt>
              <dd className="inline">{String(value)}</dd>
            </div>
          );
        })}
      </dl>

      {item.source_excerpt && (
        <blockquote className="mt-2 border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">
          “{item.source_excerpt}”
        </blockquote>
      )}

      {(item.context_flags?.is_likely_duplicate ||
        item.context_flags?.related_items.length ||
        item.impact_assessment) && (
        <div className="mt-2 space-y-2">
          {item.context_flags && <DuplicateBanner flags={item.context_flags} />}
          {item.context_flags && <RelatedItems flags={item.context_flags} />}
          {item.impact_assessment && <ImpactCallout impact={item.impact_assessment} />}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {editing ? (
        <EditForm
          item={item}
          fields={[...fields, { key: 'confidence_type', label: 'Confidence', type: 'select', options: ['fact', 'inference', 'recommendation'] }]}
          onCancel={() => setEditing(false)}
          onSave={saveEdit}
        />
      ) : (
        isPending && (
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() => approve('approved')}
              className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => approve('rejected')}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() => setEditing(true)}
              className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Edit
            </button>
          </div>
        )
      )}
    </div>
  );
}

function Section({
  id,
  title,
  items,
  resource,
  titleField,
  fields,
  onUpdated,
}: {
  id: string;
  title: string;
  items: EntityRecord[];
  resource: ResourceKey;
  titleField: string;
  fields: FieldConfig[];
  onUpdated: (updated: EntityRecord) => void;
}) {
  const pending = items.filter((i) => i.approval_status === 'pending');
  const reviewed = items.filter((i) => i.approval_status !== 'pending');

  return (
    <section id={id} className="mt-8 scroll-mt-24">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="font-normal text-slate-400">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">None extracted.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mt-3 space-y-3">
              {pending.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  resource={resource}
                  titleField={titleField}
                  fields={fields}
                  onUpdated={onUpdated}
                />
              ))}
            </div>
          )}
          {reviewed.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-400">
                Reviewed ({reviewed.length})
              </summary>
              <div className="mt-3 space-y-3 opacity-70">
                {reviewed.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    resource={resource}
                    titleField={titleField}
                    fields={fields}
                    onUpdated={onUpdated}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export default function MeetingResults() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [data, setData] = useState<MeetingResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);
    getMeetingResults(meetingId)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load meeting results'))
      .finally(() => setLoading(false));
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = data ? `ProjectIQ · ${data.meeting.title}` : 'ProjectIQ · Meeting Results';
  }, [data]);

  function updateCategory<K extends keyof MeetingResultsData>(key: K, updated: EntityRecord) {
    setData((prev) => {
      if (!prev) return prev;
      const list = prev[key] as unknown as EntityRecord[];
      return {
        ...prev,
        [key]: list.map((item) => (item.id === updated.id ? updated : item)),
      };
    });
  }

  const sectionCounts = useMemo(() => {
    if (!data) return null;
    return SECTION_META.map((s) => {
      const items = data[s.key] as unknown as EntityRecord[];
      return { ...s, total: items.length, pending: items.filter((i) => i.approval_status === 'pending').length };
    });
  }, [data]);

  const summary = useMemo(() => {
    if (!sectionCounts) return null;
    const total = sectionCounts.reduce((sum, s) => sum + s.total, 0);
    const pending = sectionCounts.reduce((sum, s) => sum + s.pending, 0);
    return { total, pending, approved: total - pending };
  }, [sectionCounts]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <SkeletonBlock className="h-6 w-64" />
        <SkeletonBlock className="mt-2 h-4 w-32" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </div>
        <div className="mt-8 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }
  if (!data || !summary || !sectionCounts) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h2 className="text-xl font-semibold text-slate-900">{data.meeting.title}</h2>
      <p className="text-sm text-slate-500">{data.meeting.meeting_date}</p>

      {data.meeting.summary && (
        <div className="mt-6">
          <Card>
            <CardTitle>Summary</CardTitle>
            <p className="mt-2 text-sm text-slate-700">{data.meeting.summary}</p>
          </Card>
        </div>
      )}

      {/* Overview: extracted / pending / approved at a glance, plus a
          once-explained legend so the confidence labels aren't left to
          color alone. */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-semibold text-slate-900">{summary.total}</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Extracted</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-semibold text-amber-600">{summary.pending}</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Pending Review</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-semibold text-green-600">{summary.approved}</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Reviewed</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {CONFIDENCE_LEGEND.map((l) => (
          <span key={l.type} className="inline-flex items-center gap-1.5">
            <Badge text={l.type} tone={CONFIDENCE_TONE[l.type]} />
            {l.description}
          </span>
        ))}
      </div>

      {/* Quick-nav: jump to a section without scrolling past five others. */}
      <nav className="sticky top-0 z-10 mt-4 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        {sectionCounts.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            {s.title} <span className="text-slate-400">{s.total}</span>
            {s.pending > 0 && <span className="ml-1 text-amber-600">· {s.pending} pending</span>}
          </a>
        ))}
      </nav>

      <Section
        id="actions"
        title="Actions"
        items={data.actions as unknown as EntityRecord[]}
        resource="actions"
        titleField="description"
        fields={[
          { key: 'owner', label: 'Owner', type: 'text' },
          { key: 'due_date', label: 'Due', type: 'date' },
          { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
        ]}
        onUpdated={(u) => updateCategory('actions', u)}
      />

      <Section
        id="risks"
        title="Risks"
        items={data.risks as unknown as EntityRecord[]}
        resource="risks"
        titleField="description"
        fields={[
          { key: 'owner', label: 'Owner', type: 'text' },
          { key: 'probability', label: 'Probability', type: 'select', options: ['low', 'medium', 'high'] },
          { key: 'impact', label: 'Impact', type: 'select', options: ['low', 'medium', 'high'] },
          { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
          { key: 'mitigation', label: 'Mitigation', type: 'textarea' },
        ]}
        onUpdated={(u) => updateCategory('risks', u)}
      />

      <Section
        id="issues"
        title="Issues"
        items={data.issues as unknown as EntityRecord[]}
        resource="issues"
        titleField="description"
        fields={[
          { key: 'owner', label: 'Owner', type: 'text' },
          { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
          { key: 'resolution', label: 'Resolution', type: 'textarea' },
        ]}
        onUpdated={(u) => updateCategory('issues', u)}
      />

      <Section
        id="decisions"
        title="Decisions"
        items={data.decisions as unknown as EntityRecord[]}
        resource="decisions"
        titleField="decision"
        fields={[
          { key: 'decision_owner', label: 'Owner', type: 'text' },
          { key: 'decision_date', label: 'Date', type: 'date' },
          { key: 'impact', label: 'Impact', type: 'textarea' },
        ]}
        onUpdated={(u) => updateCategory('decisions', u)}
      />

      <Section
        id="dependencies"
        title="Dependencies"
        items={data.dependencies as unknown as EntityRecord[]}
        resource="dependencies"
        titleField="description"
        fields={[
          { key: 'upstream_activity', label: 'Upstream', type: 'text' },
          { key: 'downstream_activity', label: 'Downstream', type: 'text' },
          { key: 'owner', label: 'Owner', type: 'text' },
        ]}
        onUpdated={(u) => updateCategory('dependencies', u)}
      />

      <Section
        id="change-signals"
        title="Change Signals"
        items={data.change_signals as unknown as EntityRecord[]}
        resource="change_signals"
        titleField="description"
        fields={[
          { key: 'change_type', label: 'Type', type: 'select', options: ['scope', 'schedule', 'cost', 'resource', 'requirement'] },
          { key: 'potential_impact', label: 'Potential impact', type: 'textarea' },
        ]}
        onUpdated={(u) => updateCategory('change_signals', u)}
      />
    </div>
  );
}
