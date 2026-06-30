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

---

## What we deliberately did NOT build (and why) — writeup core
- **Batch / volume tooling** — that's Problem 2; spreading effort would weaken the depth that matters.
- **Entity resolution** — exact-match captures most of the value without the failure surface.
- **OCR / sliding window / standalone NER** — no failure class in our inputs / no cost force; cutting
  them *is* the judgment.
- **Auth, persistence, multi-user, cloud** — out of scope for a single-user local review session.
