/**
 * Meeting Analyst's draft items don't have DB ids yet — the Context and
 * Impact Analysts (and the final persistence step) need a stable way to
 * address a specific item anyway. withRefs() tags each item with a
 * temporary reference like "risk-0", scoped to its category, distinct in
 * format from a real UUID so downstream code can tell "existing DB row" and
 * "new item from this run" apart at a glance.
 */
export function withRefs<T>(prefix: string, items: T[]): Array<T & { ref: string }> {
  return items.map((item, i) => ({ ...item, ref: `${prefix}-${i}` }));
}
