---
type: PBI
parent: "[[Multilang]]"
order: 40
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Every surface translated

The sweep: every English literal outside the view options moves into the catalog. Roughly
90 sites over ten files — the toolbar, the tree, the empty states, the menus, the modals
and every notice.

`View options and config warnings` is deliberately not here. It is the one surface where
text sits on adjacent lines to keys that must not move, and it carries a domain-layer
change with it, so it is reviewed on its own.


**As** someone using the plugin in another language, **I want** every label, tooltip and
notice to come from the catalog, **so that** the view does not read as half-translated —
which is worse than not translated at all.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone using the view in a non-English Obsidian |
| **Trigger** | Any rendered surface: the toolbar, a row, a menu, a modal, a notice |
| **Preconditions** | The catalog and the locale layer exist |
| **Guarantee** | Nothing the view *does* changes. This is a text move: the same rows, the same menu items in the same order, the same writes. |

**Main flow**

1. A developer works through one surface at a time, moving each literal to a key.
2. Screen-reader text moves with the visible text — `aria-label` and tooltips are UI text.
3. Values the user owns stay as they are: titles, tags, state names, file names.
4. The surface renders from the catalog.

**Extensions**

- **1a — the string names a view option.** It quotes the *translated* option label, so the
  sentence points at a control the user can find. **Ten catalog keys quote ten distinct
  option labels** today, not the two this line claimed — counted 2026-08-21 by matching
  every `option.*` value against the rest of the catalog, an instrument that reads the
  labels from the catalog rather than from a list and so cannot go stale by wording. It
  became possible that day and not before: `View options and config warnings` moved those
  labels into the catalog, so a sentence can take one as a parameter instead of spelling it
  a second time. Until it does, a copy edit to an option's name leaves ten sentences
  pointing at a control that no longer reads that way, and a translator has to spell each
  label identically in two places.
- **1b — the string is withheld for a context row.** It stays withheld. `Set type`,
  `Set state` and the parent-link actions are *absent* for an `outsideFilter` row, not
  translated and disabled.
- **2a — the surface is a modal detail line.** It stays a function of the chosen type, so
  it is still true at the moment of confirming, and it stops sentence-casing its own first
  character — the capitalized form belongs in the message.
- **3a — the value is interpolated into a sentence.** The sentence is one key with the
  value as a parameter, never a translated word glued to a data value.
- **4a — the surface is the busy chip.** Its 250 ms `animation-delay` behaviour is
  unchanged; a text move must not read as a flicker regression.

## What is here

**Toolbar** (`toolbar.ts`, 23 sites) — the `New <type>` button and its type picker, the
tooltips on every icon control (`Assign missing type and order properties`, `Undo last
change`, `Expand all`, `Collapse all` — the second of those retitled 2026-08-21 after the
slot it empties, which is vault-wide rather than this view's), the `Grouping ignored` advisory and its
explanation, the `Check view options` warning, the item count, and the busy chip's
`Updating N of M…`.

**Rows** (`rows.ts`, 11 sites) — the orphan marker (`Parent is set but not part of this
view`), the context-row marker (`Not in this base's filter — shown to keep the
hierarchy`), the badge tooltip for an implied type, and the add-child button's
`aria-label`.

**Columns** (`columns.ts`, 20 sites) — the `Progress` / `Items` header, the tag pills'
`Add tag` and `Remove tag <tag>` labels, the rollup tooltip `N of M items done`, and the
state chip's `Set state` / `Change state (currently <value>)`. The chip's static form for
a context row carries its own message (`state can't be changed here`).

**Empty states** (`emptyStates.ts`, 8 sites) — `Loading backlog…`, `No <type> items` with
its hint, the no-match state and `Clear filter`, and the all-done state with `Show
completed items`.

**Context menu** (`menu.ts`, 16 sites) — `Open in new tab`, `Open to the right`, `Clear
parent link`, `Use folder position`, the four move commands, `Outdent`, and the three
submenus `Set state`, `Edit tags`, `Set type`.

**Modals** (`ui/prompts.ts`, 13 sites) — the new-item modal's `Type`, `Title` and `Folder`
settings, the `Create` button, the example placeholders (`Item title`, `Backlog`,
`Sprint-12`), the `Add tag` title, and the detail line saying where the item will land.

**Notices** — all 14, including the filter refusal (`That change would edit a note
outside this base's filter, so nothing was written.`), `Still applying the previous
change — try again in a moment.`, `Nothing to undo.`, the undo summary assembled from
parts in `undo.ts:94-99`, and the two `See the developer console for details.` failures.

**Command and view names** (`main.ts`) — the `Create backlog` command and the
`Product Backlog` view name passed to `registerBasesView`. Resolved once at `onload`,
which is correct: Obsidian needs a restart to change language.

## Acceptance criteria

- Every `aria-label`, `setTooltip` and visible label on these files comes from the
  catalog. Screen-reader text is UI text; leaving it English translates the view for
  sighted users only.
- The sentences that name a view option by its label quote the **translated** label, so
  the text points at a control the user can find. Two of them spell *"Ignore notes
  outside the hierarchy"* as a literal today (`emptyStates.ts:50`, `toolbar.ts:140`);
  afterwards it is one parameter from one key.
- The menu's item order and its withheld-for-context-row set are unchanged — `Set type`,
  `Set state` and the parent-link actions stay *absent* for an `outsideFilter` row, not
  translated-but-disabled. `test/view/contextRowWrites.test.ts` passes untouched.
- The new-item modal's detail line stays *true* at the moment of confirming: it is a
  function of the chosen type, and translating it must not turn it back into a fixed
  string. `test/view/creation.test.ts` already guards this.
- The undo summary is one message per outcome, not translated fragments joined with
  `'; '`. It has two counted clauses today, both with inline plural ternaries.
- `Updating N of M…` keeps its 250 ms `animation-delay` behaviour. The busy chip is the
  one place a text change could be mistaken for a flicker regression.
- Interpolated **values** stay as the user wrote them: the state name in `Change state
  (currently <value>)`, the tag in `Remove tag <tag>`, the title in the truncation
  tooltip, and any file name a notice quotes.
- The plugin name is not translated — Obsidian prefixes command names with it in the
  palette, and it is the plugin's identity in the community list.
- The modal's detail line stops capitalizing its own first character. `create.ts:92` does
  `${where[0].toUpperCase()}${where.substring(1)}` to sentence-case a fragment it built —
  which is wrong once the fragment comes from the catalog, since the capitalized form
  belongs *in* the message and not every script has case at all.
- No behaviour changes. This is a text move; anything else found on the way is its own
  note.

## What has been swept

**`ui/` and `commands/`, on 2026-08-19.** Both directories are done: 32 keys, taking the
catalog to 82, and the two lint bans below now hold them. What went in was wider than the
count this note was planned from — the measurement it used could not see a double-quoted
`setDesc`, a template-literal tooltip, or a label handed to a local `field()` helper, so
`ui/prompts.ts` gave 18 sites rather than the 13 tabulated above. Re-derive before planning
the next directory; the tables here are the shape of the answer, not the answer.

**Both of those numbers were first written wrong, and the same way.** This section said 30
keys and 19 sites — a count of the diff's added lines, which includes a key's continuation
line, and a grep for the setter names, which counts the four `setText('')` that clear a
field and spell nothing. Neither was checked a second way. The counts above were taken by
two instruments that agree (a tab-aware pattern and a parse of the object), which is the
standard `CLAUDE.md` sets for a measurement used as evidence and which the paragraph
warning about instruments did not meet.

Three things are deliberately NOT in the catalog after that sweep:

- **The manual dialog's nav heading**, `Product Backlog`. It is the plugin's own name, which
  the criteria above say is not translated. The dialog's TITLE beside it — `Product backlog
  manual` — is a sentence about the plugin and did move.
- **Every heading and description these dialogs are HANDED.** `ui/` takes them from its
  callers, which are in `view/` and unswept; a key here would be keying somebody else's
  string.
- **The configuration problems themselves.** `readme.configProblems` is one key with the
  list as a parameter, joined by `Intl.ListFormat`; what it joins is still English until
  `View options and config warnings` runs.

The one thing in those two directories that is not a pure text move is punctuation:
`Fix the view configuration first: …` joined its problems with `'; '` and then added a
period, so it rendered `"…".; "…"..`. The key has no terminal period and the list is joined
as grammar.

**That is better rather than finished, and the remainder is stated so nobody reads it as
closed.** What the list joins are complete sentences that end in periods, so one problem
reads correctly and two read `… is unset. and The B property is unset.` — a full stop in
front of a conjunction. The fix is not on this side of the boundary: it needs the problems
to be FRAGMENTS, and they are `domain/`'s, still English and still shaped for the other
places that show them. Whoever runs `View options and config warnings` is translating those
strings anyway and should decide their shape then; keying a fragment here first would key
somebody else's string, which the bullet above already refuses for headings.

**`view/render/emptyStates.ts`, on 2026-08-20.** 25 keys, taking the catalog to 107 —
measured by asking the loaded module for `Object.keys(en).length` before and after, and
agreeing with a count of the diff's added key lines. A third instrument, an AST walk for
the catalog object's own properties, returned **0**, because `en` is declared `as const`
and its initializer is therefore not an object literal. It was discarded rather than
reconciled: a count of zero from an instrument is the instrument being broken. What
the view says when it has nothing to show: the empty tree and its focused form, the empty
test catalog, both boards' no-workflow guidance, the excluded-focus state, the empty
Deliverables board and iteration, the roadmap with no axis, the all-done notice, and the
setup call to action all three guidance frames share.

Three things about that slice are worth carrying to the next one.

**The measurement had to be rebuilt, and the tables above are why.** Every instrument this
note's numbers came from returns approximately ZERO for `view/render/` — the directory
reaches the DOM through `createDiv`/`createEl` option bags, so it spells no `setName`, no
`setTooltip` and no `new Notice` at all. A count near zero from a setter grep is a broken
instrument, never a swept directory. What replaced it was a TypeScript AST walk over every
string and template literal in a file, filtered to what reads as prose, calibrated against
`ui/prompts.ts` — a file known to be swept, which it reports as 0. On that instrument
`view/render/` holds **321** prose literals across 25 files, against the 72 + 34 the two
narrow greps saw for all of `view/`. The instrument counts a concatenated sentence's
FRAGMENTS, so it over-reports keys and under-reports nothing: `emptyStates.ts` gave 43
literals, from which it projected 22 keys.

**The sweep produced 24, and the 22 above is kept as what the instrument PREDICTED rather
than corrected to match.** The two are different quantities — a projection made before the
work and a count taken after it — and the gap between them is the calibration this note
projects onto the rest of `view/`: about a tenth low, because a sentence assembled from
fragments can collapse to one key or split into two and the walk cannot tell which. Read
the 321 above with that margin on it, and re-derive rather than trust either number.

**The lint half is narrower here than in `ui/` and `commands/`, and it had to be a
different rule.** `UI_TEXT_LITERAL` sees setter calls and `new Notice`; this file spells
neither, so extending it here would have banned nothing. `UI_TEXT_PROPERTY` beside it
covers the `text:`, `label:`, `title:` and `'aria-label':` properties the module does use —
the first of the three shapes `UI_TEXT_LITERAL`'s own comment states it cannot see, banned
here because the one live instance that keeps it out of that rule (`ui/manualDialog.ts`'s
plugin name) is in another directory. It is scoped to this one file, carved out of `RENDER`
the way `RENDER_BOARD` is, because the rest of the directory is unswept and a ban ahead of
its sweep is a ban somebody switches off. What neither rule reaches is the module's
commonest shape: a prose literal handed to `guidanceShell` as a positional argument.
`test/i18n/emptyStates.test.ts` holds that one, by asserting that every string a frame drew
carries the fixture catalog's marker rather than by naming the selectors somebody
remembered — a revert of the manual link's label, which no named assertion covers, was
watched failing it.

**The second acceptance criterion is now owed at six sites rather than two, and it is not
this note's to pay.** Four of the keys added here quote a view option by its label —
*"State property"*, *"Workflow states (in order)"*, *"Deliverable state property"*,
*"Deliverable workflow states (in order)"* — spelled as English inside the sentence, which
is exactly what `emptyState.ignored` and `toolbar.ignoredTooltip` already do with *"Ignore
notes outside the hierarchy"*. Making them one parameter from one key means the LABEL needs
a key, and the labels are `domain/viewOptions.ts`'s: keying them here would be keying
somebody else's string, which the `ui/` sweep above already refuses for headings. Whoever
runs [[View options and config warnings]] is translating those labels anyway and should
take all six then.

**The menu surface, on 2026-08-20.** 50 keys, taking the catalog to 157 — `menu.ts`,
`shelfMenu.ts`, `columnMenu.ts`, and the two submenu builders `menu.ts` delegates to,
`tags.ts` and `labels.ts`. Measured twice and after the last edit: `Object.keys(en).length`
before and after (107 to 157), agreeing with a count of the diff's added key lines. All 50
are one namespace, `menu.*`, which is what lets the runtime half compute its own swept list
by prefix instead of keeping one by hand.

`view/interactions/` is NOT finished, and the split was taken rather than found. The AST
instrument reports 146 prose literals in that directory, against the 73 two narrow greps
saw — and 13 of the 146 are false positives in `keyboard.ts` and `resizeDrag.ts`, which
spell `'Escape'`, `'Home'` and `'End'` as `event.key` comparisons and must never be keyed.
Sweeping the ~133 that remain is roughly a hundred keys and restructures five assembled
sentences, which is two reviewable pull requests rather than one. This slice is the menus;
what is left is `create.ts`, `absences.ts`, `dependencies.ts`, `plan.ts`, `structure.ts`
and the drag modules, and it carries every assembled sentence in the directory —
`runInit`'s outcome notice in `structure.ts` above all, whose OUTER sentence is built from
parts, so keying the fragment alone would commit the defect one level up.

Four things about this slice are worth carrying to the next one.

**Four keys were REUSED rather than minted, and that is this slice's own finding.**
`columnMenu.ts` needed `Expand {name}` / `Collapse {name}`, which `fold.expandColumn` and
`fold.collapseColumn` already held for the column HEADER's disclosure; `shelfMenu.ts`
needed `Search unplaced` and `Clear unplaced search`, which `shelf.search` and
`shelf.clearSearch` already held for the shelf header's own box. Each pair is two surfaces
over one action, and `src/view/CLAUDE.md` states the rule those have already come apart on
twice — not "does it say the same thing" but "is it offered exactly when the first one is",
with the answer somewhere both read. A second key is exactly a place for them to disagree.
That is not the same as the catalog's no-deduplication rule, which refuses MERGING two keys
that happen to share English: `menu.searchUnplaced` is a separate key from `shelf.search`
for that reason, because a menu entry promising a dialog and a box's own label are two
things that happen to read alike.

**The runtime half asks the CATEGORY, and that is what a menu needs.** A menu is a list, so
naming the entries checks the ones somebody remembered and not the next one added.
`test/i18n/menus.test.ts` drains every title each surface draws — through submenus — and
asserts that the unmarked remainder is exactly the DATA the menu lists, in two lists that
mean opposite things: `DATA` (the type ladder, the states, the risk and priority rungs, the
assignee, the iterations, the horizon buckets, the tags) must never shrink, and `UNSWEPT`
(`Clear horizon` from `plan.ts`, `Depends on…` from `dependencies.ts`) must reach empty.
Sweeping either of those files fails the test, which is the point — the entry is deleted in
the same change that keys the string.

**Its swept list is computed against `en.ts`, and its audit had a bug worth stating.** The
list is `Object.keys(en).filter(k => k.startsWith('menu.'))` plus the four reused keys named
explicitly, so a key added to the namespace joins it with nobody editing anything. The audit
beside it then asks which of those keys was watched reaching a surface — and its first form
compared the catalog's raw TEMPLATE against the rendered string, so every parameterised key
read as missing while all of them were on screen. It matches the template as a pattern now,
`{name}` standing for whatever the vault put there. Three keys are genuinely unreached and
are named in the assertion rather than counted: `menu.useFolderPosition`, `menu.openChild`
and `menu.clearTestState` each need a state no fixture in the file is in, and all three are
`setTitle` calls, which is a spelling `UI_TEXT_LITERAL` reads.

**The lint half is both bans, and the gap it leaves is one this directory creates.** These
files spell `setTitle` and `new Notice`, so `UI_TEXT_LITERAL` holds them where it held
nothing in `view/render/`; they also reach `ValuePromptModal` through an option bag, so
`UI_TEXT_PROPERTY` catches `title:`. What NEITHER rule names is the other three properties
of that same bag — `fieldName:`, `placeholder:` and `ctaLabel:` — and a literal at any of
them fails no rule. That was watched: reverting `ctaLabel: t('menu.assignCta')` to `'Assign'`
produces zero lint errors and fails `test/i18n/menus.test.ts`. Those three prompts are the
part of the test that is load-bearing rather than belt-and-braces, and the ORDER was kept as
both prior slices kept it — sweep, then ban.

**The remaining English is the rest of `view/` and `domain/`.** By the AST instrument
above: **299** in `view/render/` after this slice, 146 in `view/interactions/` by a later run of the same walk (13 of them `event.key` names, and about 52 of the rest swept by the menu slice above), 345 in
`view/manual/` — a body of long-form prose no table in this note has ever counted, and its
own question rather than an oversight — 19 in the rest of `view/`, and 349 in `domain/`, of
which 60 are `domain/viewOptions.ts` and 186 the generated README in
`domain/backlogReadme.ts`, which is written INTO the vault and so is a data question before
it is a text one. `viewOptions.ts` is [[View options and config warnings]] and not this
note.

**`view/interactions/`, WHOLE, on 2026-08-20.** The menu surface first, then the prompts,
the notices and the backfill's outcome: 47 sites and 47 keys, taking the catalog to 202.
Both text bans now cover every file in the directory — `create.ts` repeats them in its own
block rather than inheriting, because two flat-config blocks matching one file OVERRIDE
`no-restricted-syntax` rather than merge, which would silently drop whichever set lost.

**Most of this slice was invisible to both bans, and fixing THAT was the finding.** The
prompts take their heading, description, placeholder and call to action as an OPTION BAG,
and `UI_TEXT_PROPERTY` read only `title:` of the four — so a literal at `heading:`,
`description:`, `placeholder:` or `cta:` failed no rule anywhere in the plugin. Verified by
planting, which is also how the scale of it showed: for this whole directory the runtime
half was holding the sweep and lint was decoration, while the register called the two a
pair.

The selector was widened to name those properties rather than the gap being written down
and left (2026-08-20). Planting at each name now errors, and the swept tree stays clean, so
the widening cost no exemption — with one deliberate line: `ui/manualDialog.ts`'s nav
heading is the plugin's own NAME, and it carries an `eslint-disable-next-line` rather than
a carve-out of the file, so a second literal added to that dialog still fails. Extending
the same ban to `ui/` and `commands/`, which had only ever carried the literal one, found
that single site and nothing else.

What lint still cannot tell is whether a key is READ — a call site passing the wrong key
renders the wrong sentence with every rule green — and that is what keeps the runtime half
necessary rather than redundant.

The narrow greps that planned this slice saw 34 sites until `placeholder:` was added to the
pattern, and then 47 — the fourth time in this epic a count was short because the
instrument could not see a shape.

**Two assembled sentences were the other half.** `runInit`'s outcome was
`` `Product Backlog: ${list(done)}.${next}` `` — a template frame around keyed fragments,
which passes every rule and leaves the sentence in English. It is now two WHOLE keys
picked between (`init.outcome` / `init.outcomeWithColumns`), the shape
`emptyState.noAxisBody` and its half-set sibling already use. The undo report was
`` `Undo: ${parts.join('; ')}.` `` and is now one key whose parts are joined by `list()`,
so the joining follows the catalog's grammar rather than a hardcoded `'; '`.

**The toolbar, WHOLE, on 2026-08-20.** 59 keys, taking the catalog to 261 — `toolbar.ts`,
`toolbarControls.ts`, `toolbarBusy.ts`, `toolbarFit.ts` and `toolbarStatus.ts`. Measured
twice and after the last edit: `Object.keys(en).length` before and after (202 to 261),
agreeing with a count of the diff's added key lines (59). A third instrument — a pattern
over `en.ts`'s own text — reported 176 for the file it was pointed at and was discarded
rather than reconciled, the way the AST walk's zero was: an instrument that cannot see a
plural entry's two lines is broken, not a second opinion.

The five files are one subject rather than the two the handoff cut this slice at. The
other three carried one site each — the busy indicator's manual link, the breakdown's
`Untyped` fallback and its `{count} {type}` reading — and leaving them would have meant a
ban region that named two files while the row it governs is five.

Four things about this slice are worth carrying to the next one.

**The AST instrument was rebuilt again, and it does not agree with the last run of it.**
This one reports **136** prose literals in `view/render/` where the figure carried above is
299, and 69 across the toolbar's five files. It is not the same instrument: the filter here
refuses a lone lowercase word, a `kebab-case` token and anything holding a slash, so it
counts sentences where the earlier one counted fragments. Neither number is wrong and
neither should be quoted as the remainder — what both agree on is the SHAPE the tables at
the top of this note get wrong, which is that a setter grep sees 31 here. Calibrated
against three swept files it reports 0, 0 and 0, and its residue on the swept toolbar is
six CSS class strings and one selector. Re-derive again rather than trusting either
figure; that is now the third time this note has said so and the second time the
instrument was rebuilt to say it.

**A comment stating a rule the code beside it breaks, found by writing the check.**
`renderModeToggle` says each switcher WORD is a substring of its own label, so the visible
text sits inside the accessible name — what speech control needs to match what a reader can
see. English has never met it: `Tree` is `tree` in `Show as backlog tree`, and `Tests` is
not in `Show as test catalog` at all. `test/i18n/toolbar.test.ts` asks it case-insensitively
and NAMES the catalog position as the one that fails, so keying a fifth position or
rewording that label fails there rather than quietly joining the exception. Not fixed here:
the fix is a wording change and this slice is a text move, so it is recorded and owed.

**`UI_TEXT_LITERAL` could not see this directory at all, and the fix was one spelling.**
Its selector read `setTooltip` as a METHOD, and the `obsidian` export of that name is a free
function taking the element — which is how every module under `view/render/` calls it. So
the rule that "holds the toolbar" would have held nothing in it: verified by planting
`setTooltip(btn, 'Timeline zoom')` in a banned file and watching lint pass. The selector now
names the bare call beside the method one, planting errors, and the whole swept tree stays
clean, so the widening cost no exemption. What it still cannot reach is the row's commonest
shape — a prose literal handed to `iconButton`, `menuButton` or `collapseButton` as a
positional ARGUMENT — and that was watched too: reverting `t('toolbar.jumpToToday')` to its
literal produces zero lint errors and fails `test/i18n/toolbar.test.ts` twice.

**The consolidation was considered and DEFERRED, deliberately rather than by drift.** One
check marking the whole catalog and reporting what renders unmarked would replace four
fixture lists — but its expected-unmarked set would have to enumerate every English string
still left in `view/manual/`, `domain/` and `main.ts`, and that list rots on every slice,
which is the rot the consolidation exists to remove. It is the check to build once the
sweep is FINISHED, when the expected remainder is data alone. Until then this is a fifth
per-slice file, computing its own swept list from the `toolbar.*` prefix the way
`menus.test.ts` does, with one reused key (`count.items`) named explicitly because a prefix
filter cannot find it.

Its audit names four keys it does not drive rather than counting them. Three are the busy
indicator's and need a write in FLIGHT, which `test/view/toolbar.test.ts` already drives
under English. The fourth is a finding: `toolbar.untyped` is `levelBreakdown`'s fallback for
a note whose type it cannot read, and no fixture reaches it — `displayType` answers `''`
only for an item on no rung of the ladder that also carries no type name, and every shape
tried lands on one or the other. The fallback predates this slice and whether anything can
still reach it is a question about the model rather than about the sweep.

**`view/estimation/`, WHOLE — the keys on 2026-08-20, the BAN on 2026-08-21.** 36 keys,
taking the catalog to 297. The two halves landed a day apart, and the gap is the finding
worth carrying: the Estimation view's UX polish pass swept the directory into the catalog
and did NOT add it to `UI_TEXT_LITERAL` / `UI_TEXT_PROPERTY`, so for a day the directory
was clean by habit with nothing refusing the next literal. The order this note states is
"a ban ahead of its sweep is a ban somebody switches off"; the inverse — a sweep with no
ban behind it — has no such name and is what happened here.

Its region is a GLOB (`ESTIMATION` in `eslint.config.mjs`) where `MENU_SWEPT` and
`RENDER_TOOLBAR` are file lists, and the difference is not a preference: those two share
their directories with unswept siblings, and a second flat-config block matching one file
OVERRIDES `no-restricted-syntax` rather than merging with it. Nothing under
`view/estimation/` is unswept and no file in it carries a rule set of its own, so the glob
covers a file ADDED there — which is what the two lists say they want the day their own
directories finish.

The catalog count was re-taken rather than added to (297, two agreeing instruments —
`Object.keys()` on the esbuild-bundled module and a comment-stripped depth-1 scan of the
source), because the branch carrying this slice and main's toolbar slice each measured
before the other landed and 238 + 59 is not a measurement of what shipped.

`test/i18n/estimation.test.ts` is the runtime half, and it is load-bearing rather than
belt-and-braces here for the usual reason stated at its widest: this view builds most of
its text through `iconButton`, `guidanceShell`, `scaleSpec` and `sortHeader`, whose labels
are positional ARGUMENTS, and the currency chip reaches the catalog through a TEMPLATE key
(`estimation.currency.${currency}`) that no selector could ever check. Both were watched
failing — reverting `t('estimation.toolbar.init')` to its literal and the template key to a
hand-written switch produces zero lint errors and fails that file twice. It drains each
surface and asserts the unmarked remainder is exactly DATA: the note's title, its numbers,
and the MODEL's own vocabulary, which is user-typed option text (dimension labels, rubric
sentences) and correctly not in the catalog.

**The remaining English, by the instrument described above and not by the one the tables
use:** 67 in the rest of `view/render/`, 345 in `view/manual/` (by the earlier walk; not
re-taken), 19 in the rest of `view/`, and `domain/`, of which `viewOptions.ts` is
[[View options and config warnings]] and `backlogReadme.ts` is written INTO the vault and so
a data question first. `main.ts` is two command names and one plugin name that is never
translated.

**`view/` WHOLE except the manual, and `main.ts`, on 2026-08-21.** 117 keys, taking the
catalog to **378** — the rest of `view/render/` (fifteen files), `view/writeGate.ts`,
`view/cardMoves.ts`, `main.ts`'s two command names, and six sites in
`view/interactions/` that the slice above reported as swept and was not. Counted three
ways and after the last edit: `Object.keys(en).length` at runtime, an AST walk over the
`as const` object's own properties, and a tab-aware grep for the key lines — 378 on all
three. The AST walk is the instrument this note discarded at zero in the empty-states
slice; it returns a real figure once it reads through the `as const`, which is worth
knowing before discarding it a second time.

Eight things about this slice are worth carrying to the next one.

**The handoff's suggested order was wrong, and the instrument is why.** It named
`view/manual/` as the small finishable slice on a narrow grep's 9 sites. The AST walk
reports **334** there: those three files are long-form authored documentation built from
concatenated `text:` entries, and a setter grep sees only the `title:` lines above them.
That is the fifth count in this epic short because the instrument could not see a shape,
and the first where the wrong count would have chosen the wrong work. `view/manual/` is
untouched here and is stated below as its own question.

**`view/interactions/` was NOT swept whole, and the entry above said it was.** Seventeen
English literals survived across eight files that entry names, in a directory carrying all
three text bans: `create.ts`'s modal heading, its `Under "…" · in folder "…"` detail line
and the iteration entry's two refusals; the absence entry's three; the schedule entry's
three; `dependencies.ts`'s unresolved detail; `cardDrag.ts`'s `Moved "…" from … to …`
live-region announcement; `linkDrag.ts`'s connector label; and the two resize grips, whose
tooltip was spelled identically in each. Twenty-one keys, and they are counted separately
from the rest because they are a CORRECTION rather than new ground.

What let them through is one gap per shape, and each is now closed at the forbidden thing.
`UI_TEXT_PROPERTY` matched a property whose VALUE is a literal or a template, so a value
that is a TERNARY of the two matched nothing; the first `TEXT_TERNARY` rule wants a
template wrapped AROUND the ternary and the second wants literals on BOTH branches, so a
ternary picking between a literal and a template sat in the blind spot of all three at
once. That is exactly what `create.ts`'s modal heading was. Both text bans now read through
a `ConditionalExpression`, and a third ternary rule names the mixed shape. Planting each
was watched erroring, and the swept tree stayed clean, so all three widenings cost no
exemption. The two shapes still outside every rule are unchanged and stated where they
always were: a template whose first quasi is empty, and a sentence handed to a helper as a
positional argument — the second of which is what a validator RETURNING its refusal is, and
what most of these seventeen were.

**The detail line's own acceptance criterion is paid.** `promptDetail` built
`in folder "…"` and then sentence-cased it with `where[0].toUpperCase()` when there was no
parent — wrong once the fragment comes from a catalog, since the capital belongs in the
message and not every script has case. It is four whole keys picked between now, and the
`toUpperCase` is gone.

**The runtime half asks the CATEGORY and found what neither lint nor the walk could.**
`test/i18n/projections.test.ts` marks the WHOLE catalog rather than a list of this slice's
keys, drives the tree, both context surfaces, the board and all three roadmap axes, and
asserts that everything rendered UNMARKED is data. It failed on its first run: the rollup
tooltip was `` `${done} of ${total} items done` ``, a template whose FIRST quasi is empty —
the one shape `UI_TEXT_LITERAL`'s own comment says it cannot see, and one the AST walk
misses too, because every quasi in it is blank or lowercase. Nothing but reading the
rendered string back could have found it. Each of eight reverts was watched failing, and
the context strip is in the file BECAUSE reverting `shelf.contextTooltip` was first watched
passing everything else.

**`interactions.test.ts`'s hand-kept key list rotted exactly as its own comment predicted**,
and that is what hid the six above: it named the files while the literals sat in them. It
marks the whole catalog now and needs no editing when a key is added. Doing that
immediately falsified a comment beside it claiming the scope picker's `New iteration…` was
unswept — the toolbar slice had keyed it the day before, and nothing had read the entry
back since.

**Two dead things fell out of making a data field a call.** `BoardRenderOptions` carried
`stateOptionLabel`, and the iteration board passed one although `iterationBuckets` sets
`outsideWorkflow: false` on all three of its fixed buckets, so the hint is unreachable
there. As a string it cost nothing and nobody saw it; as a function it showed up as
uncovered. The option is optional now and that board passes none. The date chips' two
`noun` strings did the same in the other direction: split into whole per-end sentences,
they exposed that the target end's context tooltip and its unreadable tooltip were driven
by NO test at all, which `test/view/dateChips.test.ts` now covers.

**What this slice deliberately did not do.** Two `console.error` prefixes stay English, the
line `commands/scaffold.ts` and `commands/readme.ts` already draw — a developer console is
not a user surface. `registerBasesView`'s `name` is the plugin's own identity and carries an
inline disable rather than an exemption for the file, `ui/manualDialog.ts`'s nav heading
exactly. `name:` joined `UI_TEXT_PROPERTY` for `main.ts`'s two commands and cost that one
disable across the whole swept tree.

**The lint regions collapsed, which is what the toolbar slice's carve-outs were waiting
for.** `RENDER_EMPTY_STATES` and `RENDER_TOOLBAR` are gone and `view/render/**` carries the
three text bans as a GLOB, so a file added to that directory is covered the moment it
exists. `RENDER_BOARD` and `ROW_CONTROLS` still repeat them, the override rule unchanged.
One trap on the way, watched in both directions: a file carved out of `VIEW` with no block
of its own matches NO `no-restricted-syntax` block at all, because the general `src/**`
region ignores `VIEW` — `showAtMouseEvent` planted in `view/manual/sections.ts` passed lint
silently until that directory got a block. Its own carve-out comment said the opposite for
about ten minutes, which is this epic's own rule about prose describing a rule you just
changed.

**The remaining English, re-derived on 2026-08-21 by the walk described above.** Under
`view/render/`, `view/*.ts` and `main.ts` the residue is **ten strings and none of them is
UI text**: six CSS selectors, one `event.key` name, two `console.error` prefixes and the
plugin's own name. `view/interactions/` is now genuinely clean, its residue being
`keyboard.ts`'s forty `event.key` comparisons, four more in `resizeDrag.ts`, one selector
and the console prefixes. What is left in the plugin is **334 in `view/manual/`**
(169 + 120 + 51) and **`domain/`**, of which `backlogReadme.ts` is 190 and is written INTO
the vault, so a data question before a text one, and `viewOptions.ts` is 66 and is
[[View options and config warnings]].

**`view/manual/` is a question, not a backlog item, and this slice did not answer it.**
Those three files are the manual dialog's authored prose — paragraphs, not labels. Keying
them means several hundred multi-sentence entries in `en.ts`, which is a different kind of
thing from every key in it today and worth deciding deliberately: a message catalog and a
translated document are not obviously the same artifact. Whoever takes it should decide
that first and count second. Nothing about the rest of the sweep depends on the answer,
and the three text bans stop at its door.

## Where it lives

**`src/i18n/en.ts`** carries the keys; the swept call sites are `src/ui/prompts.ts`,
`src/ui/stateColorsDialog.ts`, `src/ui/manualDialog.ts`, `src/commands/scaffold.ts`,
`src/commands/readme.ts`, `src/view/render/emptyStates.ts`,
`src/view/interactions/menu.ts`, `src/view/interactions/shelfMenu.ts`,
`src/view/interactions/columnMenu.ts`, `src/view/interactions/tags.ts`,
`src/view/interactions/labels.ts`, `src/view/interactions/absences.ts`,
`src/view/interactions/dependencies.ts`, `src/view/interactions/create.ts`,
`src/view/interactions/structure.ts`, `src/view/interactions/plan.ts`,
`src/view/interactions/undo.ts`, `src/view/interactions/stateColors.ts`,
`src/view/interactions/cardDrag.ts`, `src/view/interactions/linkDrag.ts`,
`src/view/interactions/columnResize.ts` and `src/view/interactions/timelineLeadResize.ts` —
which is `view/interactions/` whole, this time checked rather than claimed. Then all of
`view/render/`, `src/view/writeGate.ts`, `src/view/cardMoves.ts` and `src/main.ts`, plus
`src/view/estimation/estimationView.ts`, `src/view/estimation/renderTable.ts`,
`src/view/estimation/panel.ts`, `src/view/estimation/currencyChip.ts`,
`src/view/estimation/toolbar.ts` and `src/view/estimation/init.ts`, which is
`view/estimation/` whole. The sweep touches every rendering module without changing what
any of them does.

`src/view/render/toolbar.ts` · `src/view/render/toolbarControls.ts` ·
`src/view/render/toolbarBusy.ts` · `src/view/render/toolbarFit.ts` ·
`src/view/render/toolbarStatus.ts` · `src/view/render/rows.ts` · `src/view/render/columns.ts` ·
`src/view/render/chips.ts` · `src/view/render/board.ts` · `src/view/render/iterationBoard.ts` ·
`src/view/render/projections.ts` · `src/view/render/shelf.ts` ·
`src/view/render/shelfControls.ts` · `src/view/render/roadmap.ts` ·
`src/view/render/lanes.ts` · `src/view/render/legend.ts` · `src/view/render/timeline.ts` ·
`src/view/render/timelineArrows.ts` · `src/view/render/cardChildren.ts` ·
`src/view/render/emptyStates.ts` · `src/view/interactions/menu.ts` ·
`src/view/interactions/create.ts` · `src/view/interactions/tags.ts` ·
`src/view/interactions/structure.ts` · `src/view/interactions/undo.ts` ·
`src/view/interactions/cardDrag.ts` · `src/view/interactions/linkDrag.ts` ·
`src/view/interactions/columnResize.ts` · `src/view/interactions/timelineLeadResize.ts` ·
`src/view/estimation/estimationView.ts` · `src/view/estimation/renderTable.ts` ·
`src/view/estimation/panel.ts` · `src/view/estimation/currencyChip.ts` ·
`src/view/estimation/toolbar.ts` · `src/view/estimation/init.ts` ·
`src/view/estimation/register.ts` ·
`src/view/backlogView.ts` · `src/view/writeGate.ts` · `src/view/cardMoves.ts` ·
`src/view/registerBacklogView.ts` ·
`src/ui/prompts.ts` · `src/commands/scaffold.ts` ·
`src/main.ts`.
Tests: `test/view/contextRowWrites.test.ts` and `test/view/creation.test.ts` must pass
untouched — they guard the two behaviours this sweep is most likely to disturb.
`test/i18n/sweptSurfaces.test.ts`, `test/i18n/emptyStates.test.ts`,
`test/i18n/menus.test.ts`, `test/i18n/interactions.test.ts`, `test/i18n/toolbar.test.ts`,
`test/i18n/estimation.test.ts` and `test/i18n/projections.test.ts` are the swept half's
own checks, and each is a PAIR with lint rather than a substitute for it: they drive each
surface under a fixture catalog, so a literal left at a call site renders English beside
overridden neighbours, while `UI_TEXT_LITERAL` and `UI_TEXT_PROPERTY` in
`eslint.config.mjs` refuse a NEW one. A test cannot see a call site
nobody has written; lint cannot tell whether a key is read. `UI_TEXT_LITERAL` sees the
setter calls, `new Notice` and a bare `setTooltip(el, …)`; `UI_TEXT_PROPERTY` sees the
eleven option-bag properties. Neither sees a sentence handed to a helper as a positional argument,
which is what leaves the runtime halves load-bearing rather than belt-and-braces. Making a bare string
unable to reach the UI at all is [[A bare string cannot reach the UI]].
