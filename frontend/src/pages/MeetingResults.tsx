import { useEffect, useState } from 'react';
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

const CONFIDENCE_STYLES: Record<ConfidenceType, string> = {
  fact: 'bg-green-100 text-green-800 border-green-300',
  inference: 'bg-amber-100 text-amber-800 border-amber-300',
  recommendation: 'bg-blue-100 text-blue-800 border-blue-300',
};

function ConfidenceBadge({ type }: { type: ConfidenceType | null }) {
  if (!type) return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${CONFIDENCE_STYLES[type]}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-600 border-slate-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}

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
      <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="font-medium uppercase tracking-wide text-slate-400">Impact Analyst (inference):</span>{' '}
        no material impact identified{impact.reasoning ? ` — ${impact.reasoning}` : ''}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
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
    <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-semibold uppercase tracking-wide">Possible duplicate</span>
      {flags.duplicate_reasoning && <p className="mt-0.5">{flags.duplicate_reasoning}</p>}
    </div>
  );
}

function RelatedItems({ flags }: { flags: ContextFlags }) {
  if (!flags.related_items.length) return null;
  return (
    <div className="mt-2 text-xs text-slate-500">
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
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1 text-xs">
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
      className={`rounded-lg border bg-white p-4 shadow-sm ${
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

      {item.context_flags && <DuplicateBanner flags={item.context_flags} />}
      {item.context_flags && <RelatedItems flags={item.context_flags} />}
      {item.impact_assessment && <ImpactCallout impact={item.impact_assessment} />}

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
              className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => approve('rejected')}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() => setEditing(true)}
              className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
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
  title,
  items,
  resource,
  titleField,
  fields,
  onUpdated,
}: {
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
    <section className="mt-8">
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

  useEffect(() => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);
    getMeetingResults(meetingId)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load meeting results'))
      .finally(() => setLoading(false));
  }, [meetingId]);

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

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-slate-500">Loading meeting results…</div>;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="text-xl font-semibold text-slate-900">{data.meeting.title}</h2>
      <p className="text-sm text-slate-500">{data.meeting.meeting_date}</p>

      {data.meeting.summary && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
          <p className="mt-2 text-sm text-slate-700">{data.meeting.summary}</p>
        </div>
      )}

      <Section
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
