type Level = {
  key: string;
  number: number;
  label: string;
  sent: number;
  toSend: number;
  noNumber: number;
};

/**
 * Messaging progress, one bar per message step (sent vs still to send), drawn
 * the same way as the RSVP breakdown bar: plain elements, no chart library.
 * Guests with no WhatsApp number are not in the bar; they are listed beside it.
 */
export default function MessagingChart({ levels }: { levels: Level[] }) {
  const anyone = levels.some((level) => level.sent + level.toSend + level.noNumber > 0);
  if (!anyone) {
    return (
      <p className="text-sm text-slate-500">
        No guests yet — add your first guest to see messaging progress.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {levels.map((level) => {
        const reachable = level.sent + level.toSend;
        const pct = reachable === 0 ? 0 : Math.round((level.sent / reachable) * 100);
        return (
          <div key={level.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-700">
                Step {level.number} · {level.label}
              </span>
              <span className="text-slate-500">
                <span className="font-stat font-semibold text-slate-800">{level.sent}</span> sent ·{' '}
                <span className="font-stat font-semibold text-slate-800">{level.toSend}</span> to send
                {level.noNumber > 0 && (
                  <>
                    {' '}
                    · <span className="font-stat">{level.noNumber}</span> no number
                  </>
                )}
                <span className="font-stat text-slate-400"> ({pct}%)</span>
              </span>
            </div>
            <div
              className="flex h-4 w-full overflow-hidden rounded-full bg-slate-200"
              role="img"
              aria-label={`Step ${level.number}, ${level.label}: ${level.sent} sent, ${level.toSend} still to send, ${level.noNumber} without a WhatsApp number`}
            >
              {level.sent > 0 && <div className="bg-emerald-500" style={{ width: `${pct}%` }} />}
              {level.toSend > 0 && <div className="bg-amber-400" style={{ width: `${100 - pct}%` }} />}
            </div>
          </div>
        );
      })}

      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-slate-600">Sent</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="text-slate-600">Still to send</span>
        </li>
      </ul>
    </div>
  );
}
