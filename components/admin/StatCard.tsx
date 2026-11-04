export default function StatCard({
  label,
  value,
  hint,
  sub,
}: {
  label: string;
  value: number;
  hint?: string;
  /** A short line under the number, e.g. "5 still to send". */
  sub?: string;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-slate-200 px-3 py-2.5"
      title={hint}
    >
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="font-stat mt-0.5 text-2xl font-semibold leading-none">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500 truncate">{sub}</p>}
    </div>
  );
}
