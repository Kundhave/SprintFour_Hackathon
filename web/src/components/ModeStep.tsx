import type { ExportMode } from '../store/types';

/**
 * Step 2 — Choose output mode (Presentation only). Exactly two choices, each with a tiny worked
 * example so the consequence is obvious before the pipeline runs. The chosen mode drives how the
 * export is rendered later; it does NOT change what the router decides to remove.
 */
export function ModeStep({ onChoose }: { onChoose: (mode: ExportMode) => void }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          How should sensitive content be handled?
        </h2>
        <p className="mt-1 text-sm text-slate-600">Pick the output you want. You can start over anytime.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          title="Anonymize"
          blurb="Replace sensitive entities with semantic labels. Best when the document still needs to be read or summarized."
          onClick={() => onChoose('anonymize')}
        >
          <Example from="John Smith" to="[NAME]" />
          <Example from="john@email.com" to="[EMAIL]" />
          <Example from="9876543210" to="[PHONE]" />
        </ModeCard>

        <ModeCard
          title="True redaction"
          blurb="Black out sensitive content, legal-document style. The text is genuinely removed — not hidden under a box."
          onClick={() => onChoose('redact')}
        >
          <Example from="John Smith" to="██████████" />
          <Example from="john@email.com" to="██████████████" />
          <Example from="9876543210" to="██████████" />
        </ModeCard>
      </div>
    </section>
  );
}

function ModeCard({
  title,
  blurb,
  children,
  onClick,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-2xl bg-white p-5 text-left ring-1 ring-slate-200 transition hover:ring-slate-900"
    >
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{blurb}</p>
      <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
        {children}
      </div>
      <span className="mt-4 text-sm font-medium text-slate-400 group-hover:text-slate-900">
        Choose this →
      </span>
    </button>
  );
}

function Example({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{from}</span>
      <span className="text-slate-300">→</span>
      <span className="font-medium text-slate-900">{to}</span>
    </div>
  );
}
