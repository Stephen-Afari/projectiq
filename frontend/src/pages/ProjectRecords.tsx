import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  getProjectMeetings,
  getProjectRecords,
  type ConfidenceType,
  type Meeting,
  type RecordType,
} from '../lib/api';
import { SkeletonCard } from '../components/Skeleton';

type EntityRecord = Record<string, unknown> & {
  id: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  confidence_type: ConfidenceType | null;
  source_excerpt: string | null;
  meeting_id: string | null;
  created_at: string;
};

interface FieldConfig {
  key: string;
  label: string;
}

interface TypeConfig {
  label: string;
  titleField: string;
  statusField: string | null;
  ownerField: string | null;
  extraFields: FieldConfig[];
}

const TYPE_CONFIG: Record<RecordType, TypeConfig> = {
  actions: {
    label: 'Actions',
    titleField: 'description',
    statusField: 'status',
    ownerField: 'owner',
    extraFields: [
      { key: 'due_date', label: 'Due' },
      { key: 'priority', label: 'Priority' },
    ],
  },
  risks: {
    label: 'Risks',
    titleField: 'description',
    statusField: 'status',
    ownerField: 'owner',
    extraFields: [
      { key: 'severity', label: 'Severity' },
      { key: 'probability', label: 'Probability' },
      { key: 'impact', label: 'Impact' },
    ],
  },
  issues: {
    label: 'Issues',
    titleField: 'description',
    statusField: 'status',
    ownerField: 'owner',
    extraFields: [{ key: 'severity', label: 'Severity' }],
  },
  decisions: {
    label: 'Decisions',
    titleField: 'decision',
    statusField: null,
    ownerField: 'decision_owner',
    extraFields: [
      { key: 'decision_date', label: 'Date' },
      { key: 'impact', label: 'Impact' },
    ],
  },
  dependencies: {
    label: 'Dependencies',
    titleField: 'description',
    statusField: 'status',
    ownerField: 'owner',
    extraFields: [
      { key: 'upstream_activity', label: 'Upstream' },
      { key: 'downstream_activity', label: 'Downstream' },
    ],
  },
  'change-signals': {
    label: 'Change Signals',
    titleField: 'description',
    statusField: 'status',
    ownerField: null,
    extraFields: [{ key: 'change_type', label: 'Type' }],
  },
};

const APPROVAL_STYLES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 border-slate-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
};

const CONFIDENCE_STYLES: Record<ConfidenceType, string> = {
  fact: 'bg-green-100 text-green-800 border-green-300',
  inference: 'bg-amber-100 text-amber-800 border-amber-300',
  recommendation: 'bg-blue-100 text-blue-800 border-blue-300',
};

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${className}`}>
      {text}
    </span>
  );
}

// A view= query param seeds the default filters — the page still loads the
// full list, so the user can broaden from there rather than being stuck.
function defaultApprovalFilter(view: string | null): 'all' | 'pending' | 'approved' | 'rejected' {
  if (view === 'pending') return 'pending';
  return 'approved';
}

function RecordCard({ item, config, meeting }: { item: EntityRecord; config: TypeConfig; meeting: Meeting | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{String(item[config.titleField] ?? '')}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.confidence_type && (
            <Badge text={item.confidence_type} className={CONFIDENCE_STYLES[item.confidence_type]} />
          )}
          <Badge text={item.approval_status} className={APPROVAL_STYLES[item.approval_status] ?? ''} />
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
        {config.ownerField && item[config.ownerField] ? (
          <div>
            <dt className="inline font-medium text-slate-600">Owner: </dt>
            <dd className="inline">{String(item[config.ownerField])}</dd>
          </div>
        ) : null}
        {config.statusField && item[config.statusField] ? (
          <div>
            <dt className="inline font-medium text-slate-600">Status: </dt>
            <dd className="inline">{String(item[config.statusField])}</dd>
          </div>
        ) : null}
        {config.extraFields.map((f) => {
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
          “{String(item.source_excerpt)}”
        </blockquote>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Source meeting:{' '}
        {meeting ? (
          <Link to={`/meetings/${meeting.id}/results`} className="text-slate-700 underline hover:text-slate-900">
            {meeting.title} ({meeting.meeting_date})
          </Link>
        ) : (
          <span className="text-slate-400">No linked meeting</span>
        )}
      </p>
    </div>
  );
}

export default function ProjectRecords() {
  const { id, type } = useParams<{ id: string; type: RecordType }>();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  const [items, setItems] = useState<EntityRecord[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approvalFilter, setApprovalFilter] = useState(() => defaultApprovalFilter(view));
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const config = type ? TYPE_CONFIG[type] : undefined;

  const load = useCallback(() => {
    if (!id || !type) return;
    setLoading(true);
    setError(null);
    Promise.all([getProjectRecords<EntityRecord>(id, type), getProjectMeetings(id)])
      .then(([records, meetingList]) => {
        setItems(records);
        setMeetings(meetingList);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load records'))
      .finally(() => setLoading(false));
  }, [id, type]);

  useEffect(() => {
    load();
    // Reset filters to the view's default whenever the type/view changes (new drill-down entry).
    setApprovalFilter(defaultApprovalFilter(view));
    setStatusFilter('all');
    setOwnerFilter('all');
    setDateFrom('');
    setDateTo('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]);

  const meetingsById = useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const m of meetings) map.set(m.id, m);
    return map;
  }, [meetings]);

  const statusOptions = useMemo(() => {
    if (!config?.statusField) return [];
    const values = new Set<string>();
    for (const item of items) {
      const v = item[config.statusField];
      if (typeof v === 'string' && v) values.add(v);
    }
    return Array.from(values).sort();
  }, [items, config]);

  const ownerOptions = useMemo(() => {
    if (!config?.ownerField) return [];
    const values = new Set<string>();
    for (const item of items) {
      const v = item[config.ownerField];
      if (typeof v === 'string' && v) values.add(v);
    }
    return Array.from(values).sort();
  }, [items, config]);

  // Pure client-side filtering over the already-fetched list — no network
  // call on any filter change, so narrowing is instant regardless of
  // project size.
  const filtered = useMemo(() => {
    if (!config) return [];
    return items.filter((item) => {
      if (approvalFilter !== 'all' && item.approval_status !== approvalFilter) return false;
      if (config.statusField && statusFilter !== 'all' && item[config.statusField] !== statusFilter) return false;
      if (config.ownerField && ownerFilter !== 'all' && item[config.ownerField] !== ownerFilter) return false;
      if (dateFrom && item.created_at < dateFrom) return false;
      if (dateTo && item.created_at > `${dateTo}T23:59:59`) return false;
      return true;
    });
  }, [items, config, approvalFilter, statusFilter, ownerFilter, dateFrom, dateTo]);

  if (!id || !type || !config) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Unknown record type.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to={`/projects/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to dashboard
      </Link>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">{config.label}</h2>

      {!loading && !error && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Approval</label>
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value as typeof approvalFilter)}
              className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {config.statusField && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.ownerField && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Owner</label>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {ownerOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-500">Created from</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Created to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>

          {(approvalFilter !== 'all' || statusFilter !== 'all' || ownerFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setApprovalFilter('all');
                setStatusFilter('all');
                setOwnerFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear filters
            </button>
          )}

          <p className="ml-auto text-xs text-slate-400">
            {filtered.length} of {items.length}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={load}
              className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-400">No {config.label.toLowerCase()} yet.</p>
        )}

        {!loading && !error && items.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-slate-400">No records match these filters.</p>
        )}

        {!loading &&
          !error &&
          filtered.map((item) => (
            <RecordCard
              key={item.id}
              item={item}
              config={config}
              meeting={item.meeting_id ? (meetingsById.get(item.meeting_id) ?? null) : null}
            />
          ))}
      </div>
    </div>
  );
}
