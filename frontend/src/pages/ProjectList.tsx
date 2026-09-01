import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, listProjects, type Project } from '../lib/api';
import { SkeletonCard } from '../components/Skeleton';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="text-xl font-semibold text-slate-900">Projects</h2>
      <p className="mt-1 text-sm text-slate-500">Select a project to view its dashboard.</p>

      <div className="mt-6 space-y-2">
        {loading && (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
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

        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-slate-400">No projects yet.</p>
        )}

        {!loading &&
          !error &&
          projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            >
              <span className="text-sm font-medium text-slate-900">{p.name}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}
