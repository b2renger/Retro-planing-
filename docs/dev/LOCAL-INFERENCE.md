# Scoping: on-device inference for triage

Status: **scoping only, nothing built.** Written 2026-09-21 after b2renger raised
[Laya](https://github.com/NandhaKishorM/laya) and asked whether a Python sidecar is really the
only way. It is not, and it is probably the worst of the options here.

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

### 0. No model at all
Regex and date parsing for deadline detection; keyword and TF-IDF similarity against phase names for
classification; the existing `computeProjectHealth` plus dependency depth for risk.

Costs nothing, ships today, works in every build including the web one, and no download. It will be
wrong sometimes, and it cannot tell that "the venue is only ours until the 20th" is a hard deadline
without the word "deadline" in it.

**Honest assessment: this covers most of the value and should be built first regardless.** It is also
the fallback the other tiers degrade to.

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

Build tier 0 now, as ordinary product code with no model and no download. Instrument whether anyone
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
