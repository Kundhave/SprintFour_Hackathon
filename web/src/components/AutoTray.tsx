import { useState } from 'react';
import type { AutoGroup } from '../store/types';

/**
 * The auto-handled tray (Presentation only; CLAUDE.md §3 trust, §7 rule 1). Auto-redactions are
 * applied silently but disclosed here — auditable on demand, closed by default. Each item can be
 * reversed in one click (un-redacting is a human act; the never-auto-expose invariant holds).
 */
export function AutoTray({
  groups,
  count,
  onReverse,
}: {
  groups: AutoGroup[];
  count: number;
  onReverse: (groupKey: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-700">Auto-handled ({count})</span>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'} ▾</span>
      </button>

      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {groups.length === 0 && (
            <li className="px-4 py-4 text-sm text-slate-400">No auto-redactions.</li>
          )}
          {groups.map((group) => (
            <li key={group.groupKey} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {group.type}
              </span>
              <span className="text-slate-500">{group.reason}</span>
              {group.count > 1 && <span className="text-amber-600">appears {group.count}×</span>}
              {group.reversed && <span className="text-rose-500">reversed — now visible</span>}
              <button
                onClick={() => onReverse(group.groupKey)}
                className="ml-auto rounded bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200"
              >
                {group.reversed ? 'Re-redact' : 'Reverse'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
