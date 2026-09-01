---
type: PBI
parent: "[[Multilang]]"
order: 120
status: Active
started: 2026-09-01
finished: ""
horizon: ""
start: 2026-09-01
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

**Two of the six criteria landed on 2026-09-01 and the largest one did not**, so this note
stays Active rather than being closed on the half that was cheap.

What landed is the plumbing and the second pass. `test/helpers/locale.ts` resolves
`PBL_TEST_LOCALE` once per run and is vitest's own `setupFiles` entry, so every file gets
the run's locale rather than whatever the last test left behind; `useViewHarness()` puts it
back per test beside the rest of its reset, and every `afterEach` in `test/i18n/` that
restored a hard-coded `'en'` now restores the RUN's locale — restoring English is exactly
what would make the second pass green by accident. CI runs the suite a second time under
`de-DE` as its own job.

**That second pass is narrower than this note's third criterion and the difference is
stated rather than glossed.** `de-DE` has no catalog, so it exercises the FALLBACK across
every surface — a code resolving to English, with English's plural rules carried along by
`grammarOf` — and `Intl.NumberFormat` in a locale that groups unlike English. It does not
run the suite in a second CATALOG, which is what the criterion asks for, because the
assertions below make that impossible today: under `en-x-pseudo` the suite fails on wording
at several hundred sites, which measures the assertions rather than the layer.

**The second pass found six assertions on its first run, which is the evidence that it is
a check rather than a ceremony.** All six asserted ENGLISH number formatting while being
about something else: `scoringModel.test.ts` spelled `99.999` and `0.001` into a weights
message, `panel.test.ts` spelled `counted as 2.5`, and `releaseIndex.test.ts`'s
`drawnParts` stripped a day count with `/^[\d,]+ days? /` — a pattern that reads a comma
as the group separator and so left `26.420 days left` where the table expected the count
gone. The two that SPELL a number go through `num()` in `test/helpers/locale.ts`, the
same `Intl.NumberFormat` `t()` builds on the same resolved code; the three that DROP one
take a pattern that reads any punctuation between digits, since which mark separates a
group is the locale's. The sixth is the exception the
fourth criterion allows and keeps: `locale.test.ts`'s "formats a number inside a message"
IS about the formatting, so it drives `setLocale` itself and now asserts both locales, with
a comment saying the wording is the subject.

So the work still owed is the first criterion, and it is bigger than this note said. It
counted "roughly 33 assertions"; a re-count on 2026-09-01 over `test/view/`,
`test/ui/`, `test/commands/` and `test/storage/` found **117 `Notice.messages` assertions
alone**, before the `toContain('…')` matches on visible labels, which are several hundred
more. Some of those strings are user DATA (a note title, a type name, a folder path) and
must stay literal, so it is not a sweep a pattern can do — which is the finding that turns
this from a plumbing task into its own slice.

The original statement of the problem, unchanged:

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

`test/helpers/locale.ts` resolves the run's locale and is the `setupFiles` entry, so a file
that never mentions a locale still runs in the one the run asked for ·
`test/helpers/view.ts` puts it back per test inside `useViewHarness()` ·
`test/helpers/obsidian-mock.ts` is where `getLanguage` gets a stand-in, and it still
answers `'en'` — a test that cares drives `setLocale` rather than reaching through it ·
`test/view/state.test.ts` holds an assertion matching a notice by its English text today,
which is the shape the remaining work changes.
Config: `vitest.config.mts` carries the `setupFiles` entry and the coverage thresholds that
must not drop · `.github/workflows/ci.yml` runs the second pass as its own `locale` job,
one platform, `PBL_TEST_LOCALE: de-DE`.
