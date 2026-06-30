# CLAUDE.md — Conseal Review

> Durable project memory. Read this fully before any task. Every milestone prompt is lean
> because the architecture and principles live here. If a request conflicts with this file,
> this file wins — flag the conflict instead of silently diverging.

---

## 1. What we're building (the solution in one paragraph)

Conseal Review is the **correction experience** for someone reviewing a redaction tool's
suggestions — modeled on "Sam": a fast, overtrusting reviewer who skims and trusts the tool too
much, so the mistakes that slip through are the ones he never stops to look at. Instead of asking
Sam to review every suggested redaction (which manufactures the very fatigue that hides the
misses), the system **takes the catchable mistakes off him entirely** and spends his attention only
on the few calls a machine genuinely can't make. It auto-fixes the unambiguous, routes the
genuinely ambiguous to Sam, leaves the clearly-harmless alone, and — at the one irreversible
moment — shows him exactly what is about to leave his machine.

## 2. The bet (north star)

**The way to help a careless reviewer is *less to review*, not louder warnings.** Confirmation
fatigue is manufactured by asking humans to confirm things that never needed confirming. Remove
those, and the residue is small enough to actually think about. If a change adds features or noise
without serving this bet, it is wrong.

## 3. Three pillars — NOT co-equal; Safety dominates

1. **SAFETY — minimize *irreversible* exposure.** (The root of the asymmetry is irreversibility:
   a missed PII is irreversible once the document is shared; a false positive is reversible anytime.)
   - *Decision safety:* when unsure, hide and ask; **never auto-expose**; context-dependent types
     **always** go to the human.
   - *Output integrity:* redacted PII is genuinely **removed** from the export, never just covered.
     The export gate is the last and most important line of defense.
2. **EFFICIENCY — operates only within Safety.** Spend human attention only where it changes the
   answer. Classify and route by comparative advantage. Never buy efficiency by leaving more
   visible-and-unreviewed.
3. **CALIBRATED TRUST — earned by behavior, not explanation.** Trust comes from what the system
   does and refuses to do (never auto-expose; preview consequences before the irreversible act),
   not from streams of justification. Explanation is **on-demand, never pushed**. Goal: Sam's trust
   should *match* the tool's reliability — skeptical where it should be.

**Conflict-resolution rule:** when pillars collide, Safety wins, then Efficiency, then Trust.
Ask first "does this risk irreversible exposure?" — only if no do the others get a vote.

## 4. THE INVARIANT (never violated)

**Auto-REDACT freely in the safe direction. NEVER auto-EXPOSE.** Un-hiding is always a human act.
Never auto-redact a context-dependent semantic span — it goes to the human instead.

## 5. Architecture — three layers

```
Presentation (React)  — derives ALL views from one span store. NO logic here.
        │
Domain (pure, I/O-free) — THIS IS THE PRODUCT. Tests live here.
   router · reconciler · grouper · exportBuilder
        │
Detection — two detectors behind one interface, plus a Mock.
```

- **Presentation:** review lane, auto-handled tray, export gate. Renders state; decides nothing.
- **Domain (pure functions, no I/O):**
  - `router` — classify each span by **detector-type × PII-category** into auto / review / visible.
  - `reconciler` — merge the two detectors' spans; resolve overlaps (longer / higher-severity wins).
  - `grouper` — **exact-match string grouping only. NO entity resolution.**
  - `exportBuilder` — produce genuinely clean output; **preview and real export share ONE code path**.
- **Detection:** behind `detect(text) -> Span[]`. Swappable. A Mock implements the same interface
  for deterministic tests and demo-day fallback.

## 6. Detection pipeline — two detectors (and what we deliberately cut)

Conseal (the enterprise product) uses ~6 layers (regex, dictionary, NER, sliding window, OCR, LLM).
Each enterprise layer exists to catch a failure *class* in an adversarial, multi-format, high-volume
input distribution. **We kept the layers whose failure class exists in our inputs and cut the rest —
on purpose. That is the engineering-judgment story, not a shortcut.**

**KEPT — Layer 1: Deterministic detector (regex + small name list).**
Capability: *certainty on structured PII* (phone, email, SSN, etc.) where a model's probabilistic
answer is strictly worse than a rule's deterministic one. This catches the planted phone number the
original tool missed — with certainty, not a guess. Absorbs Conseal's regex + the useful core of
its dictionary lookup. Runs first, independent, free.

**KEPT — Layer 2: Semantic detector (local LLM, narrow contract).**
Capability: *contextual reasoning about sensitivity* — names/orgs/addresses and whether they're
identifying *here*. Provides NER's generalization AND context reasoning in one local model. Runs
independently on the same text; does NOT depend on Layer 1. Absorbs Conseal's NER + LLM —
consolidated because we have no enterprise cost pressure forcing a separate cheap NER stage.

**KEPT — Layer 3: Reconciler + Router (pure domain logic).**
Capability: *the product*. Merges the two detections, resolves overlaps, and routes by comparative
advantage. Uses **agreement** as a safe-to-automate signal and **disagreement** as a route-to-human
signal. The never-auto-expose invariant lives here. Must run last.

**CUT — sliding window:** solves long-document chunking/boundary-split entities. Our inputs fit in
context → no failure class to catch → omitted deliberately.
**CUT — OCR:** turns pixels into text for image inputs. We have no image inputs → omitted, and
named in the writeup as the top real-world gap we'd add first (a vision pass).
**CUT — standalone NER:** exists in enterprise to be the *cheap* bulk worker so the LLM runs only on
residue. We run one local LLM on one small doc once → that cost force doesn't apply → LLM absorbs it.
**SHRUNK — dictionary:** full customer-dictionary machinery → a small name list inside Layer 1.

## 7. Router rules (priority order)

1. Deterministic match on a structured type → **AUTO-REDACT** (disclose in tray).
2. Detectors disagree → **HUMAN REVIEW**.
3. Context-dependent type (name / address / org / date) → **HUMAN REVIEW**, regardless of confidence.
4. Mid-confidence → **HUMAN REVIEW**.
5. Agreed harmless / very low confidence → **LEAVE VISIBLE**, don't surface.

Bias: borderline cases route **toward** the human (over-asking costs seconds; under-asking risks the
catastrophic miss). Never auto-redact a context-dependent span.

## 8. Domain model — define ONCE, import everywhere

```ts
type Span = {
  id: string;
  start: number;            // located deterministically in our code, never trusted from the LLM
  end: number;
  text: string;
  type: 'PHONE' | 'EMAIL' | 'SSN' | 'NAME' | 'ADDRESS' | 'ORG' | 'DATE' | string;
  source: 'deterministic' | 'semantic' | 'user';
  confidence: number;
  status: 'suggested' | 'auto_redacted' | 'kept_visible' | 'hidden_by_user' | 'user_added';
  routedTo: 'auto' | 'review' | 'visible';
  reason: string;           // human-readable: why it's here ("detectors disagree", "name — contextual")
  groupKey: string;         // exact-match string → links identical occurrences
};
```

## 9. Semantic detector contract (local LLM via Ollama)

- Return **ONLY semantic PII** (names, orgs, addresses, contextual ids) as JSON **strings + type +
  confidence**. **Never offsets** — the LLM miscounts; we locate strings in the source ourselves.
- Validate output with Zod. On malformed output: **retry once, then return empty** (Layer 1 still
  functions). The pipeline must never crash on bad model output.

## 10. Conventions

TypeScript strict. Single `Span` definition. Domain pure and tested via the Mock (never against the
live LLM — that's nondeterministic). Views derive from one span store. Status transitions reversible
(undo is a status toggle). Clear names a stranger understands. Every edge state handled calmly.

## 11. LOCAL-FIRST mandate

Nothing leaves the machine. No cloud APIs, no paid services, no network dependency at demo time.
This is the product's premise, so the architecture must embody it.

## 12. WON'T BUILD (delete if AI adds these)

auth · database / persistence (in-memory session only) · multi-user · batch / volume (that's
Problem 2) · entity resolution (exact-match only) · cloud deploy · sliding window · OCR · standalone
NER · a state library (useReducer is enough).

## 13. Definition of Done

Domain-layer logic (not in components) · clear names · invariant holds · export-integrity test
passes (raw PII absent from exported bytes) · errors handled (malformed LLM, empty, no-PII, overlaps)
· domain tested via the Mock · reversible · tradeoff logged in DECISIONS.md · `npm run dev` works ·
committed.
