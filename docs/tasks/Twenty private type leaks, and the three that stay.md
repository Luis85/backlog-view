---
type: Task
order: 370
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-09-02
closed: 2026-09-02
source: npm run analyze, classified one type at a time rather than swept
files:
  - src/domain/vocabulary.ts
  - src/domain/releases.ts
  - src/domain/model.ts
  - src/i18n/t.ts
  - src/ui/prompts.ts
  - src/storage/viewStateStore.ts
  - src/view/openTarget.ts
  - src/view/render/chips.ts
  - src/view/render/board.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Twenty private type leaks, and the three that stay

## Evidence

`npm run analyze` reported **20 private type leaks** across nine files — an exported
signature naming a type the same file does not export, so a consumer cannot name it. Fallow
states the rule for library authors; this plugin publishes no types at all, so the first
question was whether the rule applies here in any form.

Two measurements answered it, and they point opposite ways.

**The compiler does not care.** `tsc --declaration --emitDeclarationOnly` over `src/` emits
without a single error: TypeScript writes the private declaration into the `.d.ts` beside
the exported one. So none of the twenty blocks anything, and no caller in `src/` or `test/`
works around one — every call site passes either an object literal or a value it got from an
exported symbol.

**And the fix costs one word with no second cost.** The obvious objection is that exporting
a type nothing imports trades a leak for a dead export. Measured on one file before deciding
anything: adding `export` to `VocabularySource` removed four findings and added zero dead
exports, on a run that reports `dead exports 0.0% (0 of 980)` and would have said otherwise.

So the rule is cheap to satisfy and un-actionable to ignore, which makes this a
classification rather than a sweep in either direction.

## The question each type was asked

**Is this a narrowing a caller could legitimately name, or a seam the module means to keep
shut?** Not "is it used outside" — nothing here is, structurally — but whether naming it
would state something true.

**Seventeen are narrowings, and are exported now.** Each documents the minimal shape a
signature needs, and a caller holding one of those values has every right to say so:

| type | what it narrows |
| --- | --- |
| `VocabularySource`, `CatalogVocabularySource` | the fields five collectors read, so `vocabulary.ts` need not depend on `model.ts` |
| `LiveKeys` | the two settings `refusesLiveMembership` reads out of `BacklogSettings` |
| `Openable` | `{ file: TFile }` — all `OpenController` wants of an item |
| `LabelChip`, `DateChip` | one chip's spec, handed back out by `LABEL_CHIPS` and `dateChipFor` |
| `BoardRenderOptions` | what differs between the two board-shaped projections |
| `Refusable<T>` | what a prompt that can refuse an entry needs of its options |
| `Reader<T>` | one preference's validator, and `PREF_READERS` is already exported for a test |
| `Forms`, `Entry` | the element type of `Catalog`, which two test files name today |

**Three are seams, and are suppressed at the line with the reason beside them.**

- `LinkedItem` (`model.ts`) — phase 2 of a three-phase build whose own docstring says
  `BacklogItem` is *"the only phase anything outside `model.ts` ever sees"*. Exporting it to
  quiet a tool would reverse a stated decision for the tool's benefit.
- `Messages` (`t.ts`) — `typeof en`. Exporting it publishes every key's literal English text
  as API and lets a caller depend on a sentence, against this codebase's own rule that a
  sentence is the unit of translation and belongs to the catalog.
- `Args<K>` (`t.ts`) — the tuple `t()` derives from a key. Nobody can write one; that it is
  computed is the whole feature. What a caller names is `MessageKey`, which is exported.

## Outcome

20 → 0. Eleven `export` keywords, three `fallow-ignore-next-line` markers, no dead exports,
no signature changed. `npm run analyze` reports `✓ No issues found` for this rule, so the
next leak is visible instead of buried in twenty — which is the whole of what this buys, and
it is worth saying plainly: nothing about the plugin's behaviour changed.

Fallow's own stale-suppression check earned its keep immediately: the first marker went on
the `Messages` declaration rather than on `MessageKey`, whose signature is what leaks, and
the run said so.

## What is left

The three markers are a standing claim that those types must not be exported. Nothing checks
that claim — a contributor could delete a marker and export the type, and every gate would
stay green. That is acceptable here for the reason the ban has no teeth anywhere: the
decision is recorded at the line, in the file, beside the docstring it follows from. If a
fourth seam ever wants one, ask whether the pattern is worth a lint rule instead.
