---
type: PBI
parent: "[[Translations stay honest]]"
order: 30
status: Open
---

# Tests do not read English

The suite asserts behaviour, not wording, so the whole thing passes in any locale and a
copy edit does not turn into a red build.

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
  Whether that is a second CI matrix entry or a locale-parameterized run is an
  implementation call; that it happens is not.
- A small number of assertions genuinely *are* about text — that the English catalog
  reads in sentence case, that a translated option label is quoted into the hint that
  names it. Those stay, and they say in a comment that the wording is the subject.
- Coverage thresholds do not drop. They only ever go up (`vitest.config.ts`), and moving
  assertions is not a reason for an exception.
- `test/**` keeps its 450-line budget. If the locale plumbing pushes a file over, the
  file splits by subject — the rule the suite already lives by.
