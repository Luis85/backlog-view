import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			// The real 'obsidian' package is types-only; tests run against a small mock.
			obsidian: fileURLToPath(new URL('./test/helpers/obsidian-mock.ts', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			// Registration glue that needs the real Obsidian Plugin runtime.
			exclude: ['src/main.ts'],
			reporter: ['text-summary', 'json', 'lcov'],
			// Thresholds only ever go up. Raise them to what an increment measures,
			// rounded down to one decimal; never lower one to accommodate a change.
			//
			// Two episodes worth keeping, because both change what you do on a failure:
			//
			// A mid-increment figure is not the increment's figure. Branches once measured
			// 94.0038 mid-flight; taking the 94.0 it rounds down from would have failed the
			// very next run, because sharing a chevron between two renderers deleted six
			// branches along with the duplicate. Record what the FINISHED increment measures.
			// It happened again on 2026-08-14, the same way and with the same shape of cause:
			// branches were raised to 94.85 mid-flight, and then a hold this increment had
			// added was taken back out with the tests that drove it. 94.83 is what the
			// finished work measures, and it is above the 94.81 this branch started from —
			// which is the floor that may never move down, unlike a figure taken in passing.
			//
			// And a THIRD time the same day, which changed the RULE rather than the number.
			// Branches were raised to 94.88 with the absence-readability increment, and then a
			// band header's glyph was removed from a live-vault look along with the two tests
			// that covered it — deleting a fully covered branch lowers the ratio, since the
			// numerator and the denominator fall together. Two runs of the resulting tree, with
			// no file changed between them, then measured DIFFERENT figures: 6687/6786
			// statements and 4169/4394 branches, then 6686/6786 and 4168/4394. Same totals, one
			// covered statement and one covered branch apart.
			//
			// **So these two figures are not ratcheted by hundredths any more, and that is a
			// narrowing of the promise above rather than an exception to it.** "Raise them to
			// what an increment measures" presumes the increment measures ONE thing; this suite
			// does not, to within a hundredth of a percent. Both samples clear the floors this
			// branch started from, and those are what stand. A rise here needs a figure the
			// suite reproduces — which means finding the nondeterminism first. It is not the
			// clock (nothing in `src/` reads a time finer than a date) and it is not a
			// concurrent edit (nothing on disk changed between the runs), so the open candidate
			// is an async race in a view test whose branch lands inside `flush()` some runs and
			// not others. Recorded in
			// `docs/issues/The coverage figure is not reproducible to a hundredth.md`.
			//
			// A FOURTH sample sharpened that candidate rather than confirming it: on 2026-08-14
			// CI failed 98.51 against this 98.52 while three local runs measured 98.52, same
			// commit, same totals, one covered statement apart — and BOTH CI legs measured the
			// same figure, on two operating systems, one of which ran five tests the other
			// skips. So the split is environment-shaped, not run-to-run, which rules out a
			// coin-flip race and rules in something about the machine. TZ and worker count were
			// tried locally and reproduced nothing. What unblocked it was covering two
			// statements a local run had already been counting as uncovered, not moving a
			// figure: a floor a local sample sets is a floor CI may not clear.
			//
			// A coverage failure here is first a question about which branch nothing can
			// take, and only then about a missing test. A 93.99 against a 94.0 floor turned
			// out to be two DEAD branches — one arm whose only callers passed a three-name
			// list, one that became unreachable when a neighbouring function started
			// returning the whole vocabulary. Deleting them raised the figure on a smaller
			// denominator. Look for the dead branch before writing the test.
			//
			// The history of which decimal moved in which increment is in git.
			//
			// Merged with main after main re-accumulated ledger entries this branch had
			// removed. The entries are not restored — git holds them — but main's
			// THRESHOLDS are taken whole, because they are higher and a floor only rises.
			//
			// A FIFTH sample, from the absence-counts-and-derived-names increment
			// (2026-08-14): four local runs split 98.54/94.89 and 98.56/94.91
			// (statements/branches), one covered statement and one covered branch apart —
			// the exact single-count swing
			// `docs/issues/The coverage figure is not reproducible to a hundredth.md`
			// already names, reproduced again rather than assumed. Both samples clear this
			// floor by more than one count: a statement is 0.0147pp of 6810 and a branch
			// 0.0227pp of 4407, so the 0.02–0.04pp of headroom on statements is one to three
			// of them, and the 0.06–0.08pp on branches is two to four. The rise is declined
			// anyway, and the margin is not the reason — the reason is the one this comment
			// already gives: a rise needs a figure the suite REPRODUCES, and this increment
			// measured two. Pinning either would be pinning a sample. Functions and lines held
			// at 99.81 and 99.6 across all four runs — nothing to raise there either.
			//
			// A SIXTH sample, closing the same increment (the one-row-per-resource plan,
			// 2026-08-14): four local runs — the coverage step of a full `npm run check`
			// plus three standalone `npm run test:coverage` runs afterward, checked for
			// exactly the split the fifth sample found — measured the IDENTICAL figure all
			// four times: 98.54/94.86/99.82/99.61 (statements/branches/functions/lines),
			// same denominators every run (6780/6880, 4233/4462, 1678/1681, 5647/5669). All
			// four exceed this floor, and this time the suite reproduced rather than split,
			// so the rise this comment has declined twice above is taken now — on the
			// reproducibility this comment has always asked for, not on a relaxed bar. The
			// nondeterminism itself is not fixed and not claimed to be: four consecutive
			// agreeing runs narrow the window it can be hiding in, they do not close it, and
			// `docs/issues/The coverage figure is not reproducible to a hundredth.md` stays
			// open on that account.
			thresholds: {
				statements: 98.54,
				branches: 94.86,
				functions: 99.82,
				lines: 99.61,
			},
		},
	},
});
