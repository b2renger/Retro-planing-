# Scoping: on-device inference for triage

Status: **tier 0 is built and wired; tiers 1–3 remain scoping only.** Written 2026-09-21 after
b2renger raised [Laya](https://github.com/NandhaKishorM/laya) and asked whether a Python sidecar is
really the only way. It is not, and it is probably the worst of the options here.

> **Tier 0 shipped 2026-09-21.** Date detection lives in `src/services/insight/` and the
> "Dates found" panel in the Markdown Studio shows it. `chrono-node` 2.10.1, French and English,
> 71 tests, +21.8 kB gzip in the main chunk — no model, no download, no network. Details in the
> tier-0 section below.

## What we would actually want it for

Not chat, and not plan generation — those need text generation and already work through the AI
provider layer. What is missing is **typed decisions over the project's own text**, the kind of thing
that is annoying to do by hand and never worth an API round trip:

- Score each task's risk from its description, estimate and dependencies.
- Classify an imported note into an existing phase.
- Flag documents that mention a hard deadline, a fixed venue date, or an external dependency.
- Detect which tasks a brief implies but the plan is missing.

These share a shape: a small number of typed answers per item, over short text, and they should be
instant, free, and work with no account. That last part is the point — a designer opening the app for
the first time gets something useful before configuring anything.

## The options, cheapest first

### 0. No model at all — **BUILT**
Regex and date parsing for deadline detection; keyword and TF-IDF similarity against phase names for
classification; the existing `computeProjectHealth` plus dependency depth for risk.

Costs nothing, ships today, works in every build including the web one, and no download. It will be
wrong sometimes, and it cannot tell that "the venue is only ours until the 20th" is a hard deadline
without the word "deadline" in it.

**Honest assessment: this covers most of the value and should be built first regardless.** It is also
the fallback the other tiers degrade to.

**What was built (2026-09-21).** The deadline half only; phase classification and risk scoring are
still ahead.

| File | Role |
|---|---|
| `src/services/insight/dates.ts` | `findDates(text, { referenceDate, locale })` → `DetectedDate[]`: iso day, matched text, the sentence it came from, an offset, a confidence, a kind (`deadline` / `milestone` / `mention`), the signals that fired, plus range and time flags. |
| `src/services/insight/signals.ts` | `SIGNALS`, the documented French/English commitment vocabulary, matched case- and accent-insensitively. A new studio word is a new row, not new logic. |
| `src/services/insight/text.ts` | Which parts of a markdown document are prose and which are machinery, and the sentence-around-a-match extraction. |
| `src/services/insight/suggestions.ts` | `suggestFromDocument(doc, project, { today, dates })` → `Suggestion[]`. Pure; `apply` is a serialisable description of the action, never a closure, so nothing can run by accident. |
| `src/services/insight/index.ts` | The boundary the design note asks for: `findDeadlines(doc)` → `{ items, source: 'heuristic' }`. A later tier answers here. |
| `src/components/markdown/DatesPanel.tsx` | The "Dates found" panel beside the document. |

Decisions worth knowing before touching it:

- **Both parsers, merged.** Picking one locale by stopword count loses half a mixed document, and
  mixed is what these users write. The winning parser's hits are kept whole; the loser may only
  contribute dates it is certain of, or it reads the other language's prose as weekday abbreviations.
- **Casual parsing plus a strict rescue.** `chrono.en.casual` reads "Opening night on November 20,
  2026" as one anchorless blob starting at "night" and loses the date; anything casual returns with
  no certain date component is re-parsed strictly over the same span.
- **Durations are not dates.** "warm up for 20 minutes" parses as a date in casual mode. A match
  naming only a sub-day unit, with no calendar word and no year, is discarded.
- **Nothing is dropped silently that a user could expect to see.** Code fences, inline code and
  frontmatter are skipped outright; link targets, unanchored relative expressions and implausible
  years are kept, downranked, and flagged in `signals` so the panel can say why it distrusts them.
- **Suggestions are never applied on their own**, and both actions push an undo snapshot first
  (`pushUndoSnapshot` on the facade) so an accepted suggestion can always be taken back.

### 1. Embeddings in JavaScript — the recommended first real model
[`transformers.js`](https://github.com/huggingface/transformers.js) runs ONNX models directly in the
renderer through WebAssembly, with WebGPU where available. No Python, no sidecar, no native module.

Approach: embed each task, note and phase label with a small sentence model such as
`all-MiniLM-L6-v2` (roughly 23 MB quantised), then use cosine similarity. That gives classification
into phases, near-duplicate detection, and "which brief paragraph does this task come from" almost for
free, and it is genuinely good at the semantic cases that keywords miss.

- **Works in the web build too**, which no sidecar option does.
- Model downloads once and caches; we would ship it as an artifact rather than hitting the network.
- Embeddings do not give calibrated yes/no answers. For those, either a threshold on similarity to
  a phrase like "this has a fixed external deadline", or tier 2.

### 2. A small classifier over ONNX Runtime
Same runtime, a task-specific model instead of embeddings: zero-shot NLI (`nli-deberta-v3-small`) or
a model we fine-tune on our own labels. Gives real typed decisions with probabilities.

Heavier (50–150 MB), slower per item, and worth it only once tier 1 proves the feature is used.

**Where Laya fits:** this is its tier. Its primitives — choice, score, binary probability — are
exactly the shape described above, and that is a real match. The blocker is that it ships as a Python
library on PyTorch and Transformers. It would only be usable here if its checkpoints export to ONNX,
which the README does not say and which needs checking before anything else about it matters. If they
do, it becomes a tier-2 candidate with no Python at all. If they do not, it means bundling a Python
runtime and multiple gigabytes of torch into a 120 MB app, for one feature, on desktop only. That is
not worth it.

### 3. A Rust sidecar via napi-rs
The pattern artlux already uses for its native engines, so the tooling is familiar. [Candle](https://github.com/huggingface/candle)
runs small transformer models natively with no Python.

Faster than WASM and fully offline, but it is a per-platform native build for each of the three
targets, and it cannot serve the web build. Only worth it if tier 1 proves too slow, which for a few
hundred tasks it will not be.

### 4. A full local LLM
Already solved and already shipped: point the app at a LlmOnLan farm, or at Ollama or LM Studio on
localhost, through the OpenAI-compatible adapter. Zero new code.

b2renger's own objection stands, and it is the right one: a model large enough to be useful does not
run on a design student's laptop. That is exactly why this feature should not be an LLM.

## Recommendation

**Done for dates; still open for classification and risk.** Build tier 0 as ordinary product code
with no model and no download. Instrument whether anyone
uses the resulting suggestions. If they do, add tier 1 behind the same interface so the upgrade is
invisible to the rest of the app.

Design note for whoever builds it: put the whole thing behind one interface —
`suggestPhase(text)`, `scoreRisk(task)`, `findDeadlines(doc)` — returning results with a confidence
and a `source` of `'heuristic' | 'embedding' | 'model'`. Then every tier is a swap behind that
boundary, the web build can run a subset, and the UI can be honest about where a suggestion came from.
Every suggestion must be a suggestion: shown, explainable, and accepted by the user, never applied
silently. The audit of the original app found the opposite pattern everywhere, and it is what made it
untrustworthy.

## Before acting on any of this, check

1. Do Laya's checkpoints export to ONNX? That single fact decides whether it is a candidate or not.
2. Does `all-MiniLM-L6-v2` under `transformers.js` classify our own sample project's tasks into the
   right phases? A one-afternoon spike answers it.
3. Would the bundle cost be acceptable in the web build, or should tier 1 be desktop-only with the web
   build staying on tier 0?

---

## On JAX, and why the framework is the wrong question

Asked whether JAX would help. It would not, for the same reason PyTorch does not: JAX is a Python
library. Swapping one Python numerical framework for another leaves the actual constraint untouched —
**this app is TypeScript running in a renderer on a machine with no Python installed, and no right to
demand one.**

The question that matters is not what trained the model but what format it ships in, because that is
what decides whether a JavaScript runtime can load it:

| Format | Runs in our app via | Notes |
|---|---|---|
| **ONNX** | `@huggingface/transformers`, `onnxruntime-web` | WASM everywhere, WebGPU where available. Works in the web build too. |
| **GGUF** | `node-llama-cpp` | Native, desktop only, aimed at generative LLMs. |
| **TF.js** | `@tensorflow/tfjs` | Viable, smaller model selection these days. |
| PyTorch `.pt`, JAX/Flax | nothing in JS | Needs Python, which is the thing we are avoiding. |

JAX is relevant only upstream: a JAX model can be exported through StableHLO and converted to ONNX or
TFLite. If we ever *train* something ourselves, JAX is a fine choice — but what we ship is the export,
not the framework.

## Verified stack (checked 2026-09-21, versions and models confirmed to exist)

| Piece | Package / model | Why |
|---|---|---|
| Runtime | `@huggingface/transformers` 4.3.0 | The maintained successor to `@xenova/transformers`. ONNX in the renderer, no server, no Python. |
| Low-level alternative | `onnxruntime-web` 1.30.0 | If we want a hand-rolled pipeline instead of the transformers API. |
| Multilingual embeddings | `Xenova/multilingual-e5-small` or `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | Phase classification, duplicate detection, brief-to-task tracing. |
| Typed yes/no with a probability | `Xenova/nli-deberta-v3-xsmall` | Zero-shot classification. **This is the closest match to what Laya offers**, in a format we can actually load. |
| Dates in prose, no model at all | `chrono-node` 2.10.1 | Natural language date parsing, French included. |

### The language point, which nearly got missed

This project's own content is French: "Rétroplanning", "Vernissage", the sample brief. An
English-only model would quietly underperform on exactly the documents these users write. Both
embedding models above are multilingual, and `chrono-node` parses French dates. Any English-only
choice — including Laya's default English checkpoint — would need its multilingual variant instead.

### Consequence for deadline detection

`chrono-node` handles it with **no model whatsoever**: parse the dates out of a document, then apply
rules for proximity to words like *deadline*, *livraison*, *vernissage*, *opening*. That is tier 0
done properly, it works identically in the web build, it adds roughly 50 kB rather than 25 MB, and it
is explainable — you can show the user the sentence the date came from. Build this one first; it may
be the only tier that ever ships.

**Measured, now that it is built:** importing only `chrono-node/fr` and `chrono-node/en` (the root
entry pulls in all fourteen locales) the whole feature — parser, rules, panel — costs 69.9 kB raw
and **21.8 kB gzip** in the main chunk, 199.23 → 221.06 kB. Well under the 60 kB gzip line at which
it would have had to be split out like the export module, so it is a plain static import.

### Where this leaves Laya

Its primitives are still the right shape, and it was a good pointer at the problem. But
`nli-deberta-v3-xsmall` gives the same kind of answer in a format that loads in JavaScript today, with
no Python, no sidecar, and support for the web build. Unless Laya's checkpoints turn out to export to
ONNX cleanly, the ONNX route wins on delivery and the comparison is not close.
