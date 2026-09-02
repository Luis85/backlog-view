---
type: Task
order: 20
parent: "[[Locale-aware sorting and formatting]]"
status: Done
priority: P2
area: i18n
closed: 2026-09-02
created: 2026-09-02
source: "the one criterion PR #251 left Active, plus a headless Intl comparison across en, en-GB, de-DE, ja, fa-IR and th-TH"
files:
  - src/i18n/t.ts
  - src/domain/timeline.ts
  - test/i18n/timelineLabels.test.ts
  - test/domain/timeline.test.ts
  - test/view/roadmapFrame.test.ts
  - test/view/timelineFurniture.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Name the roadmap's months in the reader's own calendar

## Evidence

`src/domain/timeline.ts` held `MONTH_LABELS`, a hard-coded
`['Jan', 'Feb', … 'Dec']`, and four call sites read it: the week cell
(`` `${unitStart.day} ${MONTH_LABELS[…]}` ``), the month cell, the month-and-year super
tier, and — reached by none of them — the quarter cell beside them. Every reader saw
English month names whatever their locale, on the one projection that draws a calendar.

**It survived a round that thought it had closed this PBI**, and the reason is worth more
than the defect. The root `CLAUDE.md` classified month names as "a formatting question that
SHOULD follow the USER's locale through `Intl`" — a sentence about where the work BELONGS,
read for four days as a statement that it was done. PR #251 caught it by reading the guide's
own classification against the code instead of trusting it, and left the note `Active`
rather than closing it with a paragraph.

## What was decided

**A month name is FORMATTED, not translated**, so it follows the requested locale through
`Intl` exactly as `compareText` and `formatNumber` do. Twelve catalog keys were the
alternative and are refused: that would make a month name grammar, freeze it at the
languages this plugin happens to ship, and hand a French reader with no French catalog
English months while `Intl` already knows every locale Obsidian can be set to.

**The label is formatted whole, never assembled from parts.** `en` writes `Jun 29`, `en-GB`
`29 Jun`, `ja` `6月29日` — an order no caller can produce by pasting a day beside a month
name, and the same reason `t()` refuses a sentence built at a call site. English readers
therefore see a changed week cell: `Jun 29` where the hard-coded template wrote `29 Jun`.

**Two labels are notation and stay spelled in `domain/timeline.ts`.** `Q3` has no `Intl`
field to ask — CLDR carries quarter names, ECMA-402 exposes none — so the choice was
notation or the catalog key this task refuses for months. The bare year goes through `Intl`
for its DIGITS (a Persian reader reads `۲۰۲۶`, matching the cells beside it) and never
through `formatNumber`, which would group it as `2,026`.

**Four formatters, built once per `setLocale`** in `activate` beside the collator and the
three number formatters — a `new Intl.DateTimeFormat` per cell is the render-path cost
`compareText`'s own comment refuses, and the header draws a cell per week across the window.

## Two options are pinned rather than defaulted

Both were found by asking what `Intl` does with a value this codebase already had, not by
review:

- **`timeZone: 'UTC'`.** A civil date is a year/month/day triple with no zone in it, handed
  to `Intl` as `Date.UTC`. Read back in the host's zone it names the day BEFORE it
  everywhere west of Greenwich: the cell starting 1 August is headed `Jul` for a reader in
  Honolulu, and green in a CI box that runs in UTC. Driven under `Pacific/Niue` and
  `Pacific/Kiritimati`, since Node re-reads `process.env.TZ` per construction.
- **`calendar: 'gregory'`.** The grid is Gregorian — `timeline.ts` steps Gregorian months
  and knows no other calendar — so its labels must be. Unpinned, `fa-IR` names August 2026
  `مرداد ۱۴۰۵`: a Persian month over a cell spanning a Gregorian one, and a year three
  digits from every date in the notes. `th-TH` shows the same in the year alone (2569).
  `ar-SA` does NOT — its ICU default is already Gregorian — which is why the pin is asserted
  in Persian rather than in the locale that first suggested the hazard.

## The check that holds for a call site nobody listed

`` `${day} ${MONTH_LABELS[m]}` `` is a template whose first quasi is EMPTY — the shape the
root guide names as invisible to `UI_TEXT_LITERAL`, `UI_TEXT_PROPERTY` and `TEXT_TERNARY`
alike, and invisible to a prose-literal AST walk too, since every quasi in it is blank or
lowercase. Lint cannot report a missed site here, so the check reads the rendered string
back: `test/i18n/timelineLabels.test.ts` drives the dated axis at all three zooms, through
the domain functions AND through the real view, and asserts every label is in the locale's
own calendar vocabulary. Japanese is the locale it asks in, because `年月日` shares not one
letter with English — a label still spelled from an array cannot pass, at a site this round
forgot or at one added later.

Seven assertions, each watched failing first: restoring `MONTH_LABELS` fails three,
dropping `timeZone` fails the zone one, dropping `calendar` fails the Persian one, and
moving the formatter inside `formatDate` fails four including the construction count.

## What this cost elsewhere

Three test files asserted English month names for reasons that were never about the words:
`test/domain/timeline.test.ts` names months to identify a CELL (the window's edges, a leap
February, a clipped year), and two view files assert which TIER a label lands on. All three
pin the locale to `en` rather than rebuilding their expectations from `Intl`, which would
assert the formatter against itself. The file-local hook wins over the suite-wide one, so
CI's `PBL_TEST_LOCALE` leg reads the same months there.

## Still owed by a human with a real vault

Unchanged from PR #251's list and not narrowed by this round: whether a real Turkish
Obsidian's `getLanguage()` reaches the formatters as `tr`, whether `1.000` reads as one
thousand to a German user, and whether the busy indicator's `ch` reservation holds at a
grouping boundary. One is added: a header cell is sized from `dayPx`, never from its
label's length, so a longer month name (`Sept.` in German, `2026年` in Japanese) can only
be confirmed to fit by looking. `npm run test-build` opens this repository as its own
vault; `npm run harness` prints a `file://` URL that takes `?view=roadmap&axis=dates`, which
draws the header in a browser against the real stylesheet.
