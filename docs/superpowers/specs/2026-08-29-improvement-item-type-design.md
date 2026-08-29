# Improvement as a type beside the ladder

## The problem

An item ships in a release. The next release wants more of it. Today the only way to say
so is to move the item's release property forward — which rewrites history: the release
that shipped it loses its member, and the note that recorded the delivered work now claims
to be pending. A shipped thing and the next round of work on it are two things, and the
backlog has only one note for them.

## The change

`Improvement` becomes the fifth **extra type**. An extra type is the category
`docs/requirements/Types beside the ladder.md` already defines: its rank is a property of
the TYPE rather than of where it sits, so it hangs from an `Epic`, a `Feature` or a `PBI`
and its children are `Task`s wherever it hangs. That is exactly the contract asked for.

The shipped item keeps its release. The `Improvement` under it carries the next one. Two
notes, two releases, and the delivered work stays delivered.

Nothing release-specific is built. Release membership is already a property on any item,
so an `Improvement` joins a release the way every other item does — through `Set release`
and the release view's scope tree, both of which are generic over the vocabulary.

## Where it lives

`src/domain/typeVocabulary.ts` — `Improvement` joins `EXTRA_TYPES`, and
`DEFAULT_TYPE_SUBFOLDERS` gains `improvement: 'improvements'`. That is the whole of the
behaviour. `ALL_TYPES`, `FILED_TYPES`, the per-type folder option, `childTypeChoices`,
`EXTRA_TYPE_RANK`, `isExtraType`, the model's scope test, the cascade's exemption in
`writePlan.ts`, the shelf grouping, the toolbar's creator, the `Set type` submenu and the
generated vault README are all already generic over the vocabulary and need no edit.

`src/view/render/badges.ts` — a `trending-up` icon and the `pbl-lvl-improvement` class.

`styles/badges.css` — GREEN, its third wearer beside `Deliverable` and `Release`. The
fourteenth badge over Obsidian's eight chromatic tokens, so it shares by the rule that file
already states: hue is identity, and each sharer relies on what else keeps it apart. Green
was picked over pink and blue because the alternative pairings are no better and the
decision is recorded rather than left to look least crowded. What separates it from
`Deliverable` — the one wearer it can be a SIBLING of, under the same parent — is the icon
and the type name; `Release` is a marker read in another view and never drawn beside it.

`src/view/manual/typesSection.ts` — an `INTENT` entry, which
`test/view/manualTypes.test.ts` already requires of every `ALL_TYPES` member.

`docs/README.md`, `scripts/docs-check.mjs` and `test/helpers/register.ts` — `docs/` is
itself a backlog in this schema, so the register's hierarchy table, the checker's
`EXTRA`/`LEGAL_CHILDREN` gate and the fixture that plants a legal tree move together. The
checker holds the table and the gate to each other in both directions, so they cannot be
changed one at a time.

## Acceptance criteria

- `Improvement` is pinned at `EXTRA_TYPE_RANK`; its children are `Task`s under an `Epic`
  exactly as under a `PBI`.
- It is offered under an `Epic`, `Feature` or `PBI`'s **+** beside `Issue`, `Bug`, `Idea`
  and `Deliverable`, and by the toolbar's top-level creator and `Set type`.
- No move re-types it, and a parentless one is never pruned by `hierarchyOnly`.
- It files into `typeFolder.improvement`, shipped default `improvements` under the home
  folder.
- It renders with its own icon, and its badge class is defined by the stylesheet — the
  existing badge-table test covers the whole vocabulary and therefore covers it.
- Every criterion above is asked of `EXTRA_TYPES` rather than of the name `Improvement`,
  so a sixth name cannot join the category without answering them.

## Verification

`npm run check`. The vocabulary gates fail wherever a name was counted rather than derived
— that is the change's own verification, not incidental breakage.

Not verifiable here, as ever: the badge colour itself. It goes on the smoke-test checklist,
where the question is whether green's third wearer reads apart from `Deliverable`.
