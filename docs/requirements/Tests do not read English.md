---
type: PBI
parent: "[[Multilang]]"
order: 120
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Tests do not read English

The suite asserts behaviour, not wording, so the whole thing passes in any locale and a
copy edit does not turn into a red build.

**As** someone changing a message, **I want** the suite to assert behaviour rather than
wording, **so that** a copy edit does not turn into a red build and a locale bug is not
hidden by tests that only ever ran in English.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin |
| **Trigger** | Running the suite, or editing a message |
| **Preconditions** | The catalog exists |
| **Guarantee** | Coverage thresholds do not drop. They only ever go up, and moving assertions is not a reason for an exception. |

**Main flow**

1. A test drives a real interaction, as it does today.
2. It asserts what happened by naming the message **key**, not its text.
3. The harness resolves a locale explicitly rather than inheriting one.
4. The suite runs green under a non-English fixture locale as well as English.

**Extensions**

- **2a — the assertion really is about wording.** A few are: that the English catalog reads
  in sentence case, that a translated option label is quoted into the hint naming it. Those
  stay, and say so in a comment.
- **3a — the locale plumbing pushes a file over its budget.** It splits by subject, the rule
  the suite already lives by.
- **4a — the fixture carries three plural categories and a regional code.** That is the
  point: English cannot, so a suite that only ran in English proves nothing about the layer.

## What is there now

Roughly 33 assertions in `test/**` match on user-facing prose. They read like:

```ts
expect(Notice.messages).toContain('Still applying the previous change — try again in a moment.');
```

That assertion is correct today and is about to become two things at once: a check that
the gate refused a concurrent write, and a check that a particular English sentence has
not been reworded. The first is the test's purpose. The second is a hostage.

## Acceptance criteria

- An assertion about *what happened* identifies the message by key, not by text. That
  assertion then holds in every locale, and a rewording of the English catalog does not
  touch a test file.
- The harness resolves a locale explicitly rather than inheriting one. `test/helpers/`
  is where this goes — `useViewHarness()` already owns the per-test reset, so the locale
  belongs beside it.
- The full suite runs green under a **non-English** locale, not only under English. A
  suite that has only ever run in the source language proves nothing about the layer.
  Since English ships alone, that locale is a **fixture** rather than a shipped catalog —
  which is the point: the fixture can carry three plural categories and a regional code,
  and English cannot. Whether it runs as a second CI matrix entry or a
  locale-parameterized pass is an implementation call; that it happens is not.
- A small number of assertions genuinely *are* about text — that the English catalog
  reads in sentence case, that a translated option label is quoted into the hint that
  names it. Those stay, and they say in a comment that the wording is the subject.
- Coverage thresholds do not drop. They only ever go up (`vitest.config.mts`), and moving
  assertions is not a reason for an exception.
- `test/**` keeps its 450-line budget. If the locale plumbing pushes a file over, the
  file splits by subject — the rule the suite already lives by.

## Where it lives

**Nothing yet — this note is design.** `test/helpers/view.ts` owns `useViewHarness()` and
the per-test reset, so the resolved
locale belongs beside it · `test/helpers/obsidian-mock.ts` is where `getLanguage` gets a
stand-in · `test/view/state.test.ts` holds an assertion matching a notice by its English
text today, which is the shape that changes.
Config: `vitest.config.mts` carries the coverage thresholds that must not drop.
