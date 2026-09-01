import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, listProjects, type Project } from '../lib/api';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-slate-500">Loading projects…</div>;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="text-xl font-semibold text-slate-900">Projects</h2>
      <p className="mt-1 text-sm text-slate-500">Select a project to view its dashboard.</p>

      {projects.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No projects yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/projects/${p.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
              >
                <span className="text-sm font-medium text-slate-900">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
