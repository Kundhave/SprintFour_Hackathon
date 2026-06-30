import { useMemo, useReducer, useState } from 'react';
import { spanReducer, initialState } from './store/spanStore';
import { selectReviewGroups, selectAutoGroups, selectAutoCount } from './store/selectors';
import { ReviewLane } from './components/ReviewLane';
import { AutoTray } from './components/AutoTray';
import { UploadStep } from './components/UploadStep';
import { ModeStep } from './components/ModeStep';
import { ExportGate } from './components/ExportGate';
import { StepBar, type FlowStep } from './components/StepBar';
import type { ExportMode, Span } from './store/types';

/**
 * App shell (Presentation layer — CLAUDE.md §5). Owns only the workflow position and the single span
 * store, and derives every view from them. All review decisions are reversible status toggles. No
 * product logic lives here — detection, routing, and the export build all happen server-side in the
 * pure domain core.
 *
 * Flow: Upload PDF → Choose output mode → Detection pipeline → Review ambiguous → Preview → Export.
 */
export default function App() {
  const [step, setStep] = useState<FlowStep>('upload');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ExportMode>('redact');
  const [state, dispatch] = useReducer(spanReducer, initialState);
  const [detecting, setDetecting] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewGroups = useMemo(() => selectReviewGroups(state.spans, text), [state.spans, text]);
  const autoGroups = useMemo(() => selectAutoGroups(state.spans), [state.spans]);
  const autoCount = useMemo(() => selectAutoCount(state.spans), [state.spans]);

  function handleUploaded(uploadedText: string) {
    setText(uploadedText);
    setStep('mode');
  }

  async function handleChooseMode(chosen: ExportMode) {
    setMode(chosen);
    setStep('review');
    setDetecting(true);
    setError(null);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { spans: Span[] };
      dispatch({ type: 'init', spans: data.spans });
    } catch {
      setError('Detection failed — is the backend running?');
    } finally {
      setDetecting(false);
    }
  }

  function startOver() {
    setStep('upload');
    setText('');
    setGateOpen(false);
    setError(null);
    dispatch({ type: 'init', spans: [] });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conseal Review</h1>
            <p className="mt-1 text-sm text-slate-600">
              The catchable redactions are done for you. You only decide the calls a machine can't make.
            </p>
          </div>
          {step !== 'upload' && (
            <button
              onClick={startOver}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Start over
            </button>
          )}
        </header>

        <StepBar current={step} />

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {step === 'upload' && <UploadStep onLoaded={handleUploaded} />}

        {step === 'mode' && <ModeStep onChoose={handleChooseMode} />}

        {step === 'review' && (
          <ReviewStep
            detecting={detecting}
            autoGroups={autoGroups}
            autoCount={autoCount}
            reviewGroups={reviewGroups}
            onReverse={(groupKey) => dispatch({ type: 'reverseAuto', groupKey })}
            onDecide={(groupKey, decision) => dispatch({ type: 'decide', groupKey, decision })}
            onContinue={() => setGateOpen(true)}
          />
        )}
      </div>

      {gateOpen && (
        <ExportGate text={text} spans={state.spans} mode={mode} onClose={() => setGateOpen(false)} />
      )}
    </main>
  );
}

/** Steps 4 + 5 — auto-handled disclosure and the human review lane, plus the gate entry point. */
function ReviewStep({
  detecting,
  autoGroups,
  autoCount,
  reviewGroups,
  onReverse,
  onDecide,
  onContinue,
}: {
  detecting: boolean;
  autoGroups: ReturnType<typeof selectAutoGroups>;
  autoCount: number;
  reviewGroups: ReturnType<typeof selectReviewGroups>;
  onReverse: (groupKey: string) => void;
  onDecide: (groupKey: string, decision: 'hide' | 'keep') => void;
  onContinue: () => void;
}) {
  if (detecting) {
    return (
      <p className="rounded-lg bg-white px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        Running detection — auto-handling the obvious, isolating the ambiguous…
      </p>
    );
  }

  const undecided = reviewGroups.filter((g) => g.decision === 'undecided').length;

  return (
    <div className="space-y-6">
      {reviewGroups.length === 0 && autoCount === 0 && (
        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          Nothing was flagged in this document. You can still preview exactly what ships before you
          export.
        </p>
      )}

      <AutoTray groups={autoGroups} count={autoCount} onReverse={onReverse} />
      <ReviewLane groups={reviewGroups} onDecide={onDecide} />

      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">
          {undecided === 0
            ? 'All review decisions made. Preview the result before exporting.'
            : `${undecided} item${undecided === 1 ? '' : 's'} still undecided — you can preview now or decide first.`}
        </p>
        <button
          onClick={onContinue}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Preview &amp; export →
        </button>
      </div>
    </div>
  );
}
