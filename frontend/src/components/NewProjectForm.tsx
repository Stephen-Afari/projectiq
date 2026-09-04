import { useState } from 'react';
import { ApiError, createProject, type HealthLevel, type Project, type ProjectStatus } from '../lib/api';
import { Card } from './ui/Card';
import { ErrorBanner } from './ui/StatusBanner';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const HEALTH_OPTIONS: { value: HealthLevel; label: string }[] = [
  { value: 'green', label: 'Green' },
  { value: 'amber', label: 'Amber' },
  { value: 'red', label: 'Red' },
];

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60';

export default function NewProjectForm({
  onCreated,
  onCancel,
}: {
  onCreated: (project: Project) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [health, setHealth] = useState<HealthLevel>('green');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        health,
        start_date: startDate || undefined,
        target_date: targetDate || undefined,
      });
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="new-project-name">
            Name
          </label>
          <input
            id="new-project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className={inputClass}
            placeholder="e.g. ERP Transformation Programme"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="new-project-description">
            Description
          </label>
          <textarea
            id="new-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={2}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="new-project-status">
              Status
            </label>
            <select
              id="new-project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={submitting}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="new-project-health">
              Health
            </label>
            <select
              id="new-project-health"
              value={health}
              onChange={(e) => setHealth(e.target.value as HealthLevel)}
              disabled={submitting}
              className={inputClass}
            >
              {HEALTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="new-project-start">
              Start date
            </label>
            <input
              id="new-project-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="new-project-target">
              Target date
            </label>
            <input
              id="new-project-target"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-brand-600 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 disabled:hover:text-slate-500"
          >
            {submitting ? 'Creating…' : 'Create project'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
