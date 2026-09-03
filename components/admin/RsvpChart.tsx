type Stats = {
  totalInvited: number;
  accepted: number;
  acceptedHeadcount: number;
  declined: number;
  pending: number;
};

const SEGMENTS = [
  { key: 'accepted', label: 'Accepted', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'declined', label: 'Declined', bar: 'bg-rose-400', dot: 'bg-rose-400' },
  { key: 'pending', label: 'Pending', bar: 'bg-amber-400', dot: 'bg-amber-400' },
] as const;

/**
 * RSVP breakdown bar (PRD P0-08). Rendered with plain elements rather than a
 * charting library so it stays server-rendered and adds no bundle weight.
 */
export default function RsvpChart({ stats }: { stats: Stats }) {
  const total = stats.totalInvited;

  if (total === 0) {
    return (
      <p className="text-sm text-slate-500">
        No guests yet — add your first guest to see the breakdown.
      </p>
    );
  }

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div>
      <div
        className="flex h-4 w-full overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={`RSVP breakdown of ${total} guests: ${SEGMENTS.map(
          (s) => `${stats[s.key]} ${s.label.toLowerCase()}`
        ).join(', ')}`}
      >
        {SEGMENTS.map((segment) =>
          stats[segment.key] > 0 ? (
            <div
              key={segment.key}
              className={segment.bar}
              style={{ width: `${pct(stats[segment.key])}%` }}
            />
          ) : null
        )}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {SEGMENTS.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${segment.dot}`} aria-hidden="true" />
            <span className="text-slate-600">{segment.label}</span>
            <span className="font-semibold tabular-nums">{stats[segment.key]}</span>
            <span className="text-slate-400 tabular-nums">
              ({pct(stats[segment.key])}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
