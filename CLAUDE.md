# Product Backlog — agent guide

Obsidian plugin registering a custom **Bases view** (`product-backlog`): a drag-and-drop
work-item tree (Epic → Feature → PBI → Task) over notes in a flat folder, driven by
`parent`/`order`/`type` frontmatter — with two more projections toggled per saved view:
a kanban **board** whose columns are the configured workflow states, and a
**roadmap** drawing whichever axis the view options declare (horizon buckets that a
card can be moved between, or a read-only timeline from two date properties) with
everything unplaceable on a counted shelf that is also the target that un-places. The
mode, the roadmap-axis pick and the focus level are UI state (vault-scoped localStorage,
beside the collapse state), never a `.base` setting: base settings are saved on the view,
working position on the device.
Requires Obsidian 1.10.2+ (Bases custom view API).

## Definition of done

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow + docs register
```

All five must pass before committing; CI runs the same steps, on Ubuntu **and Windows** —
paths and line endings are the only things that differ between them, and both have already
produced a defect this repository could not see. Coverage thresholds
(vitest.config.mts) only ever go up. Fallow (config: .fallowrc.json) gates dead code,
duplication, complexity/CRAP (fed by the vitest coverage file) and dependency hygiene —
framework-invoked members (`BasesView.type`, suggest callbacks) are declared in
`usedClassMembers`, not suppressed inline. `docs-check.mjs` gates `docs/` the same way:
the register's hierarchy and sibling orders, every wikilink, every source path a current
note names, the use-case shape, the ADR frontmatter — and the check that finds *missing*
notes, since every module in `src/` must be *specified* by at least one — in a use case's
`## Where it lives` or an ADR's `## Decision`, a mention anywhere else counting for
nothing. `test/` is deliberately outside that rule: naming a path is not describing it, so
the check bought a register edit per new test file and nothing else. That gate has a
gate: `test/docs/checkerAccepts.test.ts` and `test/docs/checkerRejects.test.ts` run it over
planted trees in both directions, so a rule quietly lost fails a test, and a legal form it
starts refusing does too — the direction that blocks a contributor rather than letting one
through. Obsidian itself
cannot run here — the jsdom test harness ([`test/CLAUDE.md`](test/CLAUDE.md)) is the
substitute; say so honestly when a change still needs a live-vault smoke test.

When the question is what a change *looks* like and no vault is at hand, `npm run harness`
bundles the real view into a static page with the real stylesheet — no Obsidian, no
dependency — so a browser can show it and drive it. It draws and asserts nothing: what it
is faithful about, and where that runs out — colour always, and any layout a partial
leans on an Obsidian element default to supply rather than writing itself — are in
[`test/CLAUDE.md`](test/CLAUDE.md) and ADR 0020, and it replaces no live-vault check. A
card-children disclosure centred and boxed like a raw button shipped looking right here
and wrong in a vault (2026-08-08) for exactly that second reason: `test/harness/theme.css`
had no baseline at all for a bare `<button>`. Improving the stub narrows the gap; it does
not close it, so keep saying so honestly rather than letting "faithful" read wider than
what the stub actually covers.

That makes it a way to mock a projection *before* building it, and the offer belongs
before the implementation rather than after: when a change would visibly alter the view,
**ask whether to mock it in the harness first**. The cheap version needs no new code at
all — a type, a state vocabulary, a column set or an axis added to `demoOptions()` /
`demoResults()` in `test/helpers/fixtures.ts` is drawn by the real view against the real
stylesheet, so a layout can be argued about before a module exists to argue with. Markup
that no code produces yet needs its own bundle entry —
`npm run harness -- test/harness/mock.ts`, a file that calls `mountHarness` and then draws
by hand — and that file stays uncommitted, since nothing imports it and `npm run analyze`
is right to call it dead. Either way it answers layout, spacing and hierarchy only;
colour, iconography and anything Bases hands the view stay unanswerable here, so the
live-vault check is still owed.

`npm run test-build` is the handover for exactly those cases: it bundles into
`.obsidian/plugins/<id>/` in the repository root (gitignored), so the human can open
this repository as a vault and look. Name it when a change needs eyes — it is a shorter
ask than "please set up a vault", and `docs/` is already a backlog with a `.base` file
in it — open `docs/Product Backlog.base` and the plugin is displaying its own register.

## Architecture (one file per concern, 400-line max enforced by lint)

Four layers, outermost first. **Each may reach anything below it and nothing above** —
`eslint.config.mjs` enforces this with per-directory `no-restricted-imports`, so a
violation fails `npm run lint` rather than waiting for review:

```
main → commands → view → storage → domain
                    ↘________________↗
```

`ui/` is a leaf of reusable Obsidian dialogs that knows about none of them. `test/`
mirrors the same directories.

**`domain/`** is the backlog itself — what the tree *is*, what a change *would* mean, what
each projection derives — and it reads the vault without ever writing it or touching the
DOM. That is what makes it the layer with node tests and no harness: a rule about levels,
ranking, scope or placement can be asked of a function rather than of a screen.

**`storage/`** is the only place anything is persisted, and it has node tests like
`domain/` — apart from `collapseStore.ts`, which reads localStorage and so needs jsdom.
Not a convention: "everything that puts bytes in the vault is in one directory" is
established by the `no-restricted-syntax` ban named below, since reading the directory
shows what is inside it and never that nothing outside writes. That is why the `.base`
file and the generated README live there too rather than beside the code that decides
them.

**`view/`** is the DOM and every input that reaches it, so it is the layer the jsdom
harness exists for. `commands/` is the palette's way in, and `main.ts` is the only place
anything is registered with Obsidian — the view itself and the commands both.

There is deliberately no list of the modules here. `src/` is the list, one file per
concern, and it cannot go stale; what a module is *for* is stated where its behaviour is
specified, which `docs-check.mjs` rule 7 requires of every module in `src/` — the two
sections named under **Definition of done** above. Read from the behaviour you are
changing rather than from an index of the tree.

Rules: never write frontmatter outside `storage/frontmatter.ts` (`applyWrites` /
`createBacklogItem`), and every write path — including creation — goes through the
`configProblems` gate. That rule is also enforced mechanically: `no-restricted-syntax`
bans `processFrontMatter`, `vault.create` and `load/saveLocalStorage` everywhere outside
`storage/`, so a new write path cannot appear by accident. Modules reach view state only
through `BacklogViewHost`; keep `host.ts` free of runtime code so imports stay cycle-free.

A type belongs with the code that *produces* it, not the code that consumes it — that is
why `DropTarget` and `DropZone` live in `domain/dropTargets.ts` rather than with the
writer and the view that read them. Both used to sit upstream and made the pure layer
depend on the effectful one.

**Everything `npm run` invokes lives in `scripts/`** — the build, the harness, the vault
handover, the version bump, and the register gate with its Markdown layer. Two files stay
at the repository root because a TOOL finds them there rather than a script calling them:
`eslint.config.mjs` (which `eslint .` discovers) and `vitest.config.mts`. Every script
resolves its paths from the WORKING DIRECTORY, not from its own location — npm scripts and
vitest both run from the root — so `scripts/styles-assemble.mjs` reading `styles/` is
correct and not a bug waiting to happen. That is stated in the one file where the
distinction bites.

**The stylesheet lives under the same rule.** `styles/` is one partial per concern and
`styles/index.css` assembles them; the root `styles.css` is generated and gitignored
beside `main.js`, so the file to edit is always the partial. `styles-assemble.mjs` is
what makes that a gate rather than a habit — `npm run build` fails on a partial over 400
lines or one no entry file imports. The import ORDER is behaviour, not organisation: two
rules of equal specificity are decided by which came last, and `index.css` says which
positions in its list are load-bearing and why.

## Testing

The harness itself — the helpers, what a view test drives, and the limits of the jsdom
substitute — lives in [`test/CLAUDE.md`](test/CLAUDE.md), loaded when you are working
there. What stays here binds while you are editing `src/`:

- `test/**` has its own lint budget (`max-lines: 450`), because the one suite without a cap
  is the one that grows: split by subject before a file becomes the place tests hide. The
  Obsidian ruleset deliberately stops at `src/` — it is type-aware, and the test doubles
  exist to do what it forbids.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. Six of ten review findings
  on one pull request were comments precisely stating the rule the code beside them
  broke, so a confident paragraph is evidence of intent and of nothing else — see
  `docs/issues/A comment that states a rule is not a check.md`. Twice, watching the test
  fail was what showed it asserted less than it read as. What to do when the check cannot
  reach the whole claim is in **Claims, and the checks under them**, below.

## Invariants that bite

Layer-specific rules live beside the layer they govern, so they are loaded when you are
working there rather than read as one wall:

| | |
| --- | --- |
| [`src/domain/CLAUDE.md`](src/domain/CLAUDE.md) | levels and depth, scope, focus mode, ranking and orders, folder mode, cycles, orphans |
| [`src/storage/CLAUDE.md`](src/storage/CLAUDE.md) | the write boundary, collapse-store identity, renames, pruning |
| [`src/view/CLAUDE.md`](src/view/CLAUDE.md) | render cost, what is hidden vs absent, tab stops, controls, view lifecycle |

What stays here is what belongs to no single layer.

### The context-row rule

One rule covers the whole context-row feature, and every past bug in it was a place
that forgot the rule rather than a new rule: **an `outsideFilter` row is never a write
target, never a ranking peer, and never a source of anything derived from the Base's
results** (counts, level breakdown, state and tag vocabulary, creation folder). It renders, it
parents, and that is all. "Never a ranking peer" means never written to and never
renumbered — its `order` is still *read* (`afterHighestKnown`, `endOfSiblingsOrder`,
the backfill's max-order scan), because the row is on screen and a rank that ignored
it would place an item above something the user can see. Ask that question of any new
code touching the tree; the "write safety with context rows, across every entry point"
test in `test/view/contextRowWrites.test.ts` drives every interaction against a fixture
with context rows above, beside and between results, so a new write path fails it
without anyone predicting the surface — and `test/view/contextCardWrites.test.ts` asks
the same three questions of each CARD projection (the drag, the keyboard and menu paths
a drag cannot take, the structural refusal behind both), because a card is a different
set of entry points over the same rule.

"Derived from the results" includes numbers computed *while walking the tree*, not just
code that reads a model collection: `assignAll` traverses **through** a context row to
the results below it but never counts it, so a rollup reports what the Base returned and
an excluded note's own state can neither skew a progress bar nor keep a finished subtree
on screen. Two invariant tests in `test/view/contextRowWrites.test.ts` state this from
the rule rather than the implementation — one for writes, one for rollups.

The view NEVER writes to a note the Base excluded — enforced structurally in
`applySafely`, which refuses the WHOLE batch (loudly) if any write targets an
`outsideFilter` item, so a new write path cannot reopen the hole by omission. It rejects
rather than filters: dropping the offending write alone would apply the rest and leave
the hierarchy half-updated. The one write path without that replay-time check is undo
(`undoLast`), deliberately: its authorization came at capture time — an undo batch can
only name files its forward batch wrote while they were results, and the write being
undone may itself be what moved one out of the filter (a parent marked done in a base
that excludes done items). The rule both paths keep is *never write to a note the user
could not act on*; `test/view/contextRowWrites.test.ts` drives undo across that
boundary too. The UI withholds every control that would produce one: every
row chip renders as a static `.pbl-state-static` div (and not at all with nothing to
show), and the context menu drops Set type, Set state and the parent-link actions. `New <child>`
stays — it writes a *different* note — but it must not land that note outside the filter
either: `inferFolder` counts only result rows, and folder mode's "children go beside the
parent's folder note" rule is skipped for a context parent (the explicit parent link
keeps the hierarchy right wherever it lands). `observedStates` likewise skips them: an
excluded parent's state is not this base's vocabulary and must not become assignable to
results.

### The write path

Writes go through `applySafely` (forward batches) or `undoLast` (replaying the last
batch's inverses), both over one gate (`runExclusively`): serialized (`applying` flag)
and blocked when `configProblems` is non-empty; forward batches are additionally
refused whole if any write targets an `outsideFilter` item. All three live in
`view/writeGate.ts` — the view owns a `WriteGate`, delegates the host's three write
methods to it, and publishes its progress; the gate itself touches no DOM. Everything applied was
planned by `domain/writePlan.ts`, which touches nothing, and applied by
`storage/frontmatter.ts`, which is the only module that may — and which captures each
write's inverse as it lands, so the last effective batch can always be taken back
(`applyRestores`, compare-and-swap per key).

One action also writes the **`.base` itself**: `runInit` (the toolbar's ✨, and the
board's and roadmap's unconfigured empty states) binds this view's suggested key for
every optional property nobody has named, and then backfills those keys onto the notes.
The two halves are one action because neither works alone — Obsidian's picker offers
the properties a vault HAS, so a property no note carries cannot be picked, and a
property nothing names cannot be written to a note. It runs the `configProblems` gate
itself before touching either: an action that changed the configuration and then had
every write refused would leave the view worse than it found it. Everything about
*which* properties those are lives in `domain/optionalProperties.ts` — see
`src/domain/CLAUDE.md`.

### One move, three inputs — per projection

A card move is a drop, an Alt+arrow and a menu pick landing on ONE host method
(`performBoardMove`, `performHorizonMove`), which is the only place its batch is
planned and the only place it is announced. Adding a fourth input means calling that
method, never planning a write beside it; adding a projection means adding one such
method, not a second idea of what a move is. Both share `applyCardMove`, which also
states the capture rule: the vocabulary that will NAME the move is read before the
await, because the batch's own refresh rebuilds `board`/`roadmap` before it resolves
and the column or bucket just vacated may be gone with its last card.

**Absence is a value, and an unconfigured key is never written to** — a rule
`storage/frontmatter.ts` keeps in three different shapes, which is the fact to know
before adding another optional property. The state key guards inline
(`write.removeStateKey && settings.stateKey` in `applyInto`); the axis keys go through
`axisEntries`, where `key !== ''` drops an unconfigured one and a `null` value means
delete; the plain LABEL properties — the risk level and the assignee — go through
`applyLabels`, one loop over a list pairing each planned value with its configured key.
That third shape was `applyRisk`, a four-line restatement of the rule, until the assignee
arrived (2026-08-10) — which is exactly the case this paragraph said to re-examine at: a
fourth property wanting those two lines and none of the axis's civil-date equality or
datetime merge. It was extracted rather than copied, so a fifth label is a row in that
list. What has NOT been extracted is the rule across all three shapes, and that is still
deliberate: a helper general enough to cover the axis too would have to carry the date
handling past the properties that must not have it. This paragraph said the opposite until
2026-08-08, naming a `writeOptional` and a `removeHorizonKey` that have never existed: a
guide enumerating symbols goes stale exactly the way the table rule below says, and here it
sent a specification off to promise an implementer a call they would not find.

A Set menu's **checkmark is asked of the PLAN** — an entry is checked exactly when
picking it would write nothing — never by a comparison written beside the plan and
expected to agree with it. Those two drifted the moment a second property joined: a
horizon the reader refuses reads as no value, so comparing values checked `Unplaced`
on a note whose key still held something, offering as current an action that removes a
key and spends the undo slot.

**A write can take its own note out of the base**, and nothing reports it. A filter can
name the very property a move writes, so a legitimate write can make its own card
vanish; the card leaves in silence, which is what
`docs/requirements/Moving between horizons.md` extension 3b says should not happen. It
was built once and removed — the mechanism belongs to `New cards in place`, and building
it from one sentence took eleven review findings across seven rounds without reaching a
correct rule. Read `docs/issues/The outcome report was built from one sentence.md`
before building it again: the open question is that nothing correlates a Bases pass with
a write, and a design that needs that correlation cannot be made to work here.


## Claims, and the checks under them

The rules above are the ones this codebase learned from bugs. These are the ones it
learned from *reviews* — every one was broken here first, several of them inside the
change that was fixing the previous instance.

- **Read the register before reasoning from the code.** `docs/` holds decisions the code
  cannot show: an alternative already refused and why, an ordering two pieces of work must
  keep, which note already owns a question. Code answers *what is*; only a note answers
  *what was decided*. A proposal that reads as obvious from the source alone is the one
  most likely to have been considered and rejected already — check before proposing, and
  say so when the register disagrees with you.
- **Write the guarantee to the check, never ahead of it.** When a check cannot reach the
  whole claim, narrow the sentence rather than leaving the wider one standing. A guide that
  promises more than lint and the suite deliver is the same defect as an unchecked comment,
  and harder to catch because it reads as settled. If narrowing makes the sentence ugly —
  *"a direct call fails lint; an aliased one is caught only on a path the spy drives"* —
  the sentence has become honest and the ugliness is the information.
- **A category invariant is checked at the forbidden thing, not by listing the places.**
  "Nothing does X" cannot be verified by driving the paths someone thought of; the next
  path is exactly the one that breaks it. Put the check on the call — a lint rule, or a spy
  on the call itself — so it holds for code not yet written. Where the rule cannot see
  every spelling, name the spelling it does see.
- **Measure a set with an instrument that can see all of it, and test the instrument
  first.** A grep for `foo(` silently misses `foo<T>(`. A search for one heading misses the
  notes that spell it differently. Both happened here, and both times the wrong count was
  used as the evidence for a decision before anyone counted a second way.
- **Address code by name, not by position.** Selectors, symbols and paths survive an edit;
  line numbers are correct until the next insertion above them. A stylesheet that grew by
  most of its own size again left every line citation in the register pointing at the wrong
  rule, while every selector still resolved.
- **A table that enumerates code goes stale; a table that states a rule does not.** The
  first kind duplicates something the tree already says and is wrong the moment a file
  moves; the second cannot be falsified by a code change. Prefer prose that names a module
  only where the sentence is *about* that module — the layer guides are the worked example.

## Gotchas

- `obsidian` npm typings trail the app: `setSubmenu` is absent from them entirely, so
  `submenuOf` casts rather than imports. That is a typings gap, NOT a version guard —
  submenus predate the 1.10.2 in `manifest.json`, so there is no fallback path and
  should not be one. `isEmpty` is the opposite case: it IS in the typings, but on
  `ObjectValue` rather than the `Value` that `getValue()` returns, so testing for it
  is a genuine question about the value in hand.
- Fallow resolves an interface's members through an **explicit type annotation**, not
  through a property access: a host method reached only via `const host = ctx.host`
  reports as an unused class member even though it is called. Annotate the local
  (`const host: BacklogViewHost = ctx.host`) rather than reaching for
  `usedClassMembers`, which is for members a framework invokes and would hide a
  genuinely dead one.
- Nothing here carries compatibility with older *plugin* versions. `minAppVersion`
  is the only compatibility boundary, and it is a floor, not a range — a shim for an
  Obsidian older than it is dead code by definition.
- Marketplace rules (enforced by `npm run lint` + review): sentence-case UI text, no
  special characters in the manifest description, `setCssProps` over inline styles,
  `normalizePath` on user paths, no global `app`.
- Release tags must equal `manifest.json` version with NO `v` prefix — `.npmrc` sets
  `tag-version-prefix=""`; the release workflow rejects mismatches. See `RELEASING.md`.
- `CHANGELOG.md` gains a dated `## [x.y.z]` section in the same pull request as every
  version bump (a second commit, not the same one — `npm version` won't run against a
  dirty tree) — `RELEASING.md` states the rule, `test/release/changelogVersion.test.ts`
  checks it, ADR 0024 records why. `[Unreleased]` entries are added by the PR that earns
  them, not invented at release time. The release workflow also puts that entry in the
  GitHub release body ahead of the auto-generated notes (`scripts/changelog-notes.mjs`,
  ADR 0025) — heading boundaries there and in the test above come from `headings()` in
  `scripts/docs-markdown.mjs`, the same mdast parser `docs-check.mjs` trusts, rather than
  a hand-written pattern; ADR 0021 is why patterns over Markdown lost that argument once
  already.
- Dependencies are noticed by Dependabot and verified by `npm run check` — ADR 0019, which
  also says why `npm audit` is not a sixth step — and ADR 0022, which keeps it out of
  `check` for that reason while running `npm audit --omit=dev --audit-level=critical`
  as its own CI job, because "no patched version exists" is a hazard that scales with
  how much of the tree is audited and what ships is three packages. Two upgrades are refused on
  purpose, with the reason in `.github/dependabot.yml`: **TypeScript is held at `~6.0.3`**
  (`typescript-eslint` 8 declares `typescript <6.1.0`, so 6.0.x is permitted and 7 is
  refused outright with ERESOLVE, and lint is what would be lost — the tilde IS that peer
  ceiling, so do not make it a caret), and **`@types/node` tracks the `engines`
  floor**, not npm's newest. Do not "fix" either by widening the range.
- Work is tracked in `docs/`, which is a backlog **in this plugin's own schema** and the
  layout the view ships as its default — `requirements/` (Epic → Feature → PBI),
  `tasks/`, `issues/`, `bugs/`. Every note states the evidence it rests on. Closed notes
  are kept: several are checklists to re-run rather than history, since appearance and
  base identity cannot be tested here. See `docs/README.md`.
- The `brainstorming` and `writing-plans` skills save specs and plans under
  `docs/superpowers/...` by default, which is fine here: `docs-check.mjs` exempts
  `superpowers/` the same way it exempts `adrs/` and the index pages, so a generic spec or
  plan needs none of the `type`/`order`/`status` frontmatter a backlog note would. See
  `docs/README.md`'s folder table and rule 1.
