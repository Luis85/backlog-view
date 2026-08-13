---
adr: 28
title: Absence is a reserved name outside the vocabulary
status: Accepted
date: 2026-08-13
area: architecture
---

# ADR 0028 — Absence is a reserved name outside the vocabulary

## Context

[ADR 0013](0013-fix-the-type-vocabulary-at-six-names.md) fixed the work-item vocabulary
and made expanding it a considered act rather than a silent one. Every name added since
has been added the same way: recognized, ranked somehow, and KEPT. `Milestone` is the
sharpest case — a marker occupies no rung, holds nothing and hangs from nothing, and it is
still a `BacklogItem`, still drawn, still counted among the notes the Base returned.

That polarity is what made every previous addition safe for a vault that had already been
using the name informally. The rule this codebase has stated each time is "a note typed
something else is still handled: it keeps its name and carries the ladder through" — so
declaring a name only ever RECLASSIFIES such a note. A `Milestone` somebody had been
typing by hand starts rendering as a marker instead of an ordinary item; it does not
disappear.

[[Resource absences]] needs the opposite. A resource's own unavailable stretch is not work
at all: no parent, no rank, no ladder rung, no state. It has to be excluded from the tree,
the board and the other two roadmap axes **unconditionally** — including in a vault with
`hierarchyOnly` off, where every note a folder-scoped Base returns becomes an item. So the
name is recognized in order to be refused, before a `RawItem` exists.

The name also has to be one a user can type into their own Base query. A Base whose query
narrows by type has to name the absence type or its absences never reach the view at all
(extension 4e, and [[The resource timeline]]'s own landmine), so this is a string people
write by hand in a place this plugin does not control.

## Decision

**`Absence` is a declared, reserved type name that joins no vocabulary list — not
`LEVELS`, `TEST_LEVELS`, `EXTRA_TYPES`, `MARKER_TYPES`, and deliberately not `ALL_TYPES`
either.** It is `ABSENCE_TYPE` in `src/domain/typeVocabulary.ts`, matched by
`isAbsenceType` in `src/domain/itemTypes.ts`, and what it MEANS is
`src/domain/absences.ts`.

Staying out of `ALL_TYPES` is the whole mechanism, not a tidiness preference. That list is
what admits a name everywhere a work item's name matters: `childTypeChoices` offers every
entry at the top level, `focusTarget` accepts one as a focus root, `shelf.ts` groups by it,
and the generated README and the in-app manual both document it as a declared type. Every
one of those is exactly what an absence must refuse — so keeping the name out means each of
those consumers needs NO edit, rather than six exclusions somebody has to remember and a
seventh nobody thinks of. The one thing membership would have bought that an absence does
need is a configured folder, and that is reached instead by passing
`[...ALL_TYPES, ABSENCE_TYPE]` to `resolveFolders` (`src/domain/settingsResolve.ts`) and to
the folder-picker generator (`src/domain/viewOptions.ts`): the same per-type shape, reused
without widening the list that drives everything else.

**This is the first DROPPED-polarity name this vocabulary has added**, and that is what the
record exists to state. A vault where a note already carries `type: Absence` as an informal
custom value has that note vanish from every projection the moment this ships — not render
differently, which is all any previous addition could do.

**Accepted rather than engineered around.** The alternative is an obscure,
collision-proof string, and it trades a rare migration surprise on one unlucky vault for an
everyday usability cost on every vault: the name is something users type into Base queries
by hand, and a plain guessable word is worth more there than collision-proofing is. What
the cost buys instead is a release-note callout naming the newly reserved value, which is
the same "considered act rather than a silent one" ADR 0013 asked for.

## Consequences

- **A pre-existing note using `Absence` as an informal type value disappears** from the
  tree, the board and all three roadmap axes on upgrade. `CHANGELOG.md` carries the callout
  under **Changed**, naming the value and saying to rename it. Nothing migrates it: this
  plugin has no way to tell such a note from one written by the feature.
- **`ALL_TYPES` is no longer "every declared name"** — it is every declared WORK-ITEM name,
  and a second reserved name sits beside it. Anything asking "is this a name this plugin
  declares" now has two things to ask. Nothing does today: every existing consumer means
  the work-item question, which is why none of them needed an edit.
- **Recognition depends on a stable, currently configured `typeKey`**, exactly as every
  other declared type's does. The CONSEQUENCE of that is sharper here, though, and
  [[Resource absences]] extension 4f says so: a `Milestone` that stops being recognized
  becomes a wrongly-ranked ordinary item, visibly wrong; an absence that stops being
  recognized becomes a real-looking task, which is the inversion the feature exists to
  prevent. A reason to be careful renaming `typeKey` in a vault with absences — not a
  reason this name owes a stable discriminator none of the other six has.
- **The name still depends on the Base returning the note.** A folder-scoped Base hands
  every note in scope over and lets this view's settings sort by type; a Base whose query
  narrows by type has to name `Absence` too. Nothing here can override that, which is
  precisely why the name had to stay guessable.

## Alternatives

- **Fold `Absence` into `ALL_TYPES` and exclude it at each consumer.** Six exclusions to
  write, each of them a place a future consumer forgets, and the failure mode of forgetting
  one is an absence offered as a creatable type or accepted as a focus root. Keeping the
  name out makes every one of those correct by construction.
- **Widen `isMarkerType` instead of adding a predicate.** The two answer opposite
  questions: a marker is recognized and kept, ranked out of the ladder but still an item,
  while this is recognized and dropped. The four sites that ask `isMarkerType` mean the
  first question, and a widened predicate would silently change all of them.
- **An obscure, collision-proof name** (`pbl-absence`, a UUID-ish token). It removes the
  4h migration surprise entirely, and pays for it on every vault: the value has to be typed
  into a Base query by hand for absences to reach the view at all, and an unguessable string
  makes that a documentation lookup every time. A rare one-off cost was preferred to a
  permanent everyday one.
- **A folder-based opt-out rather than a type** — absences live in their own folder and
  the reader skips that folder. Rejected because it cannot hold: the folder is a view
  option a user may clear or point anywhere, a Base scoped to one folder is the normal
  configuration, and [[Resource absences]] extension 3a deliberately lets an absence share
  the home folder with everything else. The exclusion is about what the note IS, and a
  filing convention is not a statement about that — which is exactly why the folder option
  here is filing and nothing more.

## Revisit when

A second reserved, non-work-item name is proposed. The Decision's mechanism generalizes —
a constant, a predicate, and a folder resolved by passing the name alongside `ALL_TYPES` —
but two such names is the point at which "reserved names" wants a list of its own, and the
argument for keeping them out of `ALL_TYPES` should be re-read against whatever the second
one is for.
