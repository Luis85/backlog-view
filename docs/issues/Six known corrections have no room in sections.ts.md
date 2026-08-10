---
type: Issue
parent: "[[User manual]]"
order: 70
status: Open
priority: P2
area: docs
created: 2026-08-10
source: Task 3's fix rounds (2026-08-09-user-manual plan), parked rather than applied
files:
  - src/view/manual/sections.ts
---

# Six known corrections have no room in sections.ts

## What is blocked

`src/view/manual/sections.ts` sits AT the 400-line lint budget (`CLAUDE.md`'s
one-file-per-concern, 400-line max). During Task 3's review rounds six real, verified
corrections were found against its prose and could not be applied — every prior trim
taken to make room had already cost a fact, so a further trim was refused rather than
taken again. All six are content for this same file; none is a placeholder or a guess.
The fix is to split the module, not to compress its prose a third time — see the ruling
below.

## The two facts already trimmed away

The sparkle entry ("The toolbar's ✨ Assign missing properties",
`docs/requirements/Help for setting up the view.md`) was cut once for space and lost two
facts that entry's own use case names as required:

1. **The concrete list of optional properties the backfill binds a key to** — "state, the
   date stamps, risk, the roadmap's horizon and dates" — is gone from the entry; it now
   says only "every optional property you have not named."
2. **The reason a type is not guessed for an unresolved parent** — the entry states that
   the backfill "never guesses a type for a parent link that resolves nowhere" but no
   longer says *why* (a type inferred from a position the view cannot see would be a
   guess, not a read).

Neither is a criterion line the completeness test can catch — the setup section's
coverage test is keyed to `getViewOptions()` keys, and both are prose about a toolbar
*action*, not an option — so nothing failed when they were cut.

## The six content corrections, each verified against source

1. **`sections.ts:401`** ("Presentation" / "What the Base still owns," current text
   implies any visible Base property becomes a row column). `chipProps()`
   (`src/view/render/columns.ts:187-208`) always filters `parent`/`order`/`type` and also
   the configured state, horizon and risk properties, because a dedicated control already
   renders each of those — a visible Base property does not automatically become a
   column.
2. **`sections.ts:185`** ("The ignored-notes count," described per NOTE). `pruneOutsideHierarchy`
   (`src/domain/model.ts:300-329`) tests per ROOT SUBTREE, by its own doc comment: "one
   participant keeps the whole component." An untyped container holding typed items is
   kept, not counted — the current entry describes a per-note rule that is not what the
   code does, which is exactly what
   [[Help for finding work]]'s matching acceptance criterion is failing on right now.
3. **`sections.ts:228`** ("What this view writes," claims the view "always" writes all
   three hierarchy properties). `createBacklogItem`
   (`src/storage/frontmatter.ts:645-652`) omits `parent` entirely for a parentless note
   created outside folder mode, and a state, tag or date-stamp write touches none of the
   three — "always" overclaims.
4. **`sections.ts:239`** ("A change is one batch," undo's paragraph). It never says that
   invoking undo a second time REDOES the change (the replay installs its own inverse) —
   paired with the "one slot" wording nearby, a restored change currently reads as
   unrecoverable rather than as one more press away from being reapplied.
5. **`sections.ts:173`** ("Quick filter" entry). Omits both keyboard shortcuts
   (`/` focuses the filter box, Escape clears it, per `handleFilterKey`) and omits that
   the filter text is session state that is never written anywhere — the second omission
   is a direct miss of
   [[Help for finding work]]'s own acceptance criterion asking for exactly that
   statement.
6. **Restore the two sparkle facts** listed above, in the entry they were cut from.

## The ruling this is carried under

From the plan's own ledger (`.superpowers/sdd/2026-08-09-user-manual/progress.md`): "the
budget has forced two trims, one of which lost a criterion fact... The indicated fix is
to SPLIT the module, not to keep compressing prose; every further correction now costs a
sentence elsewhere." The six items above are the bounded, named list that ruling promised
rather than a place findings go to be forgotten — a seventh should not accumulate here
without becoming its own task.

## Acceptance criteria

None; this note records six verified corrections and blocks on a module split, not on a
prose edit. The criteria that can be met live on the notes named above
([[Help for finding work]], [[Help for setting up the view]]) once the split gives their
sections the room to be corrected.
