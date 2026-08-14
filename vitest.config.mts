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
			thresholds: {
				statements: 98.52,
				branches: 94.83,
				functions: 99.81,
				lines: 99.6,
			},
		},
	},
});
