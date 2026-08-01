---
type: Issue
order: 90
parent: "[[Product Backlog]]"
status: Done
priority: P2
area: verification
closed: 2026-08-01
created: 2026-08-01
source: 2026-08-01 register review
---

# Sweep the register against the code for missing use cases

## Why this exists

The register grew alongside the code, note by note, each written when a piece of work was
done. Nothing ever checked it from the **other** direction: which shipped behaviour has no
note at all. A backlog that only ever gains notes for work someone remembered to write up
is a backlog with silent holes, and the holes are exactly where nobody is looking.

## The method

Five enumerations, each taken from the code rather than from memory, and each mapped onto
the PBIs:

| Enumerate | From | Why it catches things |
| --- | --- | --- |
| Every **view option** | `domain/viewOptions.ts` | An option is a promise to the user. One with no note is a capability nobody specified. |
| Every **command** | `main.ts` | Commands are whole entry points, easy to forget because they are not in the view. |
| Every **context-menu item** | `interactions/menu.ts` | The menu is where capabilities accumulate one at a time. |
| Every **toolbar control** | `render/toolbar.ts` | Same, for the controls that are always on screen. |
| Every **module with its own test file** | `src/` vs `test/` | A module worth testing on its own is usually a concern worth a note. |

Then: for each, grep the register for the behaviour's name. A miss is a candidate.

## What it found

Five gaps, all shipped behaviour with tests and none of it written down:

1. **Scope** — `hierarchyOnly`, `pruneOutsideHierarchy`, the toolbar advisory and the empty
   state's explanation. A whole option deciding what a backlog *contains*, with no note.
   → [[What counts as a work item]]
2. **Orphans and cycles** — `breakCycles`, `cycleEntry`, the orphan marker, the
   stale-link-clearing rule. Orphans had one line inside another note; cycles appeared
   nowhere in `requirements/` at all. → [[Broken links still render]]
3. **The auto-type cascade** — `autoAssignType` and `computeTypeChanges`. The only path
   that writes `type` implicitly, off by default, subtle enough to have produced a P1 bug.
   It was mentioned in passing by three notes and specified by none. →
   [[Assigning type on a move]]
4. **The Create backlog command** — `commands/scaffold.ts` and `storage/baseFile.ts`, two
   modules and two test files. The entire onboarding path existed as a single bullet inside
   a note about folders. → [[Scaffolding a backlog]]
5. **Opening a note** — click, modifier-click, middle-click, `Enter`, and two menu items.
   The most-used interaction in the plugin, and the register did not mention it. →
   [[Opening the work]]

The pattern in all five: **behaviour that was never anyone's feature.** Each arrived as
part of something else — scope came in with the model, opening came in with the row — so
no note was ever opened for it, and none of the review rounds noticed, because reviews read
what is written rather than what is not.

Writing them up also turned up four stale symbol names in code comments and in the register
(`settings.levels` and `extraTypeRank`, neither of which still exists), because a note that
has to say where a behaviour lives cannot be written without checking.

## Acceptance criteria

- Every view option, command, menu item and toolbar control maps to a named PBI.
- Every `src/` module with its own test file is named by at least one note.
- Every symbol and path a note names exists.

## What the script can take over, and what it cannot

`docs-check.mjs` mechanises the parts of this sweep that are **literal strings in the
source**, so those stop needing a human:

- every **view-option key** and every **command id** must be named by a *requirement*.
  Both are promises that outlive a release — an option key is stored in the user's `.base`
  file, a command id in their hotkeys — so one arriving unnamed is a capability nobody
  specified, and one renamed is a setting silently lost. Checked in
  `test/docs/surfaces.test.ts`, which **imports** `getViewOptions()` and reads the real
  keys rather than scanning the source for them;
- every module and test file must be named by some note;
- every path and wikilink a note names must resolve.

**Menu items and toolbar controls stay a hand sweep.** They are display text
(`setTitle('Move to top')`), and the register describes them in prose rather than quoting
them, so a literal check would either fail on every note or force the notes to quote UI
strings that change for cosmetic reasons. Adding one to an existing module is exactly the
case the script cannot see, and it is why this note is a checklist rather than a closed
task.

## Outcome

Done: 23 use cases became 28, and the mechanisable criteria are now enforced by
`npm run docs` rather than by reading — see `docs/README.md`.

**Re-run the rest when a feature lands**, not on a schedule. What is left to do by hand is
the two display surfaces above, and its value is entirely in being done at the moment
behaviour is added — the moment it is easiest to write down and the moment nobody wants
to.
