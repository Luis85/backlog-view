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

Nothing yet — the epic names the type and no code reads one. The work extends the type
vocabulary the model already builds, beside the way `Milestone` and `Iteration` were added:
a root by nature, holding nothing.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone planning a release |
| **Trigger** | The view building its model from the Base's results |
| **Preconditions** | The release type name is configured in this view's options |
| **Guarantee** | A release is recognised by its own declared type, is never a rung of the backlog ladder, and holds no work. Recognising one writes nothing to any note. |

**Main flow**

1. The view reads the type each note declares, against the type name its options name.
2. Notes of that type become releases; every other note in the results is work.
3. Each release offers its version, its target date and its status, each from a key this view
   names for itself.
4. A release nothing points at is still a release, and is still drawn.

**Extensions**

- **1a — the release type is not configured.** No release exists and no release screen is
  offered; the empty state says which option to bind. Releases are absent, not empty.
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

- With the release type unconfigured, the model holds no releases and the release screen is
  not offered.
- A note of the release type is in the model as a release, is not a child of anything, and
  does not appear as a rung on the backlog ladder at any focus level.
- A release with no work naming it is present in the model and is drawn.
- An unconfigured version, target-date or status key reports as unconfigured, and a bound key
  over an unreadable value reports as unreadable — two distinct answers, and neither is blank.
- Building a model containing releases plans no write.
- A release note the Base excludes is absent from the model and appears as no row anywhere,
  context row included.

## Where it lives

The type joins the vocabulary in `src/domain/itemTypes.ts` and `src/domain/typeVocabulary.ts`,
the way `Milestone` and `Iteration` already do — a root by nature, no legal children. Notes
are read into the model in `src/domain/readItems.ts` against the shape in
`src/domain/model.ts`, and the version, target-date and status keys are declared in
`src/domain/viewOptions.ts` beside every other key this view names.
