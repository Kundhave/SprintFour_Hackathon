# DECISIONS.md — Architecture & Tradeoff Log

> Every significant decision, with what we gained, what we gave up, and why it's right for *this*
> project under *these* constraints (8 hours, solo, local-first, minimize false negatives,
> demonstrate engineering judgment). This file is the source material for the half-page writeup.

---

## D1 — Chose Problem 3 (Sam: fixing the tool's mistakes)
**Why:** deepest and most interlocking tradeoff surface — the asymmetric cost of false negatives vs.
false positives, plus the paradox of helping a tool catch the PII *it itself* missed. Nearly pure
reasoning, low code volume, highest "I hadn't thought of it that way" potential for judges.
**Gave up:** the more visible backend architecture of Problem 2 (volume). Accepted, because depth of
reasoning beats surface area of infrastructure on this rubric.

## D2 — The bet: less to review, not louder warnings
**Why:** the prompt defines Sam's failure as "the mistakes he does not stop to look at." A salient
warning still requires him to look, so it fails on the problem's own terms. Automation-bias research
agrees: users skim the warnings too. The only solution that survives a literally-careless user is to
remove the busywork so the few real decisions get the attention it was stealing.

## D3 — Two detectors by comparative advantage, NOT primary/backup
**Why:** "primary/secondary" implies a hierarchy; the truth is the two detectors **partition the
problem by the kind of reasoning each needs**. Deterministic (regex) owns structured PII where a
rule is near-certain and a model is probabilistic-and-worse. Semantic (LLM) owns contextual PII a
rule can't see. Independent failure modes = defense in depth.
**Gain:** a clean, defensible engineering narrative; a miss by one is likelier caught by the other.
**Lose:** minor orchestration. **Right because** each technique is strong exactly where the other is weak.

## D4 — Local LLM (Ollama / Gemma 3n e4b — `gemma3n:e4b`), not a cloud API
**Why:** the product exists *because* data shouldn't leave the machine. A cloud LLM would enact the
exact harm the product prevents.
**Gain:** privacy fidelity, deterministic offline demo, no keys / rate limits / latency surprises,
develops offline. **Lose:** some raw extraction quality vs. a frontier model — but those misses
become the *disagreement* the router routes to Sam, so the design absorbs the loss instead of leaking
it. **Sufficient because** the semantic task is narrow (return strings, we locate offsets ourselves).

## D5 — The invariant: auto-redact in the safe direction, never auto-expose
**Why:** redaction errors are recoverable; exposure errors are irreversible once shared. The system's
automation is therefore deliberately *asymmetric* — aggressive toward hiding, never toward exposing.
This is the spine of Safety and the line an interviewer will push hardest on; we own it.

## D6 — Exact-match string grouping, NOT entity resolution
**Why:** Sam thinks in people, not spans; making him clear "John Smith" nine times manufactures
fatigue. But full coreference ("J. Smith" ↔ "John Smith") is an NLP project with its own review
burden. **Gain:** ~80% of the cognitive-load win for ~5% of the complexity, no new failure mode.
**Lose:** name variants treated separately — a *stated, deliberate boundary*, not an oversight.

## D7 — Auto-decisions disclosed in a collapsed tray, not applied silently
**Why:** silent automation recreates the black-box distrust that worries the skeptical user; but
forcing review of auto-items rebuilds fatigue. **Resolution:** auditable on demand, invisible by
default. Transparency without mandatory attention.

## D8 — Export gate with a count is the last line of defense
**Why:** Safety's real root is irreversibility, so the moment *before* the irreversible act gets the
most design weight — more than the router. The gate previews the document exactly as the downstream
AI will receive it, with a **count** ("3 items will remain visible…") because a number creates felt
accountability that a passive preview doesn't. **Preview and real export share one code path**, so
what Sam sees is provably what ships.

## D9 — Output integrity: PII removed from bytes, never covered
**Why:** Marcus's literal fear (Problem 1) — "redacted" documents where the data is still underneath.
For a privacy company, an export that *looks* clean but isn't is close to disqualifying. Asserted by
a test: for any redacted span, the raw PII does not appear in the exported bytes.

## D10 — Cut sliding window
**Capability it provides:** boundary-safe coverage of long inputs (entities split across chunks).
**Why cut:** our inputs fit in model context → there is no failure class for it to catch → including
it would be complexity solving a problem our inputs don't pose.

## D11 — Cut OCR (deferred, named as the top real-world gap)
**Capability:** pixels → text, so image documents aren't silently invisible to every text layer.
**Why cut:** no image inputs in scope. **Why named anyway:** the biggest real-world miss source is
PII trapped in scans; saying so (and sketching a vision pass) demonstrates we see the whole problem
while respecting our constraints.

## D12 — Absorbed standalone NER into the LLM
**Capability:** cheap generalization to unseen entities. **Why it exists in enterprise:** the LLM is
too expensive to run on everything, so a cheap NER stage does the bulk and the LLM handles residue.
**Why cut for us:** we run one local LLM on one small document once — that cost force doesn't apply,
and a second model adds setup time and a merge problem for a capability the LLM already provides
better. Layer consolidation driven by *our* constraints, not by copying.

## D13 — Reconciler/Router is the architectural center, not the detectors
**Why:** Conseal's pipeline maximizes recall and unions everything. Our differentiator is the layer
*after* detection — routing by comparative advantage, using disagreement as a first-class signal,
and preserving document utility (the doc is meant for a downstream AI, so over-redaction has a cost).
The detectors are the means; the router is the point.

## D14 — Stack: TypeScript / React + Vite / Express / Vitest / Zod / Tailwind — all local & free
**Why:** one language front-to-back; types enforce the `Span` model (serves the clean-architecture
rubric line); fast for a solo build; no paid services. **No Redux** — over-engineering at this size
and a misjudgment signal to these judges; a `useReducer` over the single span store is enough.

## D15 — No cloud deployment; `npm run dev` is the run story
**Why:** local-first means the app needs no network at demo time — a *feature*, not a gap. Removes an
on-stage failure mode and reinforces the privacy premise. The README documents the one command.

## D16 — The export gate's count sentence is domain-computed and rides the ONE code path
**Why:** D8 promises the preview is provably what ships, so the gate must not re-derive anything the
real export doesn't also carry. The count sentence ("3 items will remain visible: a name you kept,
and 2 things nothing flagged") is therefore computed inside `buildExport` and returned as
`ExportResult.summary` — the same field `/api/export` and the preview both read. The UI only renders
it (no presentation logic; CLAUDE.md §5), and the phrasing is asserted by tests rather than written
by hand in a component.
**Gain:** the number Sam reads is the same number on the bytes that leave; the felt-accountability
wording is unit-tested. **Lose:** a string field on the result other callers ignore — trivial.
**Why right:** the gate is Safety's last line (D8), so its honesty must be structural, not by
convention. Grouping the count by *why* each item is still visible (undecided → reversed → kept →
nothing-flagged) is the part that protects the overtrusting reader: it separates "you chose this"
from "nothing ever flagged this," which is exactly the blind spot the whole product targets.

## D17 — Every state routes THROUGH the gate, including empty and no-PII
**Why:** the prompt is explicit — "no-PII-found (still route through the gate — that's when an
overtrusting user most needs the preview)." The old export button was disabled with zero spans,
which would have skipped the gate precisely in the most dangerous case (a reviewer trusting an empty
result). The button now opens the gate as soon as detection has *loaded*, regardless of span count;
the gate renders calm, explicit copy for empty document, nothing-flagged, all/mostly-redacted, and
overlap-collapsed states. **Why right:** the gate's value is consequence-preview, not error-display;
removing it when there's "nothing to show" removes it exactly when blind trust is highest.

## D18 — Real PDF upload, text-based only; scanned PDFs are named, not silently dropped
**Why:** the product had to graduate from a fixed fixture to a real document. Upload extracts text
server-side (`documents/extractText.ts`) and the client holds the text in memory — no store, no
persistence, no auth (CLAUDE.md §11/§12). We support text PDFs only and **detect** the no-selectable-
text case (scanned/image PDFs), returning a clear "OCR not supported yet" message rather than an
empty document. **Why right:** this is exactly D11 made visible — OCR is the deliberately-cut
failure class, so the honest move is to name it at the moment a user hits it, not fail silently.

## D19 — Output mode (anonymize vs redact) is a pure REPRESENTATION choice in the domain
**Why:** the two modes change only how a removed span is *rendered* — a `[TYPE]` label or a black
box — never *which* spans are removed. So `buildExport` gained a `mode` and now emits a render-
agnostic `segments` model; the router and the never-auto-expose invariant are untouched. Mode lives
in the one code path, so preview and export agree by construction (D8). **Gave up:** nothing in the
routing philosophy. **Why right:** keeping mode out of detection/routing preserves the architecture's
center (D13) and keeps the safety logic in exactly one place.

## D20 — PDF rendering is an I/O adapter, not domain logic; integrity proven by re-extraction
**Why:** drawing a PDF is I/O, so `documents/renderPdf.ts` sits at the edge beside the detectors,
consuming the domain's pure `segments`. Crucially, a redacted segment carries only `{type, length}`
— never the original bytes — so raw PII *cannot* reach any renderer. For redact mode the PII text is
never drawn at all; a real black rectangle is, so the export is genuinely processed content, not a
CSS overlay (D9). The integrity test renders a PDF and **reads it back** to assert the raw PII is
absent from the actual exported bytes — the strongest form of the D9 guarantee.
**Dependencies added:** `pdf-parse` (extraction) and `pdf-lib` (generation) — both local, no network,
preserving the local-first mandate (CLAUDE.md §11).



---

## What we deliberately did NOT build (and why) — writeup core
- **Batch / volume tooling** — that's Problem 2; spreading effort would weaken the depth that matters.
- **Entity resolution** — exact-match captures most of the value without the failure surface.
- **OCR / sliding window / standalone NER** — no failure class in our inputs / no cost force; cutting
  them *is* the judgment.
- **Auth, persistence, multi-user, cloud** — out of scope for a single-user local review session.
