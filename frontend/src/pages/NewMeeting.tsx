import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, analyseMeeting, createMeeting, listProjects, type Project } from '../lib/api';

type Phase = 'idle' | 'saving' | 'analysing' | 'error';

export default function NewMeeting() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load projects'));
  }, []);

  const canSubmit =
    projectId.length > 0 &&
    title.trim().length > 0 &&
    meetingDate.length > 0 &&
    transcriptText.trim().length > 0 &&
    phase === 'idle';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setTranscriptText(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      setPhase('saving');
      const meeting = await createMeeting({
        project_id: projectId,
        title: title.trim(),
        meeting_date: meetingDate,
        transcript_text: transcriptText,
        source: 'upload',
      });

      setPhase('analysing');
      await analyseMeeting(meeting.id);

      navigate(`/meetings/${meeting.id}/results`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setPhase('error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h2 className="text-xl font-semibold text-slate-900">New Meeting</h2>
      <p className="mt-1 text-sm text-slate-500">
        Capture a meeting transcript, link it to a project, and run AI analysis on it.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="project">
            Project
          </label>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={phase !== 'idle' && phase !== 'error'}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="title">
            Meeting title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={phase !== 'idle' && phase !== 'error'}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Steering Committee — Week 4"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="date">
            Meeting date
          </label>
          <input
            id="date"
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            disabled={phase !== 'idle' && phase !== 'error'}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="file">
            Upload transcript (.txt or .md)
          </label>
          <input
            id="file"
            type="file"
            accept=".txt,.md"
            onChange={handleFileChange}
            disabled={phase !== 'idle' && phase !== 'error'}
            className="mt-1 w-full text-sm"
          />
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="transcript">
            …or paste transcript text
          </label>
          <textarea
            id="transcript"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            disabled={phase !== 'idle' && phase !== 'error'}
            rows={10}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            placeholder="Paste the raw meeting transcript here…"
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {phase === 'saving' && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Saving meeting and transcript…
          </div>
        )}
        {phase === 'analysing' && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Analysing transcript — this runs three AI agents in sequence and can take a minute…
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {phase === 'saving'
            ? 'Saving…'
            : phase === 'analysing'
              ? 'Analysing…'
              : 'Save & Analyse'}
        </button>
      </form>
    </div>
  );
}
