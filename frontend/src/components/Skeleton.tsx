/** A single pulsing placeholder block. Compose these to match the shape of the real content being loaded. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

/** Placeholder for a `rounded-lg border bg-white p-4 shadow-sm` card, sized like the real cards it replaces. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SkeletonBlock className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a StatCell-style number tile. */
export function SkeletonStat() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SkeletonBlock className="mx-auto h-6 w-10" />
      <SkeletonBlock className="mx-auto mt-2 h-3 w-16" />
    </div>
  );
}
