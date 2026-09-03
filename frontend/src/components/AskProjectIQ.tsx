import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  queryProject,
  type ProjectQueryResponse,
  type QueryAnswerPoint,
  type QueryCitation,
  type QuerySource,
  type RecordType,
} from '../lib/api';
import { SkeletonBlock } from './Skeleton';
import { Card, CardTitle } from './ui/Card';
import { CONFIDENCE_TONE, Badge } from './ui/Badge';

const SUGGESTED_QUESTIONS = [
  'What changed since our last project meeting?',
  'What are the top five project risks?',
  'Which actions are overdue?',
  'What decisions are waiting for management approval?',
  'Which risks have increased in severity?',
  'What could delay the project?',
  'Generate a steering committee update.',
];

const CITATION_TYPE_TO_RECORD_TYPE: Record<
  Exclude<QueryCitation['type'], 'meeting' | 'document'>,
  RecordType
> = {
  action: 'actions',
  risk: 'risks',
  issue: 'issues',
  decision: 'decisions',
  dependency: 'dependencies',
  change_signal: 'change-signals',
};

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: QueryAnswerPoint[]; data_gap: string | null; sources: QuerySource[] }
  | { id: string; role: 'error'; text: string; retryQuestion: string };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Non-document citations link straight into the existing drill-down/meeting screens, unchanged. */
function CitationPill({ citation, projectId }: { citation: QueryCitation; projectId: string }) {
  const href =
    citation.type === 'meeting'
      ? `/meetings/${citation.id}/results`
      : `/projects/${projectId}/${CITATION_TYPE_TO_RECORD_TYPE[citation.type as Exclude<QueryCitation['type'], 'meeting' | 'document'>]}`;
  return (
    <Link
      to={href}
      className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100"
    >
      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <path d="M8 12a4 4 0 0 0 6 0l2-2a4 4 0 0 0-6-6l-1 1" strokeLinecap="round" />
        <path d="M12 8a4 4 0 0 0-6 0l-2 2a4 4 0 0 0 6 6l1-1" strokeLinecap="round" />
      </svg>
      {citation.label}
    </Link>
  );
}

function findSource(sources: QuerySource[], citation: QueryCitation): QuerySource | undefined {
  return sources.find(
    (s) => s.document_id === citation.id && (!citation.section || s.section === citation.section),
  );
}

function AnswerPointRow({
  point,
  projectId,
  sources,
}: {
  point: QueryAnswerPoint;
  projectId: string;
  sources: QuerySource[];
}) {
  // Document citations expand inline to show the actual source passage —
  // no drill-down screen exists for documents, so this is the "click a
  // citation to see the source" affordance for them.
  const [expandedCitation, setExpandedCitation] = useState<QueryCitation | null>(null);
  const expandedSource = expandedCitation ? findSource(sources, expandedCitation) : null;

  return (
    <div className="text-sm">
      <div className="flex items-start gap-2">
        <Badge
          text={point.confidence_type}
          tone={CONFIDENCE_TONE[point.confidence_type]}
          className="mt-0.5 shrink-0"
        />
        <p className="text-slate-800">{point.text}</p>
      </div>
      {point.citations.length > 0 && (
        <div className="mt-1.5 ml-[calc(1.5rem+0.5rem)] flex flex-wrap gap-1">
          {point.citations.map((c, i) =>
            c.type === 'document' ? (
              <button
                key={`document-${c.id}-${c.section ?? ''}-${i}`}
                type="button"
                onClick={() => setExpandedCitation((prev) => (prev === c ? null : c))}
                className="rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700 transition-colors hover:border-purple-400 hover:bg-purple-100"
              >
                📄 {c.label}
                {c.section ? ` — ${c.section}` : ''}
              </button>
            ) : (
              <CitationPill key={`${c.type}-${c.id}-${i}`} citation={c} projectId={projectId} />
            ),
          )}
        </div>
      )}
      {expandedCitation && (
        <div className="mt-1.5 ml-[calc(1.5rem+0.5rem)] rounded border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
          {expandedSource ? (
            <>
              <p className="font-medium">
                {expandedSource.filename}
                {expandedSource.section ? ` — ${expandedSource.section}` : ''}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-purple-800">{expandedSource.content}</p>
            </>
          ) : (
            <p className="text-slate-500">Source passage not available.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantBubble({
  answer,
  dataGap,
  sources,
  projectId,
}: {
  answer: QueryAnswerPoint[];
  dataGap: string | null;
  sources: QuerySource[];
  projectId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-sm">
      {answer.map((point, i) => (
        <AnswerPointRow key={i} point={point} projectId={projectId} sources={sources} />
      ))}
      {dataGap && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold uppercase tracking-wide">What's missing: </span>
          {dataGap}
        </div>
      )}
    </div>
  );
}

export default function AskProjectIQ({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [...prev, { id: newId(), role: 'user', text: trimmed }]);
    setInput('');
    setPending(true);
    try {
      const res: ProjectQueryResponse = await queryProject(projectId, trimmed);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', answer: res.answer, data_gap: res.data_gap, sources: res.sources },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to reach ProjectIQ.';
      setMessages((prev) => [...prev, { id: newId(), role: 'error', text: message, retryQuestion: trimmed }]);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <Card>
      <CardTitle>Ask ProjectIQ</CardTitle>
      <p className="mt-1 text-xs text-slate-400">
        Answers are grounded in this project's approved data and uploaded documents — not general
        knowledge.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending}
            onClick={() => ask(q)}
            className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-3 sm:max-h-96">
        {messages.length === 0 && !pending && (
          <p className="text-sm text-slate-400">
            Ask a question about this project, or click a suggestion above.
          </p>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">{m.text}</div>
              </div>
            );
          }
          if (m.role === 'assistant') {
            return (
              <div key={m.id} className="max-w-[95%]">
                <AssistantBubble answer={m.answer} dataGap={m.data_gap} sources={m.sources} projectId={projectId} />
              </div>
            );
          }
          return (
            <div key={m.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{m.text}</p>
              <button
                onClick={() => ask(m.retryQuestion)}
                className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          );
        })}

        {pending && (
          <div className="max-w-[70%] space-y-1.5 rounded-lg border border-slate-200 bg-white p-3">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-3 w-56" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          placeholder="Ask a question about this project…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {pending ? 'Asking…' : 'Ask'}
        </button>
      </form>
    </Card>
  );
}
