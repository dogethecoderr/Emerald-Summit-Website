// Small pieces shared by the metrics views (the app's metrics_widgets.dart):
// stat tiles, a labelled bar list, and a section heading.
import type { ReactNode } from 'react';

export function StatTiles({ stats }: { stats: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-border p-4">
          <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function MetricsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function BarList({ rows, total, emptyText }: { rows: [string, number][]; total: number; emptyText: string }) {
  if (rows.length === 0 || total === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <ul className="space-y-2">
      {rows.map(([label, n]) => (
        <li key={label} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {n} · {Math.round((n / total) * 100)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: [T, string][];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={selected === value}
          onClick={() => onSelect(value)}
          className={
            selected === value
              ? 'rounded-full bg-emerald px-3 py-1 text-sm font-semibold text-white'
              : 'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-accent'
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A table of counts shaded by size, rows × columns, with totals. */
export function HeatTable({
  table,
  cornerLabel,
  emptyText,
}: {
  table: import('../models/metrics').CrossTab;
  cornerLabel: string;
  emptyText: string;
}) {
  if (table.rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const shade = (n: number) => (n === 0 || table.maxCell === 0 ? undefined : `rgba(16, 185, 129, ${0.12 + 0.55 * (n / table.maxCell)})`);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">{cornerLabel}</th>
            {table.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 text-right font-medium">{c}</th>)}
            <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r} className="border-b border-border last:border-0">
              <th scope="row" className="max-w-[14rem] truncate px-3 py-2 text-left font-normal">{r}</th>
              {table.columns.map((c) => {
                const n = table.count(r, c);
                return <td key={c} className="px-3 py-2 text-right tabular-nums" style={{ background: shade(n) }}>{n || ''}</td>;
              })}
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{table.rowTotals.get(r) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
