import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  listProjectDocuments,
  uploadDocument,
  DOCUMENT_TYPE_OPTIONS,
  type ProjectDocument,
} from '../lib/api';
import { SkeletonCard } from './Skeleton';
import { Card, CardTitle } from './ui/Card';
import { StatusBadge } from './ui/Badge';
import { ErrorBanner } from './ui/StatusBanner';

export default function DocumentUpload({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string>('other');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listProjectDocuments(projectId)
      .then(setDocuments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(projectId, file, documentType);
      load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardTitle>Project Documents</CardTitle>
      <p className="mt-1 text-xs text-slate-400">
        Charter, plan, RAID register, minutes, requirements, contracts, SOPs, change requests, status
        reports, budget info — .pdf, .docx, .md, or .txt.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="block text-[11px] font-medium text-slate-500">Document type</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            disabled={uploading}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm sm:w-auto"
          >
            {DOCUMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500">File</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.md,.txt"
            onChange={handleFileChange}
            disabled={uploading}
            className="mt-0.5 w-full text-sm sm:w-auto"
          />
        </div>
        {uploading && <span className="text-xs text-slate-500">Uploading and ingesting…</span>}
      </div>

      {uploadError && (
        <div className="mt-2">
          <ErrorBanner message={uploadError} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading && <SkeletonCard lines={1} />}

        {error && <ErrorBanner message={error} onRetry={load} />}

        {!loading && !error && documents.length === 0 && (
          <p className="text-sm text-slate-400">No documents uploaded yet.</p>
        )}

        {!loading &&
          !error &&
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-800">{doc.filename}</p>
                <p className="text-xs text-slate-500">
                  {DOCUMENT_TYPE_OPTIONS.find((o) => o.value === doc.document_type)?.label ?? doc.document_type ?? 'Uncategorised'}
                  {doc.ingestion_status === 'failed' && doc.ingestion_error ? ` — ${doc.ingestion_error}` : ''}
                </p>
              </div>
              <StatusBadge status={doc.ingestion_status} />
            </div>
          ))}
      </div>
    </Card>
  );
}
