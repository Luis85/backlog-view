# Design — the refactor slice and the estimation view's walking skeleton

*Brainstormed 2026-08-16. The first deliverable under [[A view per capability]] and
[[Business value estimation]]: the smallest refactor that makes a second Bases view
honest, proven by a walking skeleton of the estimation view.*

## Decisions this design rests on

1. **Scope** — one slice: the refactor groundwork plus an estimation-view skeleton.
   The full estimation epic and the projection extractions are later work.
2. **Sequencing** — the estimation view jumps ahead of extracting the board, the
   roadmap and the Deliverables board. The estimation epic requires only the kernel;
   extraction requires configuration migration and is staged on its own feature. A
   genuinely different second view proves the kernel better than a moved copy of the
   first.
3. **The layers question (P1 issue)** — approach A: `domain/` **is** the kernel.
   ADR 0003 is confirmed by a new ADR; the four layers and their lint edges stay; no
   application layer. The issue
   [[The SDD's layers are not the four this repository enforces]] closes naming that
   ADR, which is written before any directory is created under `src/`.
4. **First screen** — a flat table of the Base's results beside a per-item estimation
   panel. The full [[The prioritized list]] feature comes later on this chassis.
5. **Harness first** — implementation starts with an uncommitted `mountHarness` mock
   of the table and panel, so layout is argued against the real stylesheet before any
   module exists. Obsidian default colours only; the live-vault check is still owed.

## 1. The refactor half

**The ADR.** One new ADR answers the P1 issue in writing: `domain/` is the shared
kernel under another name — pure, node-tested, lint-fenced — and `storage/` stays the
one write boundary. No application layer: a use case remains a host method plus a pure
planner. The ADR records the test for ever adding one — two views measurably
duplicating the same use case, not a prediction. It also records the deferred `view/`
split: per-view directories and the lint edge between them arrive with the extraction
feature, not now.

**Registration.** Each view owns a `register<View>.ts` exporting one function.
`main.ts` composes: `initLocale()`, build the shared write state, one registration
call per view, the commands and the vault rename listener. The backlog's registration
moves out of `main.ts` unchanged. Adding a capability adds a file
([[A view type per capability]]).

**The plugin-wide write path.** `WriteGate` splits along the line the code already
shows:

- `view/writeLock.ts` (new) holds what must be one per vault: `applying`, the undo
  slot (`lastUndo`), and the `UndoRecovery`. Created once in `main.ts`, handed to
  every view's gate. It notifies each registered view's busy-sync while views live, so
  an undo button can follow a slot another view consumed.
- Each view keeps its own `WriteGate` for what is per-view: the config-problems check
  (its own settings, asked of its host), the outside-filter refusal (its own model),
  busy publication and the deferred refresh (its own DOM).

Visible costs, stated not discovered: a write in one view makes the other's briefly
refuse ("still applying"), and undo takes back the vault's last batch, whichever view
wrote it. A single-view vault sees no change. The extraction is proven by the existing
gate tests passing untouched.

**Where the estimation view lives.** `view/estimation/`, nested the way
`view/render/` is. It imports `domain/`, `storage/`, `ui/`, `i18n/` and the named
shared view modules (the gate, the lock) — never the backlog's own modules. That
boundary is convention until the `view/` split makes it a lint edge; the ADR says so.

**New kernel code.** Scoring is born in `domain/` — no DOM, no Obsidian — with its own
node tests: the model configuration and its validation, the renormalized weighted
score, the stamp fingerprint. Written with the estimation view as its first caller
([[A shared kernel behind the views]]: new logic brings its own tests; it cannot
borrow the extraction's proof).

## 2. The estimation data model

**Thirteen keys in the default model, all named by the view, none invented.** One
score key per enabled dimension (eight in the default model), confidence, effort,
complexity, the consolidated total, and its model stamp — each an ordinary
frontmatter property under a key the view options name. An unconfigured key
is never written. The total and the stamp are one key *pair*: scoring is refused
unless both are bound, in the config-warning shape, naming which is missing.

The **estimation status property stays out of the skeleton**. Its lifecycle
(Draft → Validated → …) is a second workflow the skeleton does not write, and binding
a key nothing writes only stubs frontmatter. The skeleton derives currency instead
(below); the stored status arrives with its own feature.

**The model is view configuration, seeded from shipped defaults.** Per dimension:
enabled, property, integer range (`min < max`), positive weight (the enabled weights
sum to 100), direction, and one rubric sentence per point
([[A rubric for every point]]). Beside them: the model's declared output range, and
the confidence, effort and complexity scales with their own rubrics. The default
model — the PRD's eight dimensions, weights and rubric sentences — ships as **data in
`domain/`**, not in the i18n catalog: rubric sentences are persisted in the `.base`
and fingerprinted, and persisted text is data by this repository's own test. The UI
chrome around them (labels, headings) is catalog text through `t()` as usual.

**Arithmetic** is [[The weighted score]] and [[The scoring model is configuration]]
verbatim: proportion on the declared range, inverted when less is better, weighted,
divided by 100, mapped to the declared output range. Answered dimensions renormalize
and the coverage is shown wherever the total is; an item with no answers has no total
and nothing is written. Out-of-range values clamp and report; a non-number is a
missing score. The total is rounded to two decimals at the point of writing, and
every comparison uses the rounded number.

**The stamp** is one string property: human-readable coverage plus a fingerprint of
everything that decides the arithmetic — the enabled set, weights, each dimension's
property, range and direction, the output range, the formula, and the rubric
sentences. **Current** is derived on read as the epic's three questions: the stamp
matches the on-screen model, the recorded coverage matches the note's answered
dimensions now, and the stored total equals the rounded recomputation. Any failure
shows *Needs re-estimation*; a foreign stamp shows as another model's; an absent one
as hand-written. An orphaned total (inputs deleted elsewhere) is reported and removed
only by the next estimation action on that item — never on render, never by a sweep.

**Write-back.** A score edit plans one gated batch — the score, the recomputed total,
the stamp, all on that note — through `applySafely`, one undo. The
confidence-adjusted value and the value-to-effort indicator stay derived on read,
labelled, beside their inputs; neither is written. **Bind-and-backfill** reuses the
`optionalProperties.ts` machinery over this view's own key list, offered from the
guided empty state, gated by the view's config problems first.

## 3. The two surfaces

**Layout: table beside panel.** The Base's results as a flat table — title with type
badge, total with coverage beside it, confidence, effort, and the derived currency
word (*Current / Needs re-estimation / Another model / Hand-written / No total*) —
and a detail panel for the selected row. No tree and no context rows: every row is a
result, so every row is writable, and the gate's outside-filter refusal stays as the
structural backstop it is everywhere else.

**The table.** Click a header to sort. The sort pick is UI state in this view's own
view-state store entry, never the `.base`. Sorting is reading — nothing writes an
order or a priority anywhere (the epic's "nothing here decides anything").

**The panel.** For the selected item: one selector row per enabled dimension — the
range's points as buttons, the chosen point's rubric sentence displayed, every
point's sentence reachable on hover and focus — then confidence, then effort and
complexity in their own group, then the decomposition: score × weight per dimension,
coverage, the total, and beside it the labelled confidence-adjusted value and
value-to-effort indicator. Picking a point plans the batch; the checkmark question is
asked of the plan, never of a comparison beside it.

**Two tab-stop zones, the plugin's existing split.** The table is one stop with a
roving selection (arrows move, Enter opens the note, context menu on the row). The
panel is ordinary UI — real buttons, Tab reaches them — chrome beside the composite,
not content inside it. Exact keys follow the established keyboard module shape in the
plan.

**Empty states.** No model or keys configured → the guided empty state: *Use
recommended defaults* (seeds the default model, binds suggested keys, backfills — the
reused `runInit` shape, config-gated) or *Configure properties*. Configured but no
results → the ordinary results empty state. A broken model → the config-warning
surface, computing nothing and naming the offender, never a half-working form.

## 4. Errors, testing, register

**Errors.** The estimation view has its own config validation in the config-warning
shape: a weight of zero or less, weights not summing 100, a broken range, a missing
total/stamp key. The view computes nothing and names the offender; the gate blocks
writes while problems exist (the gate asks its host, so each view validates its own
settings). Write failures keep the gate's Notice + console path. Foreign and absent
stamps and orphaned totals render as their states and are never repaired silently.

**Testing.**

- *Extraction proof*: the gate split and the registration move ship with the existing
  suites passing untouched.
- *Node tests* for the scoring kernel: renormalization, rounding-at-write
  comparisons, the refusals (zero and negative weight, bad range), and stamp
  behaviour — same model, same stamp; any arithmetic-deciding input changed (a
  weight, a property binding, a rubric sentence, the output range) changes it;
  coverage recorded.
- *Shared write path*: two gates on one lock — serialized, one undo slot, undo
  returns the vault's last batch whichever view wrote it.
- *jsdom view tests* under `test/view/estimation/`, driven through the real view with
  a `makeView`-style helper: empty states, table from results, selection to panel, a
  point pick plans exactly score + rounded total + stamp, the refusal without the key
  pair, currency going stale after a weight edit.
- Coverage thresholds only rise. Fallow and docs-check stay green. `npm run check` is
  the definition of done.
- *Honest limits*: registering a second Bases view type, the picker entry and `.base`
  saving need a live vault. `npm run test-build` is the handover, and this spec says
  so rather than claiming jsdom covers it.

**Register updates in the same work.** The new ADR (its `## Decision` names
`writeLock.ts` and the registration files); the P1 layers issue closes naming it; the
estimation feature notes gain `## Where it lives` sections as their modules appear
(docs-check rule 7); CHANGELOG `[Unreleased]` entries per pull request.

## Out of scope, stated

Creating items (the backlog does that), inheritance display, weighting scenarios,
framework presets, the value-against-effort matrix plot, estimation-status writes,
estimation history, cross-view navigation, the `view/` per-view split and its lint
edge, and every projection extraction. Each is a register note already; none is
started here.
