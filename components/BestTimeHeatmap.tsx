// Heatmap 7 giorni × 24 ore basata sull'engagement medio dei post storici.
// Calcolato server-side e passato come prop.

export interface HeatCell {
  dow: number; // 0 = lunedì … 6 = domenica
  hour: number; // 0..23
  score: number; // 0..1 (normalizzato sul max)
  count: number;
}

const DOW = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function cellStyle(score: number, count: number): string {
  if (count === 0) return "bg-neutral-100 dark:bg-neutral-900";
  // gradiente brand basato su score
  if (score > 0.8) return "bg-brand-600";
  if (score > 0.6) return "bg-brand-500";
  if (score > 0.4) return "bg-brand-500/70";
  if (score > 0.2) return "bg-brand-500/40";
  return "bg-brand-500/20";
}

export function BestTimeHeatmap({ cells }: { cells: HeatCell[] }) {
  const total = cells.reduce((s, c) => s + c.count, 0);
  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        Non abbiamo ancora abbastanza post storici per calcolare l'orario migliore.
      </div>
    );
  }

  const grid = new Map<string, HeatCell>();
  for (const c of cells) grid.set(`${c.dow}-${c.hour}`, c);

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th className="w-8" />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="w-6 pb-1 text-center font-normal text-neutral-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW.map((label, dow) => (
            <tr key={label}>
              <td className="pr-2 text-right text-neutral-500">{label}</td>
              {Array.from({ length: 24 }, (_, hour) => {
                const c = grid.get(`${dow}-${hour}`);
                const score = c?.score ?? 0;
                const count = c?.count ?? 0;
                return (
                  <td key={hour} className="p-0.5">
                    <div
                      className={`h-5 w-5 rounded-sm ${cellStyle(score, count)}`}
                      title={
                        count > 0
                          ? `${DOW[dow]} ${hour}:00 — ${count} post, score ${(score * 100).toFixed(0)}%`
                          : `${DOW[dow]} ${hour}:00 — nessun post`
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500">
        Colore = engagement medio relativo per slot orario. Tooltip per i dettagli.
      </p>
    </div>
  );
}
