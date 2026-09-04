import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, listProjects, type Project } from '../lib/api';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorBanner } from '../components/ui/StatusBanner';
import NewProjectForm from '../components/NewProjectForm';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    document.title = 'ProjectIQ · Projects';
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleCreated(project: Project) {
    setProjects((prev) => [...prev, project]);
    setShowNewProject(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy">Projects</h2>
          <p className="mt-1 text-sm text-slate-500">Select a project to view its dashboard.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewProject((v) => !v)}
          className="shrink-0 rounded-md bg-cyan px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-brand-600 hover:text-white"
        >
          {showNewProject ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {showNewProject && (
        <div className="mt-4">
          <NewProjectForm onCreated={handleCreated} onCancel={() => setShowNewProject(false)} />
        </div>
      )}

      <div className="mt-6 space-y-2">
        {loading && (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </>
        )}

        {error && <ErrorBanner message={error} onRetry={load} />}

        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-slate-400">No projects yet — they'll appear here once created.</p>
        )}

        {!loading &&
          !error &&
          projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
            >
              <span className="text-sm font-medium text-navy">{p.name}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}
