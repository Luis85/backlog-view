# Closing the release detail header

The two closing actions ([[Marking a release as released]], [[Generating the release notes]])
shipped on 2026-08-30 as a floating band between the release detail header and the scope
toolbar. This folds them into the header, narrows the standalone `Set released date` control to the
states the closing action cannot cover (corrected 2026-08-30 — see "The released date is
the control" below; the control is not retired), and widens ✨ to bind the three options
those actions need that are not properties.

Nothing here changes what a write does. Every batch, every gate and every refusal is the
one already shipped; what changes is where a control is drawn, which control carries the
released date, and how many options a reader must bind by hand before either action is
offered.

## Why

Three problems, all visible in the browser harness and none of them in a test.

**The detail page stacks three control bands.** The header (title, facts, description,
summary), then `.pbl-rel-actions`, then the tree's own toolbar. The middle one is a strip
of two buttons in otherwise empty space, and it is right-aligned by accident: `.pbl-rel-actions`
is also the class `renderIndex.ts` gives the index's head, `styles/release.css` styles that
one with `justify-content: flex-end`, and `styles/releaseScope.css` — imported after it —
restates neither that nor the padding. The scope screen inherits an alignment written for a
different component.

**`Set released date` and `Mark as released` are two controls for one field.** The header's
control writes only the date; the new action writes the status and the date together. Both
sit on one screen, and the header's was renamed away from `Mark as released` on 2026-08-29
precisely because the collision was already uncomfortable ([[Editing a release from its own
screen]] extension 6a). Two controls under two names for one property is worse than a field
named as a field.

**A withheld action's sentence captions the wrong button.** `.pbl-rel-actions` is a
horizontal flex row, and a refusal replaces its own button *in place* — so with membership
unbound the screen reads `[Mark as released]  To generate release notes, bind the release
membership property.`, which puts a sentence about generation immediately right of the
marking button. The unreadable-status screen has the same shape with the halves swapped.
The sentences name their own action, so nothing is untrue; the layout invites the wrong
reading anyway.

## What changes

### The header's last line

`.pbl-rel-header` keeps three children, and the third one changes: `.pbl-rel-footline`
takes the position `.pbl-rel-summary` held, with the summary strip moving INSIDE it on the
left and the action area on the right. The header is the hline, the description and the
footline. The band between the header and the toolbar is gone, and the header becomes one
bordered block holding everything that is about the release rather than about the tree.

**Read that as a replacement, not an addition** — it said "gains a fourth child" until
2026-08-30 (found by review, Codex, PR #221), which contradicts the layout below it and
invites an implementer to keep the old summary child beside the footline or draw it twice.
`drawSummary` does not stay where it is; it is passed the footline instead of the header.

That division is the codebase's own, already stated at `drawOpenNote`:

> Beside the title rather than in the toolbar below it: the toolbar's three controls are
> about the TREE (fold it, fold it back, hide what is finished), and this one is about the
> release the title names.

Both actions are about the release. They belong on the same side of that line as the open
control, and `drawReleaseActions` moves inside `drawHeader` to say so structurally.

**That move also retires a comment.** `renderScope` today calls `drawReleaseActions` above
the two empty-state returns and explains in a comment why it must stay there — the
empty-scope screen is the only place [[Generating the release notes]] extension 1a can be
exercised at all. Drawn inside the header, which every screen draws first, the ordering is
a property of the tree rather than a rule somebody must not break. The comment goes; the
test that holds it does not.

`.pbl-rel-footline` is a wrapping flex row. The summary takes `flex: 1 1 22em` — a basis
wide enough that the ACTIONS wrap first, so the summary never splits `33%` from
`1 of 3 items done` across two lines. Measured at 560px in the harness: the actions drop to
their own line intact and the summary stays whole.

### The released date is the control

> **Corrected on 2026-08-30, after implementation.** This section's premise was false:
> `Mark as released` does not cover every bound-and-empty released date. `closeOffer` gates
> on `missing.length === 0 && unreadable === null && !alreadyOut && dateFree` — four
> conjuncts, of which `dateFree` is only the last — so a missing closing option, an
> unreadable status, or a release already marked released each leave the field bound and
> empty with `Mark as released` withheld. Retiring the invitation in those three states
> would have removed the only route to the field. What shipped keeps the invitation exactly
> there: `release.scope.markReleased` and `button.pbl-rel-released-unset` both survive.
> Recorded here rather than silently patched — the ruling is in the SDD ledger for
> `docs/superpowers/plans/2026-08-30-release-detail-header.md`.

`drawReleased` stops drawing a labelled button unconditionally and starts drawing the value
as the button, falling back to the invitation only where the header's own action cannot
cover the field:

- **A date exists** — `Released 2026-06-18`, a real `<button>` opening the same
  `SchedulePromptModal` `editReleaseReleased` opens today. Clearing, correcting and
  backdating all survive unchanged, because the dialog is unchanged.
- **The key is unconfigured, or the value unreadable** — exactly as today (nothing, and the
  `.pbl-rel-unreadable` marker respectively).
- **The key is bound, the value absent, and `Mark as released` is offered** — nothing is
  drawn. The footline's button is the one-press path to this field.
- **The key is bound, the value absent, and `Mark as released` is withheld** — the
  `pbl-rel-released-unset` invitation draws, same as today. This is the field's only
  remaining route in the three states `closeOffer` refuses: a missing closing option, an
  unreadable status, or a status already reading as released.

The rule for the first of those four cases is already this header's own, stated at
`drawFigure`'s target-date caller: an absent target date draws nothing here. What is new is
that the released date now follows that rule ONLY when the footline covers the field —
gated on `closeOffer(release, view.settings).offered`, not on absence alone.

**Accepted cost, stated rather than hidden — narrower than first drafted.** Where
`Mark as released` is offered, setting a released date *without* also writing the status is
no longer reachable in one step: press `Mark as released` (which writes both), then click
the date to correct it. That two-press cost is real, but it is not universal — in the three
states the closing action is withheld, the invitation is still the one-press path to the
date, unchanged from today. The price of one control per field is paid only where the
footline's control exists to pay it.

### Refusals get their own line

`.pbl-rel-actions-note` becomes `flex: 1 0 100%` inside the action area. A refusal can then
only be read as its own statement, never as a caption on the button beside it. Buttons keep
the row; sentences take a line of their own, in the order the actions are drawn.

Nothing about *which* refusals appear, or their text, changes.

### The layout leak, not the class

`.pbl-rel-actions` stays on both areas, and that is deliberate: `syncBusy` disables
`.pbl-rel-actions button` while the plugin-wide lock is held, and that is correct for the
index's `New release` as much as for the closing actions — a note created during a sibling
view's batch acts on a stale model the same way. The class means "an action area, disabled
while a write is in flight", and both areas are one.

What is not shared is layout. The scope's area gains `.pbl-rel-scope-actions`, and
`styles/releaseScope.css` states its own alignment, padding and wrapping there rather than
inheriting `styles/release.css`'s. Neither partial's import position becomes load-bearing,
because the scope's rules are spelled `.pbl-rel-actions.pbl-rel-scope-actions` — a compound
on one element at (0,2,0), against `release.css`'s bare `.pbl-rel-actions` at (0,1,0), so it
wins on specificity rather than on order. The modifier class ALONE would be (0,1,0) and tie,
which is the shape this repository has already shipped as a defect twice
([[Four other controls still lose to Obsidian's button rule]]).

### ✨ binds the three options that are not properties

`runReleaseInit` today binds seven suggested PROPERTY keys through `adoptCandidates`,
collision-checked against every key the config declares. The closing actions need three
options that are not properties and so reach none of that machinery:

| Option | Bound to |
| --- | --- |
| `releaseNotesFolder` | `docs/release-notes` — the option's own placeholder |
| `releasedStatusValues` | `Released` |
| `releasedTransitionValue` | the FIRST of the effective released values |

**The folder binds the option's own `placeholder`, which is the rule the seven property
candidates already follow**: `versionProperty` suggests `version` and places `version`,
`releasedDateProperty` suggests and places `released`, and so on for all seven. A
placeholder is where this codebase already writes down what it would pick, so ✨ picking
anything else would be the plugin holding two opinions about one option. That is also why
the notes folder is not derived from `defaultTypeFolder(RELEASE_TYPE)` (`docs/releases`):
the option's placeholder already says `docs/release-notes`, and deriving a second answer
beside it is the drift this rule avoids.

**The vocabulary must NOT follow that rule, and this is the trap.**
`releasedStatusValues`' placeholder is `t('release.option.releasedValuesHint')` — the
string `Released, Archived`, in the translation catalog. Binding a placeholder that comes
from `en.ts` would make ✨ write the CATALOG's language into the `.base`, so a reader on a
German Obsidian would bind German status words, write them onto release notes, and hand a
vault whose releases an English reader's view reports as not-released. That is the root
guide's own test — "one sees different words" is text, "one writes notes the other's view
cannot read" is data — and it lands on the wrong side.

The hint is legitimate where it is: a placeholder is drawn and never written, so translating
an EXAMPLE of what to type is display. What must not happen is a bound value sourced from
it. So `releasedStatusValues` binds a new `DEFAULT_RELEASED_VALUES` in `domain/`, beside
`DEFAULT_DONE_VALUES` and `DEFAULT_HORIZON_VALUES`, which are the two shipped vocabularies
this codebase already keeps out of the catalog for exactly this reason. `docs/release-notes`
is not affected: that placeholder is a literal in `releaseOptions.ts`, not a `t()` call.

A second sweep, not a widened first one. The three name no property, so there is no key for
`taken` to guard and no collision to report; what they share with the seven is the *only*
rule that applies to them — `config.get(option) !== undefined` means the reader has touched
it, and a touched option is never overwritten. Cleared is not untouched, exactly as
`adoptCandidates` documents.

**`releasedTransitionValue` reads the list rather than restating the literal.** `configProblems`
refuses a transition value that is not one of the released values, so binding both to
`Released` independently would be two statements that must agree. It binds to the first of
whatever `releasedValues` resolves to *after* this press — the reader's own list where they
have one, `Released` where this press supplied it — and the invariant holds by construction.

**This contradicts two stated decisions, and the contradiction is the interesting part.**
`ReleaseSettings.notesFolder` says "with no default: the action does not choose a folder on
the reader's behalf", and `releaseStatusValues` says shipping a vocabulary "would put this
plugin's guess in every vault's `.base` the first time somebody opened the options panel".
Both objections are to a `default:`, which Bases resolves silently for every vault that never
asked. ✨ is a press. `init.ts` already draws exactly this distinction to admit
`membershipProperty`, over a comment that reads at first as forbidding it:

> That comment is about the RESOLVER's own silent read on every data update; this is an
> explicit action the reader pressed.

Same argument, same conclusion. Neither option gains a `default:`; the options panel still
opens empty in a vault that never pressed ✨.

`releaseNotesFolder` is a folder and so cannot be offered by Obsidian's property picker at
all — which is why `Generate release notes` was undrawable in the browser harness until
`mountRelease.ts` bound it by hand. ✨ is the only control that can bind it.

## Where it lives

- `src/view/release/renderScope.ts` — `drawHeader` gains the footline and calls
  `drawReleaseActions`; `drawReleased` draws the value as the control and draws nothing
  when the key is bound and empty — but only where `closeOffer(...).offered` is true;
  where it is false, the `pbl-rel-released-unset` invitation still draws (corrected
  2026-08-30, see "The released date is the control" above).
- `src/view/release/releaseClose.ts` — `drawReleaseActions` takes the footline as its
  parent and marks its area `.pbl-rel-scope-actions`; nothing about its two gates changes.
- `src/view/release/init.ts` — `RELEASE_SUGGESTED_VALUES`, the non-property candidates, and
  the second sweep in `runReleaseInit` that binds them.
- `src/domain/settings.ts` — `DEFAULT_RELEASED_VALUES`, the shipped released vocabulary,
  beside the two constants that already exist for the same reason.
- `src/view/release/releaseView.ts` — `syncBusy`'s selector is unchanged; its comment gains
  the sentence saying the shared class is what makes it cover both areas.
- `src/i18n/en.ts` — `release.scope.markReleased` survives (corrected 2026-08-30): it is
  still the invitation's label in the three states `Mark as released` cannot cover.
- `styles/releaseScope.css` — `.pbl-rel-footline`, `.pbl-rel-scope-actions`, the note's own
  full-width line; `button.pbl-rel-released-unset` survives for the same reason.

## Testing

Each of these was watched failing in the harness before it was written down, and each gets a
test that fails without it:

- **The released date draws nothing when bound and empty AND `Mark as released` is
  offered**, and draws the invitation in the three states it is withheld (corrected
  2026-08-30: not unconditional on absence — `closeOffer` is the gate). New file
  `test/view/release/releaseHeader.test.ts`, not `releaseEdits.test.ts`: that file is
  already at lint's 450-line budget with no headroom for these cases.
- **`Mark as released` is still offered on exactly the release that draws nothing**, so
  narrowing the invitation loses no path there; and the invitation still draws — with its
  `markReleased` label — on a release already marked released, the case `Mark as released`
  cannot reach. Both asserted in `releaseHeader.test.ts` against one fixture each, so a
  future change cannot remove the invitation and the offer together without a visible
  failure.
- **The actions are inside the header**, so both empty-state screens still draw them —
  the nine tests [[Generating the release notes]] extension 1a already turns red are the
  guard, and they must go on passing with the call moved rather than be edited to match.
- **A refusal takes a full-width line.** A partial-shape check in the style of
  `test/view/release/rowChrome.test.ts`, which is honest about being narrower than the
  claim: jsdom computes no layout, so what is checked is that the partial still declares
  it.
- **✨ binds the three, and never overwrites a touched one.** `test/view/release/init.test.ts`
  — one case per option for the untouched path, and one asserting a reader's own folder and
  vocabulary survive a press. The transition case must be driven against a config whose
  `releasedStatusValues` is ALREADY set to something else, since binding the literal
  `Released` there is the defect this rule exists to prevent and a fixture using `Released`
  cannot see it.
- **No bound value comes from the catalog.** `test/i18n/` already marks the whole catalog
  and asserts that what renders unmarked is data; the sibling claim here is the reverse —
  a test that `releasedStatusValues` after a press equals `DEFAULT_RELEASED_VALUES` and not
  `t('release.option.releasedValuesHint')`, which fails the moment somebody "simplifies" the
  sweep by reading placeholders uniformly.
- **A press leaves `configProblems` empty.** The end-to-end assertion that matters: after
  ✨ on an untouched config, `Mark as released` and `Generate release notes` are both
  offered. That is the promise of the press, and it is one test rather than five.

## Verification

`npm run harness -- test/harness/release.ts` draws every case above at Obsidian's default
colours, and `?pick=` reaches each release. The confirmation dialog still needs a scratch
`mock.ts` that presses the button — see
[[A confirm dialog's member rows paint as Obsidian buttons]], whose whole cause was that
nothing committed could draw it.

**A live vault is owed and this design does not discharge it.** The footline's spacing
against a themed vault's own metrics, and whether the dotted underline on the released date
reads as editable against a theme's accent, are the two questions the harness cannot answer.
They join the checklist [[Shipping a release]] and [[Release notes from its own scope]]
already carry.

## What this does not do

- **No new write, and no change to any existing one.** Every batch, gate and refusal is as
  shipped.
- **No default for either new option.** Only ✨ binds them; a vault that never presses it
  sees the same empty boxes it sees today.
- **The header does not gain an overflow menu.** Three controls beside the title (back,
  open, status) plus two facts is not yet a crowd, and a menu is a control pattern this
  view does not use — worth introducing when a sixth arrives, not for this.
- **The summary strip does not move into the title row.** It was considered and declined:
  it costs the description its own full-width line, and a wrapped description under a
  wrapped facts row is the layout this header already got wrong once.
