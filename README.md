# Conseal Review

**A correction experience for redaction review — built for the reviewer who's moving too fast to catch the tool's mistakes.**

Conseal Review is a full-stack, **fully local** app that helps someone reviewing a redaction tool's
suggestions catch what matters. It is built for *Sam*: a fast, overtrusting reviewer who skims and
trusts the tool a little too much — so the mistakes that slip through are the ones he never stops to
look at. Instead of asking Sam to review everything (which manufactures the fatigue that hides those
mistakes), Conseal Review **does the catchable work for him and spends his attention only on the few
calls a machine genuinely can't make.**

---

## The problem

A redaction tool's suggestions contain two very different kinds of error:

- **False positives** — harmless text it hid. Annoying, but *reversible* at any time.
- **False negatives** — sensitive text it left visible (a phone number, a name). **Catastrophic and
  irreversible** the moment the document is shared — and, by definition, *nothing flags them*, so a
  reviewer skimming the suggestions never stops to look.

These errors are not symmetric, so treating them with one undifferentiated "review everything" list —
the obvious design — fails. It buries the catastrophic error and exhausts the reviewer on the trivial
one.

## The solution

**The core idea: help a careless reviewer with *less to review*, not louder warnings.** Confirmation
fatigue is manufactured by asking people to confirm things that never needed confirming. Remove those,
and the few decisions that truly need a human get the attention the busywork was stealing.

Conseal Review routes every candidate by **comparative advantage** — to whoever should actually decide it:

- **Unambiguous, structured PII** (phone, email, SSN…) → **auto-redacted**, no human action needed.
  *This is where the phone number the original tool missed gets caught — automatically, with
  certainty — because no human should have to be the safety net for a visible phone number.* Every
  auto-decision is disclosed in a collapsed, auditable tray (transparent on demand, invisible by default).
- **Genuinely ambiguous** items (a name that's sensitive in one context but not another; cases where
  the two detectors disagree) → **the human review lane**, the *only* thing Sam is asked to look at,
  keyboard-driven, with identical strings grouped into one decision.
- **Clearly harmless** text → **left visible**, never surfaced — no attention spent on non-decisions.

At the one irreversible moment — **export** — a consequence preview shows the document exactly as the
downstream AI will receive it, with a count of anything still visible ("3 items will remain visible…").
The redacted PII is **genuinely removed** from the exported file, never just visually covered.

**One inviolable rule:** the system auto-*redacts* freely (a wrong redaction is reversible) but
**never auto-*exposes*** anything (a wrong exposure isn't). Un-hiding is always a human act.

## How it works (architecture)

Three clean layers, with the thinking concentrated in a pure, well-tested domain core:

```
Presentation (React)   →  upload · output mode · review lane · auto-handled tray · preview/export gate
                          (renders state; contains no logic)

Domain (pure, tested)  →  router · reconciler · grouper · exportBuilder (mode-aware segments)
                          (this is the product; this is where the tests live)

Detection / Documents  →  Deterministic detector (regex + small name list)
                          Semantic detector (local LLM via Ollama)
                          Mock detector (same interface; tests + demo fallback)
                          PDF text extraction + PDF rendering (I/O adapters at the edge)
```

**Two detectors, by comparative advantage — not primary and backup.** The deterministic detector
owns *structured* PII, where a rule is near-certain and a model would only guess. The semantic
detector owns *contextual* PII a rule can't see. Their independent failure modes are the defense in
depth; their **disagreement** is the signal that a span needs a human. A **reconciler + router**
(pure functions) merges them and routes each span. Everything the UI shows is derived from a single
span store, so undo is free and the export preview is provably identical to the real export.

## Privacy: fully local

The whole point of redaction is that data doesn't leave your machine — so it doesn't here. The
semantic detector runs on a **local LLM via [Ollama](https://ollama.com)**; there are **no cloud
APIs, no paid services, and no network dependency** at any point, including the demo. Cloud was
permitted for this hackathon; we chose local because shipping a sensitive document to a cloud API
would contradict the exact value proposition the product exists to defend.

## Run it locally

**Prerequisites:** Node 20+, and [Ollama](https://ollama.com) with a model pulled:

```bash
ollama pull gemma3n:e4b      # or: ollama pull llama3.2:3b  (lighter, if RAM is tight)
```

**Start (one command runs both frontend and backend):**

```bash
npm install
npm run dev
```

Then open the printed local URL and walk the workflow: **upload a text-based PDF** (or click "Try
the sample document"), **choose an output mode** (anonymize or true redaction), let the pipeline
auto-handle the obvious structured PII, **review only the ambiguous items**, then **preview and
export** the processed PDF — what you preview is exactly what ships.

> No internet connection is required. If the local model is unavailable on your machine, the app
> still runs end to end: Layer 1 (deterministic) catches structured PII, and the sample document
> falls back to a built-in **mock detector** for its contextual review lane.

## Tech stack

TypeScript end-to-end · React + Vite + Tailwind (frontend) · Express (backend) · Ollama (local LLM) ·
Zod (validation) · Vitest (tests). All free, all local.

## What we deliberately did NOT build (and why)

Prioritization is the clearest signal of how we think, so the omissions are intentional:

- **Batch / high-volume tooling** — that's a different user's problem (Problem 2). Going deep on one
  reviewer's trust beats spreading thin.
- **Entity resolution** (linking "J. Smith" ↔ "John Smith") — exact-match grouping captures most of the
  cognitive-load benefit without the failure surface of coreference.
- **OCR and sliding-window chunking** — these catch failure classes (image documents, long-doc entity
  splits) that **don't exist in this product's inputs**. The biggest real-world gap is OCR for scanned
  documents; in production we'd add it first as a vision pass.
- **A separate NER stage** — it exists in enterprise pipelines to be the *cheap* bulk worker so the LLM
  runs only on the residue; with one local LLM on one small document, that cost pressure doesn't apply,
  so the LLM absorbs that role.
- **Auth, persistence, multi-user, cloud deployment** — out of scope for a single-user local review session.

See `DECISIONS.md` for the full reasoning behind every choice above.
