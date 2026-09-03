import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  listProjectDocuments,
  uploadDocument,
  DOCUMENT_TYPE_OPTIONS,
  type DocumentIngestionStatus,
  type ProjectDocument,
} from '../lib/api';
import { SkeletonCard } from './Skeleton';

const STATUS_STYLES: Record<DocumentIngestionStatus, string> = {
  pending: 'bg-slate-100 text-slate-600 border-slate-300',
  processing: 'bg-blue-100 text-blue-700 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
};

function StatusBadge({ status }: { status: DocumentIngestionStatus }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Project Documents</h3>
      <p className="mt-1 text-xs text-slate-400">
        Charter, plan, RAID register, minutes, requirements, contracts, SOPs, change requests, status
        reports, budget info — .pdf, .docx, .md, or .txt.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-500">Document type</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            disabled={uploading}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
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
            className="mt-0.5 text-sm"
          />
        </div>
        {uploading && <span className="text-xs text-slate-500">Uploading and ingesting…</span>}
      </div>

      {uploadError && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {uploadError}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading && <SkeletonCard lines={1} />}

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

        {!loading && !error && documents.length === 0 && (
          <p className="text-sm text-slate-400">No documents uploaded yet.</p>
        )}

        {!loading &&
          !error &&
          documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-3 py-2">
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
    </div>
  );
}
