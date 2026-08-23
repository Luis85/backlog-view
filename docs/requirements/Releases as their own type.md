---
type: PBI
parent: "[[A release is a note of its own]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Releases as their own type

**As** someone planning what ships, **I want** a release to be an ordinary note with a type of
its own, **so that** I can plan a release, and name its date, before a single item is in it.

The type has shipped. It extends the type vocabulary the model already builds, beside the
way `Milestone` and `Iteration` were added: a root by nature, holding nothing. What has NOT
shipped is any way to create one from this plugin's own screens beyond the backlog toolbar's
`New Release`, and no figure a release note carries beyond its version, target date and
status.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone planning a release |
| **Trigger** | The view building its model from the Base's results |
| **Preconditions** | The property that holds a note's type is mapped |
| **Guarantee** | A release is recognised by its own declared type, is never a rung of the backlog ladder, and holds no work. Recognising one writes nothing to any note. |

**Main flow**

1. The view reads the type each note declares, and matches it against the **fixed** name
   `Release`, case-insensitively.
2. Notes of that type become releases. **Every other note keeps the category it already had**
   — plan work, a marker, an iteration, a test-catalog note — because `Release` is one more
   non-work category beside those, not the only one. "Anything that is not a release is work"
   would make a `Milestone` assignable to a release, which
   [[Setting an item's release]] refuses at both ends.
3. Each release offers its version, its target date and its status, each from a key this view
   names for itself.
4. A release nothing points at is still a release, and is still drawn.

**Extensions**

- **1a — the type property is not mapped.** No note has a readable type, so no release exists
  and no release screen is offered; the empty state says which option to bind. Releases are
  absent, not empty.
- **1b — no note in the results is typed `Release`.** The vocabulary is still there and the
  screen still exists; there is simply nothing in it. That is a different state from 1a and
  says so, because one is a configuration to fix and the other is a note to write.
- **2a — a release note declares a parent.** It is a root by nature, like a `Milestone` and an
  `Iteration`, so the parent places it nowhere and never makes it a rung. The value is left
  alone rather than cleared: this view does not tidy notes it did not write.
- **2b — a work item declares the release type as well as a backlog type.** A note has one
  type; whichever key the view reads answers once, and the note is a release or it is work,
  never both.
- **3a — the version, date or status key is unconfigured.** That fact is reported as
  unconfigured wherever it would have been shown, never as blank and never as a default.
- **3b — the value where a configured key points cannot be read as what the key promises** — a
  target date that is not a date, a version that is an empty string. It is reported as
  unreadable, which is a different answer from absent, because somebody wrote something there.
- **4a — a release note is outside the Base's filter.** It is not in the model at all, and it
  **never arrives as a context row either**: a release parents nothing, and only an ancestor of
  a result is drawn as context. A member's link still spells a name, so a name is all any view
  can show of it — no date, no status, no capacity, and nothing derived from those. That is the
  same stated limit [[Creating an iteration from the board]] takes for the same reason, and it
  is a limit rather than a bug: the thing to change is what the base shows.

## Acceptance criteria

- `Release` is a constant in the shipped vocabulary and appears in no view option: nothing
  anywhere lets a vault rename the type, per ADR 0013, and the only thing configurable about
  it is which property holds a note's type.
- With the type property unmapped, the model holds no releases and the release screen is not
  offered; with it mapped and no note typed `Release`, the screen is offered and empty.
- A note of the release type is in the model as a release, is not a child of anything, and
  does not appear as a rung on the backlog ladder at any focus level.
- A release with no work naming it is present in the model and is drawn.
- An unconfigured version, target-date or status key reports as unconfigured, and a bound key
  over an unreadable value reports as unreadable — two distinct answers, and neither is blank.
- Building a model containing releases plans no write.
- A release note the Base excludes is absent from the model and appears as no row anywhere,
  context row included.
- Adding `Release` to the vocabulary leaves every other classification unchanged: a
  `Milestone`, an `Iteration` and a test-catalog note are still none of them plan work.
- It files into its own folder (`typeFolder.release` — shipped default `releases` under the
  home folder), the option every declared type gets by arriving in the vocabulary rather
  than by being remembered, exactly as `typeFolder.iteration` did.
- It draws no point and no bar on the **backlog** roadmap, on either axis, and speaks no
  placement end: the dated axis reads the backlog's own start and target keys, which are the
  wrong mapping for a release date and a far worse one to write. Placing a release on a
  timeline is [[A release on the dated axis]] and needs the roadmap's own release-date key,
  which does not exist yet.

## Where it lives

The type joins the **fixed** vocabulary in `src/domain/itemTypes.ts` and
`src/domain/typeVocabulary.ts`, the way `Milestone` and `Iteration` already do — a root by
nature, no legal children, and a constant rather than an option (ADR 0013). Notes
are read into the model in `src/domain/readItems.ts` against the shape in
`src/domain/model.ts`, and the version, target-date and status keys — the property keys, never the type name —
are declared in `src/domain/releaseOptions.ts` beside every other key this view names.
