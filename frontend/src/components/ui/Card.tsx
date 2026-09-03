import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** The card shell used everywhere in the app — previously repeated verbatim in ~8 files. */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  linkTo,
  icon,
}: {
  children: ReactNode;
  linkTo?: string;
  icon?: ReactNode;
}) {
  const inner = (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
      {linkTo ? (
        <Link to={linkTo} className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-700 hover:underline">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </h3>
  );
}
