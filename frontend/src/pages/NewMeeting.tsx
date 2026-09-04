import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, analyseMeeting, createMeeting, listProjects, type Project } from '../lib/api';
import { ErrorBanner, InfoBanner } from '../components/ui/StatusBanner';
import NewProjectForm from '../components/NewProjectForm';

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
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    document.title = 'ProjectIQ · New Meeting';
  }, []);

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

  const fieldsDisabled = phase !== 'idle' && phase !== 'error';
  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60';

  function handleProjectCreated(project: Project) {
    setProjects((prev) => [...prev, project]);
    setProjectId(project.id);
    setShowNewProject(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h2 className="text-xl font-semibold text-navy">New Meeting</h2>
      <p className="mt-1 text-sm text-slate-500">
        Capture a meeting transcript, link it to a project, and run AI analysis on it.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700" htmlFor="project">
              Project
            </label>
            <button
              type="button"
              onClick={() => setShowNewProject((v) => !v)}
              disabled={fieldsDisabled}
              className="text-xs font-medium text-cyan transition-colors hover:text-brand-700 disabled:opacity-60"
            >
              {showNewProject ? 'Cancel' : '+ New project'}
            </button>
          </div>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={fieldsDisabled}
            className={inputClass}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {showNewProject && (
            <div className="mt-3">
              <NewProjectForm onCreated={handleProjectCreated} onCancel={() => setShowNewProject(false)} />
            </div>
          )}
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
            disabled={fieldsDisabled}
            className={inputClass}
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
            disabled={fieldsDisabled}
            className={inputClass}
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
            disabled={fieldsDisabled}
            className="mt-1 w-full text-sm disabled:opacity-60"
          />
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="transcript">
            …or paste transcript text
          </label>
          <textarea
            id="transcript"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            disabled={fieldsDisabled}
            rows={10}
            className={`${inputClass} font-mono`}
            placeholder="Paste the raw meeting transcript here…"
          />
        </div>

        {error && <ErrorBanner message={error} />}

        {phase === 'saving' && <InfoBanner>Saving meeting and transcript…</InfoBanner>}
        {phase === 'analysing' && (
          <InfoBanner>
            Analysing transcript — this runs three AI agents in sequence and can take a minute…
          </InfoBanner>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-brand-600 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 disabled:hover:text-slate-500"
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
