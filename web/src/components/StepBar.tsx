/**
 * Step indicator (Presentation only). Keeps the workflow obvious — the user always knows where they
 * are and what comes next. Export is shown as the final step; it happens inside the preview gate.
 */
export type FlowStep = 'upload' | 'mode' | 'review';

const STEPS: { key: FlowStep | 'export'; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'mode', label: 'Output mode' },
  { key: 'review', label: 'Review' },
  { key: 'export', label: 'Export' },
];

export function StepBar({ current }: { current: FlowStep }) {
  const activeIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2 text-xs font-medium">
      {STEPS.map((stepItem, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
        return (
          <li key={stepItem.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                state === 'active'
                  ? 'bg-slate-900 text-white'
                  : state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={state === 'todo' ? 'text-slate-400' : 'text-slate-700'}>
              {stepItem.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}
