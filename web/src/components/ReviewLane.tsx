import { useEffect, useRef, useState } from 'react';
import type { ReviewGroup } from '../store/types';

/**
 * The review lane (Presentation only — no logic; CLAUDE.md §5). Renders the human-review groups it
 * is handed and dispatches the two keystroke actions. Keyboard-first:
 *   ↑/↓ (or k/j) move · H = Hide · V = Keep visible
 * Both actions are instantly reversible (pressing the same action again clears the decision).
 */
export function ReviewLane({
  groups,
  onDecide,
}: {
  groups: ReviewGroup[];
  onDecide: (groupKey: string, decision: 'hide' | 'keep') => void;
}) {
  const [focused, setFocused] = useState(0);
  const laneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    laneRef.current?.focus();
  }, []);
  useEffect(() => {
    if (focused > groups.length - 1) setFocused(Math.max(0, groups.length - 1));
  }, [groups.length, focused]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (groups.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        setFocused((i) => Math.min(groups.length - 1, i + 1));
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        setFocused((i) => Math.max(0, i - 1));
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        onDecide(groups[focused]!.groupKey, 'hide');
        break;
      case 'v':
      case 'V':
        e.preventDefault();
        onDecide(groups[focused]!.groupKey, 'keep');
        break;
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Review lane ({groups.length})
        </h2>
        <p className="text-xs text-slate-400">↑/↓ move · H hide · V keep visible</p>
      </div>

      <div
        ref={laneRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="mt-3 space-y-2 rounded-xl outline-none focus:ring-2 focus:ring-slate-300"
      >
        {groups.length === 0 && (
          <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
            Nothing needs your review.
          </p>
        )}

        {groups.map((group, i) => (
          <ReviewItem
            key={group.groupKey}
            group={group}
            focused={i === focused}
            onFocus={() => setFocused(i)}
            onDecide={onDecide}
          />
        ))}
      </div>
    </section>
  );
}

function ReviewItem({
  group,
  focused,
  onFocus,
  onDecide,
}: {
  group: ReviewGroup;
  focused: boolean;
  onFocus: () => void;
  onDecide: (groupKey: string, decision: 'hide' | 'keep') => void;
}) {
  return (
    <div
      onMouseEnter={onFocus}
      className={`rounded-lg bg-white p-4 ring-1 transition ${
        focused ? 'ring-slate-900' : 'ring-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{group.type}</span>
        <span className="text-slate-500">{group.reason}</span>
        {group.count > 1 && (
          <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
            appears {group.count}×
          </span>
        )}
        <DecisionTag decision={group.decision} />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-700">
        …{group.context.before}
        <mark className="rounded bg-yellow-200 px-0.5 font-medium text-slate-900">
          {group.context.match}
        </mark>
        {group.context.after}…
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onDecide(group.groupKey, 'hide')}
          className={`rounded px-3 py-1 text-xs font-medium ${
            group.decision === 'hidden'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Hide <kbd className="opacity-60">H</kbd>
        </button>
        <button
          onClick={() => onDecide(group.groupKey, 'keep')}
          className={`rounded px-3 py-1 text-xs font-medium ${
            group.decision === 'kept'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Keep visible <kbd className="opacity-60">V</kbd>
        </button>
      </div>
    </div>
  );
}

function DecisionTag({ decision }: { decision: ReviewGroup['decision'] }) {
  if (decision === 'hidden') return <span className="ml-auto text-slate-500">→ hidden</span>;
  if (decision === 'kept') return <span className="ml-auto text-emerald-600">→ kept visible</span>;
  return <span className="ml-auto text-slate-300">undecided</span>;
}
