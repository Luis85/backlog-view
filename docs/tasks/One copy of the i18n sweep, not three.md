---
type: Task
order: 280
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-09-01
closed: 2026-09-01
source: fallow run with duplicates.ignoreDefaults false, which is the only way test/ is measured
files:
  - test/i18n/fixtures.ts
  - test/i18n/toolbar.test.ts
  - test/i18n/menus.test.ts
  - test/i18n/estimation.test.ts
  - test/helpers/view.ts
  - test/view/toolbarFit.test.ts
  - test/view/release/initControl.test.ts
  - test/helpers/roadmap.ts
  - test/view/legend.test.ts
  - test/view/absenceCollision.test.ts
started: 2026-09-01
finished: 2026-09-01
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# One copy of the i18n sweep, not three

## Evidence

[[Close the holes the test typecheck cannot see through]] left three things open, and its
own duplication measurement is where this one starts: `test/**` is skipped by fallow's
built-in default, so the only way to see it is a run with `duplicates.ignoreDefaults`
false. On the merged tree that reports **446 clone groups**, and the two widest that are
not a fixture somebody copied on purpose are both machinery:

- **The i18n sweep**, in `test/i18n/`. Seven files each carried the
  `beforeEach(setLocale('xx'))` / `afterEach(setLocale('en'))` pair with the same comment
  above it; four carried their own `marked(key)`; three their own `drawnText(root)`; two
  their own `titlesOf(menu)`, their own `seen` set and their own `record`.
- **The toolbar's style partials**, in `test/view/`. `toolbarFit.test.ts` and
  `toolbarFocusSafety.test.ts` each loaded `['styles/toolbar.css', 'styles/toolbarFit.css',
  'styles/busy.css']` into the jsdom head, and each carried a copy of `toolbarOf`. A third
  copy of that accessor was `barOf` in `test/i18n/toolbar.test.ts`.

The second one is not tidiness. That list's own comment records two defects, both of the
same kind: a partial missing from it left the rule under test never applied, so the
assertion passed against a document where it could not have failed. **A short list is what
both defects look like, and a second copy of the list is a second chance to be short in.**

The two `drawnText` copies had already drifted: the estimation one read `el.title`, the
toolbar one did not, so one of the two swept surfaces answered "is every drawn string
text" without looking at a `title` attribute at all.

## Approach

`test/i18n/fixtures.ts` is where `markedCatalog` already lives, put there as "one builder
rather than the nine copies this was" — the same journey, half walked. It now also carries
`useMarkedLocale`, `marked`, `unmarked`, `drawnText` and `menuTitles`, and `drawnText` reads
all four sources rather than the three one copy had.

`sweep()` beside them is a FACTORY and that is the point: the audit each of the two big
files ends with asks what THAT file's run watched reach a surface, so a `seen` set shared
between files would answer it with another file's sightings. It hands back that set, a
`record` for the surfaces neither reader covers (a `Notice`, a prompt's option bag), and
the two readers wired to it.

`loadToolbarStyles()` and `toolbarOf()` go to `test/helpers/view.ts`, beside `treeOf` and
the other toolbar accessors. The long explanation of why each partial is in the list moved
with it and is now stated once.

**Every extraction was watched failing**, per this repository's own rule:

- `record` stubbed out → both catalog audits fail, and only those two.
- `useMarkedLocale` set to `en` → 88 of 116 tests in `test/i18n/` fail.
- `loadToolbarStyles` cut to the fit partial alone → the relaxing-direction test fails,
  which is the defect the list's comment describes.

## A weak assertion beside it

`test/view/release/initControl.test.ts` asked `toBeTruthy()` of every option ✨ binds. Two
of the seven candidates in `RELEASE_SUGGESTED_KEYS` suggest the SAME key (`status`, for the
item state and the release's own), so a press that bound the right number of options to the
wrong ones passed every assertion in that file. It now asserts
`notePropertyId(candidate.suggested)` per candidate, still derived from the list rather
than written out. Watched failing against a `runReleaseInit` that binds `version` where it
should bind `release`.

## Two tests that were failing before any of this

`npm run check` was red on `main` when this started, and neither failure was anybody's
change: `legend.test.ts` and `absenceCollision.test.ts` each have a case whose premise is
**a near-term backlog at quarter zoom**, where the track is too narrow for a bar label.
Both said they were reusing `timelineFurniture.test.ts`'s construction for that; that file
derives its date from `new Date()`, and both copies typed `2026-08-01`. The window pads
around TODAY, so the premise held while it was August 2026 and stopped on its own. The
label came back, the tests failed, and nothing in the plugin had moved.
`legend.test.ts`'s own header states the rule its failing case broke: *"offset from the
REAL clock so the test cannot drift"*.

`nearTermSpan(lead, length)` in `test/helpers/roadmap.ts` is that construction as a
function, so a fourth copy cannot type a date instead. Both fixtures take it now.

**The rest of the suite was then asked the same question with an instrument rather than by
reading.** A throwaway setup file replacing `Date` with one shifted by `CLOCK_SHIFT_DAYS`,
pointed at by `vitest.config.mts`'s `setupFiles` for the run and deleted after:

```js
const REAL = Date;
const DELTA = Number(process.env.CLOCK_SHIFT_DAYS ?? 180) * 86400000;
class Shifted extends REAL {
	constructor(...args) {
		if (args.length === 0) super(REAL.now() + DELTA);
		else super(...args);
	}
	static now() {
		return REAL.now() + DELTA;
	}
}
globalThis.Date = Shifted;
```

At **+180 days the whole suite passes** — 4418 tests, so the two above were the only ones
whose premise expires within six months. At **+1095 days eight tests in six files fail**,
all of the opposite kind: fixtures dated 2030 as "beyond the drawn window", which stop
being beyond it once the clock reaches them. That is the hazard `legend.test.ts`'s header
already names, measured rather than suspected, and it is left for its own change — the fix
is the same shape each time (derive the date from `MAX_TIMELINE_DAYS` and today, which
`legend.test.ts` and `absenceCollision.test.ts` both already do for their clamped cases).

## Acceptance criteria

- `npm run check` passes whole, no coverage floor moved.
- No test loses a question: the extracted readers are the same readers, and `drawnText`
  gains `title` rather than dropping anything.
- The counts here are reproducible with `npx fallow --config <a copy with
  duplicates.ignoreDefaults false>`.

## What is left

The eight +1095-day failures above, in `harness.test.ts`, `i18n/projections.test.ts`,
`absenceCollision.test.ts`, `dependencyArrows.test.ts`, `milestonesRow.test.ts` and
`resourceAbsences.test.ts`. Re-measure with the probe rather than trusting this list: it is
dated the moment it is written.

The other two follow-ups from [[Close the holes the test typecheck cannot see through]]
stand: the doubles are still widened rather than verified, and `scripts/*.mjs` are typed at
the boundary only where a test needed it. The remaining 400-odd clone groups in `test/` are
still not a gate anyone acts on — what the measurement is good for is naming the one or two
extractions worth doing, which is how this note picked its two.
