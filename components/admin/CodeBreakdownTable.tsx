type Row = {
  code: string;
  name: string;
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
};

type Breakdown = {
  rows: Row[];
  totals: { codes: number; invited: number; accepted: number; declined: number; pending: number };
};

export default function CodeBreakdownTable({ breakdown }: { breakdown: Breakdown }) {
  const { rows, totals } = breakdown;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2 font-semibold">Invitation code</th>
            <th className="px-4 py-2 font-semibold">Party</th>
            <th className="px-4 py-2 font-semibold text-right">Invitees</th>
            <th className="px-4 py-2 font-semibold text-right">Accepted</th>
            <th className="px-4 py-2 font-semibold text-right">Declined</th>
            <th className="px-4 py-2 font-semibold text-right">Awaiting reply</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                No invitations yet.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.code}>
              <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2 text-right">{row.invited}</td>
              <td className="px-4 py-2 text-right">{row.accepted}</td>
              <td className="px-4 py-2 text-right">{row.declined}</td>
              <td className="px-4 py-2 text-right">{row.pending}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold">
          <tr>
            <td className="px-4 py-2">Total: {totals.codes} codes</td>
            <td className="px-4 py-2" />
            <td className="px-4 py-2 text-right">{totals.invited}</td>
            <td className="px-4 py-2 text-right">{totals.accepted}</td>
            <td className="px-4 py-2 text-right">{totals.declined}</td>
            <td className="px-4 py-2 text-right">{totals.pending}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
