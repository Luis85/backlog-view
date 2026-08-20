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
  sentence points at a control the user can find. Two sentences spell one option's label as
  a literal today.
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
backlog change`, `Expand all`, `Collapse all`), the `Grouping ignored` advisory and its
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

## Where it lives

**`src/i18n/en.ts`** carries the keys; the swept call sites are `src/ui/prompts.ts`,
`src/ui/stateColorsDialog.ts`, `src/ui/manualDialog.ts`, `src/commands/scaffold.ts`,
`src/commands/readme.ts`, `src/view/render/emptyStates.ts`,
`src/view/interactions/menu.ts`, `src/view/interactions/shelfMenu.ts`,
`src/view/interactions/columnMenu.ts`, `src/view/interactions/tags.ts` and
`src/view/interactions/labels.ts`. The rest of the sweep
touches every rendering module without changing what any of them does.

`src/view/render/toolbar.ts` · `src/view/render/rows.ts` · `src/view/render/columns.ts` ·
`src/view/render/emptyStates.ts` · `src/view/interactions/menu.ts` ·
`src/view/interactions/create.ts` · `src/view/interactions/tags.ts` ·
`src/view/interactions/structure.ts` · `src/view/interactions/undo.ts` ·
`src/view/backlogView.ts` · `src/view/writeGate.ts` · `src/ui/prompts.ts` ·
`src/commands/scaffold.ts` ·
`src/main.ts`.
Tests: `test/view/contextRowWrites.test.ts` and `test/view/creation.test.ts` must pass
untouched — they guard the two behaviours this sweep is most likely to disturb.
`test/i18n/sweptSurfaces.test.ts`, `test/i18n/emptyStates.test.ts` and
`test/i18n/menus.test.ts` are the swept half's
own checks, and each is a PAIR with lint rather than a substitute for it: they drive each
surface under a fixture catalog, so a literal left at a call site renders English beside
overridden neighbours, while `UI_TEXT_LITERAL` and `UI_TEXT_PROPERTY` in
`eslint.config.mjs` refuse a NEW one. A test cannot see a call site
nobody has written; lint cannot tell whether a key is read. `UI_TEXT_LITERAL` sees the
setter calls and `new Notice` and **not** a `text:` or `'aria-label'` property — the one
live instance of that shape is the plugin name above, so covering the property would open
the rule on an exemption for the thing that is allowed to be there. Making a bare string
unable to reach the UI at all is [[A bare string cannot reach the UI]].
