export default function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-slate-200 px-3 py-2.5"
      title={hint}
    >
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="font-stat mt-0.5 text-2xl font-semibold leading-none">{value}</p>
    </div>
  );
}
