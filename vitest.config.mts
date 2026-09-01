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
		// The locale is RESOLVED for the run rather than inherited, so the whole suite can
		// be driven somewhere that is not the source language — see `test/helpers/locale.ts`.
		setupFiles: ['./test/helpers/locale.ts'],
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
			// A SIXTH sample, from closing the one-row-per-resource plan (2026-08-14): four
			// local runs — the coverage step of a full `npm run check` plus three standalone
			// `npm run test:coverage` runs afterward — measured the IDENTICAL figure all four
			// times: 98.54/94.86/99.82/99.61 (statements/branches/functions/lines), same
			// denominators every run (6780/6880, 4233/4462, 1678/1681, 5647/5669). Declined
			// anyway, on review, for two reasons neither of which is the margin. First, the
			// flake this file already documents is exactly one covered statement and one
			// covered branch — so raising to the exact measured figure leaves under one COUNT
			// of headroom on all four (0.45/0.35/0.03/0.11 counts by the same arithmetic as
			// the fifth sample), and functions and lines were never sampled for the flake at
			// all while sitting pinned tightest of the four. Second, four agreeing runs is not
			// evidence a flake is gone: if the low figure lands one run in three, P(four
			// agree) = (2/3)^4 + (1/3)^4 = 17/81 ≈ 21% — a one-in-five event on its own,
			// exactly what a real 1-in-3 flake looks like now and then. Rejecting a 1/3 rate
			// at 95% confidence needs eight consecutive agreeing runs, and these four ran on
			// one OS while CI gates two. A rise still needs the diagnosis the note already
			// asks for — diffing `coverage/coverage-final.json` per file across two runs —
			// not a run count, however large.
			// **Every floor here holds at least one covered unit of headroom, except the one
			// that cannot.** Measured on 2026-08-21 at 7591/7701 statements, 4792/5047
			// branches, 1960/1963 functions and 6328/6349 lines. Losing ONE covered unit
			// gives 98.5586 / 94.9277 / 99.7962 / 99.6535 — so the exact figures failed three
			// of the four gates, and a floor set to a measurement is a gate that fails on a
			// legitimate change that removes a single branch.
			//
			// **The one-branch flake above is not hypothetical — it was reproduced here.** Four
			// coverage runs on an UNCHANGED tree gave 4792, 4792, 4792, then 4791 covered
			// branches. The first two agreeing is exactly why the note above refuses a run
			// count as the diagnosis: two runs are not evidence of stability, and a floor set
			// from a run that happened to catch the high value fails the next one that does
			// not. A floor of 94.93 — one unit below the 4792 measurement — was tried and
			// failed on the 4791 run, which is what put the number below.
			//
			// **CI then supplied the cross-environment half the note asks for, on its own.**
			// The Ubuntu `verify` job on `ce1b222` reported 7590/7701 statements and
			// 4791/5047 branches where this machine had just measured 7591 and 4792, with
			// functions (1960/1963) and lines (6328/6349) identical in both. So what varies
			// is a statement and a branch, one each, and it varies BETWEEN environments as
			// well as between runs — the pair to diff in `coverage/coverage-final.json` if
			// anyone chases it further. Every floor below clears the LOW figure from both.
			//
			// So branches sits under the LOW observed count rather than under the measurement,
			// and lines one unit under its own; both remain above the floors they replaced
			// (94.83, 99.6), so the ratchet still only goes up.
			// **Functions cannot have that**: one fewer is 99.7962, which is under the 99.81
			// this PR raised FROM, so headroom there would be a decrease. It is left at 99.84
			// and named rather than quietly lowered — the fragility predates this change and
			// the old floor had no one-function headroom either. If functions ever flake the
			// way branches just did, that floor is the next one to come down.
			//
			// Raised again on 2026-08-25, with the release view's own `New release`: this
			// machine measured 9280/9381 statements, 5783/6059 branches, 2400/2402 functions
			// and 7713/7732 lines. Two move, each set under the ONE-FEWER figure by the
			// headroom rule below: 9279 is 98.9127, so statements takes 98.91, and 5782 is
			// 95.4283, so branches takes 95.42. **Lines and functions both stay**, and for
			// the same arithmetic rather than for two reasons — one fewer line is 99.7413,
			// under the 99.74 already standing, and one fewer function is 99.8751, under the
			// 99.90. A floor is worth raising only where the raise still leaves a covered
			// unit of slack; above that it is a ratchet on the next contributor, not on the
			// coverage. This paragraph replaced one that set all four AT the measurement —
			// the arithmetic the rest of this comment describes, contradicted by the numbers
			// directly beneath it, which is the defect this file's own rule exists to stop.
			//
			// Raised on 2026-08-23, with `Set release`: this machine measured
			// 9168/9268 statements, 5744/6018 branches, 2368/2370 functions and 7618/7637
			// lines. The three that move are set under the ONE-FEWER figure, the same
			// headroom rule the paragraph above arrived at — 9167 is 98.9102, 5743 is
			// 95.4304, 7617 is 99.7381 — rather than at the measurement, which would redden
			// on the next merge. **Functions is left where it is** for the reason already
			// stated: one fewer is 99.8734, under the floor it would be raised from, so
			// headroom there is still a decrease.
			// Raised again on 2026-08-26, with the release index's band and its two groups:
			// this machine measured 9390/9490 statements, 5899/6177 branches, 2410/2412
			// functions and 7802/7821 lines. Two move, both set under the ONE-FEWER figure by
			// the headroom rule above — 9389 is 98.9357, so statements takes 98.93, and 5898
			// is 95.4832, so branches takes 95.48. One fewer of each is exactly the
			// cross-environment variance this comment already records (Ubuntu CI reporting one
			// statement and one branch fewer than this machine), so that is the margin being
			// bought rather than a round number.
			// **Lines and functions both stay, and for the same arithmetic rather than for two
			// reasons.** One fewer line is 99.7443, which floors to the 99.74 already standing
			// — a raise that changes nothing is not a raise. One fewer function is 99.8756,
			// under the 99.90 standing, so headroom there would again be a decrease, which is
			// the exception this file has now stated three times.
			// Raised again on 2026-08-28, with the release scope tree's fold, its disclosure
			// and a click that opens the note: this machine measured 9517/9616 statements,
			// 5979/6260 branches, 2440/2442 functions and 7913/7932 lines. Two move, both set
			// under the ONE-FEWER figure by the headroom rule above — 9516 is 98.9600, so
			// statements takes 98.96, and 5978 is 95.4952, so branches takes 95.49. **Lines
			// and functions both stay, for the same arithmetic once more.** One fewer line is
			// 99.7478, which floors to the 99.74 already standing. One fewer function is
			// 99.8730, under the 99.90 standing, so headroom there would again be a decrease.
			//
			// Raised again on 2026-08-28, with the scope tree's keyboard (`scopeKeys.ts`) and
			// the release-fold prune fix (`RELEASE_FOLD` joining `notePath`/`scopeOf` in
			// `view/viewState.ts`): this machine measured 9627/9725 statements, 6046/6325
			// branches, 2459/2461 functions and 8003/8022 lines. Three move, each set under
			// the ONE-FEWER figure by the headroom rule above — 9626 is 98.9820, so statements
			// takes 98.98; 6045 is 95.5731, so branches takes 95.57; 8002 is 99.7507, so lines
			// takes 99.75. **Functions stays**, for the same arithmetic once more: one fewer is
			// 99.8781, under the 99.90 standing, so headroom there would again be a decrease.
			// Raised again on 2026-08-28, with the scope toolbar (collapse/expand/hide-done),
			// the all-done state, the gate move (carried finding 1), the row-rollup suppression
			// (carried finding 2), the row-end spacer (carried finding 3), the
			// `activeScopePath` leak fix (carried finding 4) and the drag-select guard on a
			// row's click (carried finding 5): this machine measured 9694/9792 statements,
			// 6092/6372 branches, 2470/2472 functions and 8063/8082 lines. Only branches moves —
			// 6091 is 95.5901, floored to 95.59, over the 95.57 standing. The other three all
			// floor their own one-fewer figure to the value already standing (98.98, 99.90,
			// 99.75 respectively — 9693 is 98.9890, 2469 is 99.8786, 8062 is 99.7525), which is
			// the same "a raise that changes nothing is not a raise" arithmetic this comment has
			// now stated five times.
			//
			// Re-derived on 2026-08-29, after merging main (the resource-assignee work) into
			// the release-detail branch, because the four numbers below had drifted AHEAD of
			// this comment: the paragraph above ends at branches 95.59 and the block said
			// 95.63, which is the same comment-versus-code defect this file has twice
			// recorded fixing. Review caught it and proposed lowering the gate to 95.59;
			// that is the one move ruled out, since a floor may not fall. So the arithmetic
			// is redone here against the merged tree instead, and it turns out to justify
			// what stands: this machine measures 9835/9932 statements, 6197/6479 branches,
			// 2511/2513 functions and 8178/8196 lines. One fewer branch is 95.6320, which
			// floors to exactly the 95.63 standing — so that number was already the headroom
			// figure and needed no change. Only statements moves: 9834 is 99.0133, so it
			// takes 99.01, over the 98.98 this branch started from. **Lines and functions
			// stay, for the arithmetic this comment has now stated six times.** One fewer
			// line is 99.7682, which floors to the 99.76 already standing. One fewer function
			// is 99.8806, under the 99.91 standing, so headroom there would again be a
			// decrease.
			//
			// The merge itself measured branches at 95.61 against the 95.63 floor, and the
			// two branches that closed the gap are worth naming because neither was a test
			// written to a number. One was DEAD — `scopeOf`'s `RELEASE_FOLD` arm in
			// `storage/foldKeys.ts`, unreachable because its only caller returns inside its
			// own `RELEASE_FOLD` branch first — which is the "look for the dead branch before
			// writing the test" case above, met for the third time. The other was a real gap:
			// every `renamePathPrefs` test saved both path picks, so the walk had never been
			// asked about an entry holding neither.
			//
			// **2026-08-29, and this time the drift reached `main`.** The four numbers below were
			// raised to 99.04/95.72/99.92/99.78 on the release-improvements branch, measured
			// there and green there — while the paragraph above still ends at 95.63, which is the
			// comment-versus-code defect this file has now recorded THREE times. What made this
			// one expensive is not the drift itself: a second pull request merged first, and the
			// tree that resulted from both measured 6350/6634 branches — 95.7190, floored to
			// 95.71 — against the 95.72 raised from a tree that never contained it. `main` went
			// red with every test passing on both platforms.
			//
			// **That is not the flake this comment is otherwise about, and the difference is what
			// matters.** The flake is one covered unit moving between runs; this reproduced
			// IDENTICALLY on Ubuntu, on Windows and on a third machine, all three reporting
			// 6350/6634. A figure three environments agree on is a fact about the tree, so the
			// answer was a branch, not a number: creating a child from a scope row at the VAULT
			// ROOT was untested, and without the guard it covers the prompt offers to file the
			// note `in folder "/"`.
			//
			// **`lines` was the same landmine one step behind, and a new gate is what found
			// it.** At 8427/8445 this tree cleared the 99.78 raised alongside branches by
			// exactly nothing: one fewer line is 99.7750, under it. So the next legitimate
			// change removing a covered line would have turned `main` red a second time, for
			// the same reason, with the first fix already merged. It was covered rather than
			// lowered too — `refreshSubtree`'s fallback when the row it was handed is not on
			// screen.
			//
			// **What replaces the arithmetic is `scripts/coverage-floors.mjs`**, which
			// `npm run test:coverage` runs on the coverage file the run just wrote. It asks the
			// one question this comment has answered by hand seven times — how many covered
			// units can this tree lose before the floor fails? — and fails the run at zero.
			// `functions` is named in its own list as knowingly tight, for the reason stated
			// above rather than as an exemption to forget.
			//
			// **So this comment stops recording measurements, and the reason is the merge
			// again.** `main` moved once more while the branch carrying this paragraph was
			// open — a small fix covering the progress gap — and the figures written here two
			// hours earlier were stale on arrival for the third time in one day. A measurement
			// is a fact about ONE tree and this file is read on every other; the gate above
			// re-derives it per run, which is the only spelling that cannot drift. What stays
			// here is the rule and the episodes that shaped it. The history of which decimal
			// moved in which increment is in git, which this comment already said once.
			//
			// **Every rise the arithmetic allows is declined for the same reason.** A floor
			// raised on a branch is asserted against a merge, and that is exactly the move that
			// produced the red above. A raise is worth taking when the tree it was measured on
			// is the tree that lands, and a branch open beside four others is never that tree.
			// The four numbers below stay; the gate is what guarantees they have room.
			//
			// **The mechanism that would have prevented all of it is not in this file.** No check
			// that runs on a tree can see a merge that has not happened yet — a branch's floor is
			// measured against a `main` it may not contain by the time it lands. GitHub's
			// "Require branches to be up to date before merging" is the setting for exactly this
			// class, it is the maintainer's to enable, and
			// `docs/issues/Two spec branches predate the use-case gate.md` has been asking for it
			// since the same class last broke `main`.
			thresholds: {
				statements: 99.04,
				branches: 95.72,
				functions: 99.92,
				lines: 99.78,
			},
		},
	},
});
