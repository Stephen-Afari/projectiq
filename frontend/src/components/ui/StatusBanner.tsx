/** The red error box (with optional Retry) and blue/amber info banner, both previously hand-rolled ad hoc in 5+ files. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function InfoBanner({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'amber' }) {
  const styles =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
