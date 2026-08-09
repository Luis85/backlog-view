# A manual in the view, and the 0.4.0 round closed

2026-08-09 — design, approved before implementation.

## The problem

The plugin is correct and unexplained. `npm run check` is green — 1974 tests, coverage
98.33/94.69/99.57/99.48, fallow 0 above threshold, 0 dead files, the register consistent
across 279 notes. Fallow's three refactoring targets are 115–190 LOC files whose only
fault is a fan-in of 5–7. There is no code debt worth a pass.

What there is: nothing inside the plugin explains the plugin. In the app a user gets icon
tooltips and 26 view-option labels. The README is 831 lines and lives on GitHub. Every
increment since [[User manual]] was written has widened that gap — `Idea`, `Deliverable`,
`Milestone`, risk levels, dependencies, WIP limits, column policies, two roadmap axes —
vocabulary a coloured badge cannot teach. And the register already stated why teaching
matters more here than in a validating tool: **the rules are advisory**, so the view
cannot teach by rejection. What it offers is the whole lesson.

Two smaller things ride along because nobody else will do them: `vitest.config.mts` has
accumulated a 185-line coverage ledger where a rule belongs, and the checks CI cannot run
have a cadence but no runs.

A third was planned and is deliberately **not** done — writing the 0.4.0 round's closing
paragraph. Its own note forbids it while nine findings are open, which they are. See
**The coverage ledger — and the round that is NOT closed here**.

## Not in scope

The badge contrast floor, the bundle-size budget, `Multilang`, the five remaining
`Theming and styling` PBIs, lanes, item templates, the test catalog. No new projection, no
new write path, no change to what the plugin does to a vault.

**The manual writes nothing.** No note is created, no frontmatter is touched, and nothing
about the dialog is persisted to the `.base` or to local storage. Help is not backlog data,
and the one write boundary is not a thing to widen for documentation.

## The design

### The shape: Obsidian's own settings dialog

A sidebar of section titles beside a content pane, built on `.modal.mod-settings`,
`.modal-sidebar-inner` and `.vertical-tab-nav-item` — classes Obsidian already defines.

This was chosen by mocking it, not by reasoning about it: two layouts drawn by hand
against the real stylesheet (`npm run harness -- test/harness/mock.ts`, the scratch file
deleted after). The alternative was one scrolling dialog with a chip strip that jumps to
each block. It reads straight through and one Ctrl+F finds any section, and it was
rejected on a sentence [[A help button for the item types]] had already written: *every
section can be opened directly rather than scrolled to*. A jump strip is a scroll, not an
open, so B would have needed the definition of done rewritten or an accordion bolted on.

The cost of A, stated rather than implied: a narrower reading column, and no single
Ctrl+F across the whole manual.

Nearly all the chrome comes from Obsidian's stylesheet, so the new partial is the split
and the pane padding — on the order of 30 lines, not a design.

### Three modules, split by kind

```
src/ui/manualDialog.ts        the dialog — sidebar, pane, section switching
src/view/manual/sections.ts   the five written sections, as data
src/view/manual/typesSection.ts   the one derived section
```

[[User manual]] predicts *"six sections will not fit one 400-line module, so the content
splits by topic from the start."* Written out, the six sections are about 100 lines of
data in total, so a six-way split by topic buys six register edits under `docs-check.mjs`
rule 7 and no reader anything. **The split that earns itself is by kind**: five sections
are prose someone wrote, one is generated from the vocabulary. Those are different things
and they fail differently. If `sections.ts` later passes the 400-line cap, lint says so
and it splits then, on evidence rather than on a prediction.

The authored five are not all the same, either: *Setting up the view* is authored prose
carrying a schema-derived completeness check, for the reason given under **The six
sections** below. It stays in `sections.ts` — what makes it different is a field and a
test, not a module.

`ui/` may not import `domain/` (`eslint.config.mjs`), so the dialog takes its content as
a parameter:

```ts
interface ManualEntry { term: string; text: string; badge?: { text: string; cls: string } }
interface ManualSection { id: string; title: string; entries: ManualEntry[] }
```

One optional field rather than a renderer interface. `badge` carries a **resolved class**
rather than a type name, because resolving `Epic` to `pbl-lvl-0` is exactly the knowledge
`ui/` is not allowed to have — the layer rule paying rent instead of costing it.

### The six sections

| Section | Answers |
| --- | --- |
| Item types | What each type is for, generated from `ALL_TYPES` |
| Moving and ranking | Drag, Alt+arrow, that a move does not re-type, and every state a move is deliberately unavailable in |
| Creating and filing | What the row's **+** offers, where the note lands, what gets written |
| Finding work | Focus level, quick filter, Show completed items |
| Safe writes and undo | Batches, one-at-a-time, excluded notes, the config gate |
| Setting up the view | The three required properties, the ✨, what each optional one turns on |

**Two sections are answerable to a schema, in different ways**, and both were nearly
missed by classifying everything but the types as prose someone wrote.

*Item types* is **derived, not retyped**: every entry comes from `ALL_TYPES`, so a type
added later without an explanation fails a test rather than shipping as a gap.

*Setting up the view* is **authored with derived coverage**. Its own use case forbids both
halves of the obvious approach: the grouping must be by what an option *changes* rather
than in schema order (so it cannot be generated), and *"coverage is measured against
`getViewOptions`, never against a count written here"* (so it cannot be hand-listed
either). What satisfies both is one optional field —

```ts
interface ManualEntry { …; keys?: string[] }   // the view-option keys this entry explains
```

— and a test asserting every key `getViewOptions()` declares is claimed by exactly one
entry. The prose stays authored; the *completeness* is derived. This matters more than it
looks: the schema generates a folder picker per type and a WIP limit and policy per
workflow state, so the key count moves with the vocabulary and with the user's own
configuration. A hand-counted section would read as complete while omitting the generated
half — which is why this spec quotes no number for it.

Both are the invariants-as-checks rule this codebase already holds itself to, applied to
prose.

### Reaching it

A real `<button>` in the toolbar, so Tab reaches it and Enter or Space opens the manual —
not a per-row control inside the tree's single tab stop.

It joins the fit ladder and sheds at **step 2** — the rung where the `⋯` itself first
renders, and therefore the earliest rung at which shedding is possible at all. Before
step 2 there is no overflow menu to be mirrored into; from step 2 on there is, so
"reachable in at most two clicks" survives every narrower pane with no new mechanism.
Shedding it that early is deliberate: of everything on the row it is the one control
whose use is never urgent.

**No command-palette entry.** `⋯` already covers the clipped case, and a command id costs
a register edit in `test/docs/surfaces.test.ts` for a second door into the same room.

### Four contextual entry points, and one opener

The `?` is the general door. Three of the six use cases require **point-of-need** doors as
acceptance criteria, not merely as triggers, and a manual reachable only from the toolbar
would leave them unmet while looking complete:

| Surface | Opens on | Required by |
| --- | --- | --- |
| The new-item modal | Creating and filing | *"creating an item is the moment the folder question is asked, so the manual opens on this section from there"* |
| An empty state with nothing to show | Finding work | its trigger — an empty state is the moment "where is my work" is asked |
| The write-in-flight indicator | Safe writes and undo | *"reachable from the busy indicator and from the config warning"* |
| The `Check view options` warning | Safe writes and undo | the same criterion |

All five doors go through **one opener**:

```ts
openManual(app: App, sectionId: string, returnFocusTo: HTMLElement | null): void
```

`sectionId` selects the section the dialog opens on — the same mechanism the sidebar uses,
so a deep link is not a second way to reach a section. `returnFocusTo` is the control that
opened it, because "focus returns to the **?**" is only correct when the **?** is what was
pressed; from the busy indicator, focus must return to the busy indicator. One opener, five
call sites, and no surface plans its own dialog — the same shape this codebase already
requires of a card move.

### What this does to Multilang

The manual is the largest single addition of inline English this plugin will ever make —
roughly 60 strings — which makes [[Finding 5 — every user-visible string is inline]]
numerically worse. It does not make it **harder**, and the reason is the module split
above: 60 strings in two pure-data modules is one sweep for a catalog to lift wholesale.
The same 60 spelled inline across six render functions would not be. Recorded here so the
trade is visible rather than discovered later.

## The coverage ledger — and the round that is NOT closed here

This pass was going to write the round's closing paragraph. It must not, and the reason is
in the note that asks for it. [[Finding 16 — nothing in this round closes it]] says the
paragraph goes beside the others ***when the last finding closes***. Nine are open, and
this pass closes none of them — styling, the bundle budget and `Multilang` are all
explicitly out of scope above.

Writing it now would destroy the thing it exists to be. A boundary drawn while nine
findings are still open is not a boundary; it is a paragraph claiming a round ended that
did not, and it would spend the sentinel that is supposed to mark the real ending. So
**Finding 16 stays `Open`, and no paragraph is written.**

What that leaves genuinely unaddressed is the concern underneath it — that the epic
accumulates rounds with no boundary, and a third has nothing to open against. This review
*is* effectively a third round, and its record is this spec and its pull request rather
than a paragraph in the epic. That is a weaker answer than Finding 16 wants and it is the
honest one available while its own precondition is unmet.

What does happen here is independent of all of that: `vitest.config.mts` loses its
coverage ledger. The comment there has grown
to roughly 185 lines of per-increment history — an append-only record of which decimal
moved when. What is worth keeping is the **rule** it states (thresholds only ever rise) and
the two episodes that teach rather than record: the 94.0038 that was refused because a
mid-increment figure is not the increment's figure, and the coverage failure that turned
out to be two dead branches rather than a missing test. The rest is in git. This is the
same defect [[Finding 3 — delete the module table rather than gate it]] deleted the module
table for, in a file nobody thought to look at.

## The verification handover

One `Task` under [[Verifications a device has to answer]] — deliberately **not** a ninth
smoke-test note. The eight that exist say *what* to check. This says what to do in one
sitting, in order:

1. `npm run test-build`, open this repository as a vault, open `docs/Product Backlog.base`.
2. The eight existing checklists, in a stated sequence, with where each answer is recorded.
3. The phone — [[Smoke test the touch paths on a phone]], `P1`, and the sharpest gap in
   the product: `isDesktopOnly: false` is a shipped claim, every direct manipulation is a
   native drag, so on a phone the context menu **is** the entire interface and it has never
   been touched by a finger.
4. Enable branch protection requiring branches to be up to date before merging — the only
   open item on [[Two spec branches predate the use-case gate]], a `P1` recording the class
   firing four times in one afternoon.

Items 3 and 4 are the maintainer's and cannot be done here; naming them in an ordered list
is what turns "blocked on hardware" into a thing that can be worked through.

## Recorded, not fixed

[[Every type badge is below the contrast floor]] gains what this review measured and the
note did not. The fix is **out of scope by decision** and the note stays `Open`:

- Its table is **light-scheme only**. Dark was never measured and **also fails** — PBI/blue
  at 3.59, Bug/red at 4.13.
- Its stated lever is the weak one. Dropping the 0.14 alpha to 0.10 leaves light's worst at
  about 1.9, because the text is unchanged. The lever is the text, not the background.
- A solid pill is not an escape: no single ink clears eight hues. White text bottoms out at
  1.41 on yellow, black text at 3.21 on purple.

One consequence of shipping the manual without the fix, on record: the types section stacks
all nine badges in one column at reading size, which is the first place in the plugin they
are compared side by side — at 1.88:1 in light. The manual makes an existing defect more
visible without causing it.

## Testing

- The five written sections and the derived one are **pure data**, so node tests read them
  without a DOM.
- Every type in `ALL_TYPES` has an entry, asserted — the check behind "derived, not
  retyped".
- Every key `getViewOptions()` declares is claimed by exactly one setup entry, asserted
  against the schema rather than a list. `test/docs/surfaces.test.ts` already imports
  `getViewOptions()` for the neighbouring rule, so this needs no new instrument.
- The dialog is jsdom: it opens on the section it was asked for, the sidebar switches the
  pane, and closing it returns focus **to the control that opened it** — asserted from the
  busy indicator as well as the **?**, since a single-opener test passes either way and
  only the second one can fail when `returnFocusTo` is ignored.
- Each of the four contextual entry points opens the manual on its own section, driven at
  the surface rather than by calling `openManual` directly — a test that calls the opener
  proves the opener, not the wiring.
- The toolbar button is a real `<button>` in the tab-stop zone, sheds at the expected rung,
  and appears in `⋯` when shed.
- **Nothing writes.** Asserted at the boundary rather than by listing paths: opening,
  reading and closing the manual touches neither the fake vault nor local storage.

## Definition of done

`npm run check` green, with coverage thresholds raised to what the increment measures and
no threshold lowered. Sentence-case UI text, `setCssProps` over inline styles, no global
`app`. `test/harness/mock.ts` not committed.

Six PBIs under [[User manual]] move to `Done` — and that is a claim about their acceptance
criteria, not about their sections existing. Three of them are met only once their
contextual entry point is wired and tested, which is why **Four contextual entry points**
above is not an extra: without it, three of the six would be marked `Done` while their own
criteria went unmet.

[[Finding 16 — nothing in this round closes it]] **stays `Open`** and no round-closing
paragraph is written, for the reason given in its own section above.

What is **not** done and is owed: the live-vault look. jsdom cannot answer whether
Obsidian's real modal sizing makes a 190px sidebar sensible on a phone, and the harness
cannot either — its own modal is a stand-in with approximate colour (ADR 0020). That
question goes to the handover above rather than being called finished here.
