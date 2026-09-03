/**
 * Mount the REAL release view outside Obsidian — `mountEstimation.ts`'s own purpose and
 * shape, narrowed to `ReleaseView`: nothing here depends on vitest, so the same view
 * bundles into a page (`npm run harness -- test/harness/release.ts`) and opens in a
 * browser. It draws; it checks nothing (ADR 0020).
 *
 * **This is the entry the branch went without, and its absence is why a `display:
 * contents` defect that made the whole index unreachable by keyboard survived eight
 * tests, two reviews and a fix round.** jsdom computes no layout and no styles, so
 * appearance, focusability and geometry are exactly the questions its tests cannot
 * answer; this is where they can be looked at. What it still does NOT answer is a themed
 * vault's colours, its accent, and anything Bases hands the view — the live-vault check
 * is owed either way.
 *
 * No `WriteLock` and no `vault.afterWrite` wiring, unlike both existing mounts: this view
 * creates notes and its own config but plans no batch, so there is nothing to serialize
 * and no refresh to drive. A lock parameter here would suggest otherwise.
 */
import { ReleaseView } from '../../src/view/release/releaseView';
import { WriteLock } from '../../src/view/writeLock';
import { drawChrome } from './chrome';
import { drawIcons } from './icons';
import { installObsidianDom } from '../helpers/dom';
import { RELEASE_CONFIG } from '../helpers/release';
import { fakeController, FakeVault, FakeViewConfig, mountView } from '../helpers/vault';
import { FileView } from '../helpers/obsidian-mock';

/**
 * `?config=` on the page (`release.ts`): `empty` mounts a base holding no release at all
 * (the empty state, plus the unresolved memberships it must still report), `notype`
 * with the type property unbound (the configuration state), `nomembership` with the
 * membership property unbound — the index's absent-column note, and, with `?pick=`, the
 * scope screen's own unconfigured state — and `noreleased` with the RELEASED-DATE property
 * unbound. Anything else binds every key.
 *
 * **`noreleased` is the state every saved release view is in on upgrade**, and it exists
 * because the OVERDUE treatment is the one thing on this screen with two lookable forms and
 * the fixture could reach neither. Nobody has bound `releasedDateProperty` before this
 * increment, so with it unbound: no release is ever painted overdue however far its target
 * has passed, the Shipped group has nothing to hold and its heading is not drawn, no slip
 * appears, and the note beneath the list names the missing binding. The DEFAULT variant is
 * the other half of the pair — `Releases/0.5` there is overdue and painted — so the two
 * pages side by side are the whole of what [[Every release in one list]] 2e and 2f say.
 * Three rounds of this increment wanted this and reverted a temporary edit instead.
 */
export type ReleaseConfigVariant = 'full' | 'empty' | 'notype' | 'nomembership' | 'noreleased';

/**
 * Every key bound — `RELEASE_CONFIG` plus the notes FOLDER, which that constant omits on
 * purpose: the suite's default is the unbound case (`releaseNotes.test.ts` asserts the
 * "bind the folder" note against it, and its neighbour passes an override to get the
 * button). The harness wants the opposite default, so that the paragraph above claiming
 * this variant "binds every key" is true of the one control the closing increment added.
 *
 * It was a folder being undrawable by Obsidian's PROPERTY picker that made this necessary,
 * and ✨ has bound the option since 2026-08-30 — so that is no longer the reason. The reason
 * narrows rather than going away: this mount hands the view a config directly and presses
 * nothing, so what the constant supplies is the state AFTER a press, which is what "binds
 * every key" has to mean on a page with no press in it.
 */
// The two risk VOCABULARIES are bound HERE and not in `RELEASE_CONFIG`, which holds them
// out on purpose: ✨ binds no key for either, so a fixture that bound them would describe a
// state no press can reach, and four init suites read that constant for exactly that
// question. The harness is asking a different one — what the chip row LOOKS like — and the
// risk criterion cannot draw a verdict at all until a vocabulary says which values are
// critical. Without these two lines the page can only ever show "not configured".
const FULL = {
	...RELEASE_CONFIG,
	releaseNotesFolder: 'Releases/Notes',
	criticalRiskValues: 'High, Critical',
	addressedRiskValues: 'Mitigated, Accepted',
	// `capacityProperty` and `capacityUnit` are already in `RELEASE_CONFIG` (✨ binds both
	// since the product owner's reversal), so these two lines are no longer load-bearing —
	// only `pts` in place of `RELEASE_CONFIG`'s own `points`, kept explicit so the harness's
	// unit reads distinctly from a plain press's.
	capacityProperty: 'note.capacity',
	capacityUnit: 'pts',
};

function configValues(variant: ReleaseConfigVariant): Record<string, unknown> {
	if (variant === 'notype') return { ...FULL, typeProperty: '' };
	if (variant === 'nomembership') return { ...FULL, membershipProperty: '' };
	if (variant === 'noreleased') return { ...FULL, releasedDateProperty: '' };
	return FULL;
}

/** The one release named rather than numbered — see the fixture's own note below.
 *  Exported because the assertions name the band by its name, and two copies of a
 *  60-character string are one edit from disagreeing. */
export const LONG_NAME = 'Autumn platform release for billing and passwordless sign-in';

/**
 * A civil date `days` from today, for the targets that must stay in the FUTURE.
 *
 * Derived rather than written down, and that is this fixture's own dated-failure fix: three
 * literal near-future targets (2026-09-12 among them) made these assertions go red on a
 * date with nothing changed — `0.8` becomes overdue on 2026-09-13, so the overdue test's
 * "exactly one band" fails on `main` with no commit behind it, and `1.1`'s days-left cell
 * is withheld once its target passes. `test/view/releaseIndex.test.ts` answers the same
 * hazard with fixed far dates (`PAST = '2000-01-01'`, `FUTURE = '2099-01-01'`) because what
 * it asserts is a SIGN; this fixture is the thing a browser is opened to LOOK at, where
 * "26,700 days left" is not a plausible backlog, so the sign is fixed by construction
 * instead. A PAST date needs no helper — it can never become a future one.
 */
function inDays(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A release programme rather than the suite's own three-note fixtures: nine releases —
 * seven in flight (one OVERDUE, one carrying a date nobody can read, one whose STATUS says
 * released while its date is empty) and two shipped, so the index has an order AND both
 * group headings to show — members under an Epic that is NOT a member so the scope screen
 * draws a context row, and both kinds of unresolved membership so the note under the list
 * has something to count.
 *
 * The longest version, the longest status and the longest NAME are deliberate, and they
 * are on one band: a band's line 1 shares its width between them, so which cell yields
 * and which ellipsises is only visible where all three are long at once. The name went in
 * on 2026-08-26, when a review measured that band at a 500px pane and found the name
 * CLIPPED with no ellipsis and the version shrunk to 0px — a case the fixture had never
 * been able to show, because every release in it was named after its own version.
 */
function releaseHarnessVault(variant: ReleaseConfigVariant): FakeVault {
	const vault = new FakeVault();
	if (variant !== 'empty') {
		const release = (path: string, frontmatter: Record<string, unknown>): void => {
			vault.addFile(path, { frontmatter: { type: 'Release', ...frontmatter } });
		};
		// OVERDUE: a target already past with no released date, which is the only shape that
		// paints the band's four red signals. The date is FIXED and past rather than derived
		// from the clock, so the treatment is on the page whatever day it is opened — the
		// days-overdue count is the one figure here that moves, and it moves upward.
		release('Releases/0.5.md', { version: '0.5.0', 'target-date': '2026-05-04', status: 'In progress', order: 0 });
		// The one release with a DESCRIPTION, and the only one with a long enough scope to open
		// on (`?pick=Releases/0.8.md`): the header's description line and its status chip are
		// this screen's two write surfaces ([[Editing a release from its own screen]]), and
		// neither is drawable in jsdom — one wraps a sentence under a two-line header and the
		// other is a chip that has to refuse Obsidian's own button chrome. Every other release
		// here carries none, which is the INVITATION state the same line draws.
		release('Releases/0.8.md', {
			version: '0.8.0',
			'target-date': inDays(18),
			status: 'In progress',
			description: 'Everything the private beta asked for: passwordless sign-in, and the billing rewrite behind it.',
			order: 1,
			// Below the members' summed 8 points (5 + 3), so the scope screen shows the
			// OVER-COMMITTED sentence — the state with the most text in it, and therefore the
			// one that wraps first at full width, which is the reason to look.
			capacity: 5,
		});
		release('Releases/0.9.md', { version: '0.9.0', 'target-date': inDays(60), status: 'Planned', order: 2 });
		// The long band: a 60-character name, the longest version and the longest status on
		// one line 1. A release named rather than numbered is an ordinary vault, and it is
		// the only shape that asks which of the three cells yields first.
		release(`Releases/${LONG_NAME}.md`, {
			version: '1.0.0-rc.4+2026.08.23',
			'target-date': inDays(101),
			status: 'Waiting on the platform team',
			order: 3,
		});
		// The one shape this increment fixed three times and nobody has ever LOOKED at: a
		// date the view cannot read. It is the released one, beside a target that reads
		// perfectly, because the fix those three rounds arrived at is that the two dates
		// answer for THEMSELVES — the marker names which figure is unreadable and the target
		// keeps its date and its days count beside it. The target's own marker is the same
		// treatment in the same slot, so one release is enough to look at how it draws.
		// `1.1` carries ALL THREE, and the scope screen is why: `drawStatus`, `drawReleased`
		// and `drawDescription` each have an unreadable branch, each drawing the same
		// `.pbl-rel-unreadable` refusal in place of the control, and until 2026-08-29 only the
		// released date could reach one here. A list is what a person writes when they mean
		// two of something, and it is the shape all three readers refuse. So this is the
		// release whose whole header is a refusal — nothing on it is editable, and the note
		// itself is one press away, which is the answer that screen gives.
		release('Releases/1.1.md', {
			version: '1.1.0',
			'target-date': inDays(142),
			released: 'soon',
			status: ['Planned', 'Delayed'],
			description: ['Passwordless everywhere', 'and the billing rewrite'],
			order: 4,
		});
		// No version, no target date and — since 2026-08-29 — no STATUS: the row
		// [[Every release in one list]] 3a sorts after every dated one, and the only one whose
		// target cell says so rather than sitting blank. The status went because an unset one
		// is an INVITATION on the scope screen rather than an absence (`drawStatus`: a dashed
		// `.pbl-state-unset` chip opening the same menu), and every release here carried one,
		// so the state a reader meets on a release nobody has ruled on was undrawable. This is
		// the release with nothing set at all, which is what makes it the honest place for it.
		release('Releases/Someday.md', {});
		// The state this whole increment turns on, and no fixture could reach it: a status
		// that already READS as released with no released date beside it. `closeOffer`
		// withholds `Mark as released` on `alreadyOut` — marking a release that is already
		// out would write a date over a decision somebody has already recorded — so this is
		// where `drawReleased` draws its invitation instead, which is the one branch of that
		// control a browser had no way to look at. NO target date on purpose: this release
		// must not join the overdue treatment the two assertions above are about, and an
		// undated row is the honest shape for one whose status says it has already gone out.
		release('Releases/1.2.md', { version: '1.2.0', status: 'Released', order: 7 });
		// The SHIPPED tail, without which the browser draws one heading and the two-group
		// layout is unlookable — the whole point of this increment. Both released dates are
		// fixed and already past, so the group is stable whatever day the page is opened,
		// unlike `overdue` and the days-remaining figure, which move with the clock.
		// The two answers a slip can give, one each: 0.7 shipped a week LATE, 0.6 a week
		// EARLY. Early is a real answer the band renders differently and no fixture had.
		release('Releases/0.6.md', {
			version: '0.6.0',
			'target-date': '2026-03-16',
			released: '2026-03-09',
			status: 'Released',
			order: 5,
		});
		release('Releases/0.7.md', {
			version: '0.7.0',
			'target-date': '2026-06-11',
			released: '2026-06-18',
			status: 'Released',
			order: 6,
		});
	}

	vault.addFile('Sign-up flow.md', { frontmatter: { type: 'Epic', order: 1 } });
	// 0.8's members carry the readiness properties, and they are picked so every criterion
	// lands on `partly` rather than on a verdict with nothing to compare it against.
	// `satisfied` and `not` are one uniform member away in either direction; the mixed state
	// is the only one that draws a cleared count, an outstanding count and both colours at
	// once — and it is the state the chip row was designed against.
	vault.addFile('Passwordless sign-in.md', {
		frontmatter: {
			type: 'Feature',
			parent: '[[Sign-up flow]]',
			order: 1,
			release: '[[0.8]]',
			// No `effort` at all: the unestimated figure needs something to count, and a
			// member missing the key is what "unestimated" MEANS.
			dependsOn: '[[Session handling]]',
			risk: 'Critical',
		},
	});
	vault.addFile('Send the magic link.md', {
		frontmatter: {
			type: 'PBI',
			parent: '[[Passwordless sign-in]]',
			order: 1,
			release: '[[0.8]]',
			status: 'Done',
			effort: 5,
			risk: 'Low',
		},
	});
	vault.addFile('Expire the link.md', {
		frontmatter: {
			type: 'PBI',
			parent: '[[Passwordless sign-in]]',
			order: 2,
			release: '[[0.8]]',
			status: 'Ready',
			effort: 3,
			// Cleared: its prerequisite is Done. Beside the unmet one above, the blocked
			// chip draws a count on each side rather than a single-sided zero.
			dependsOn: '[[Send the magic link]]',
			// Critical AND addressed — the pair the risk criterion exists to tell apart from
			// the bare `Critical` above.
			risk: ['Critical', 'Mitigated'],
		},
	});
	vault.addFile('Session handling.md', {
		frontmatter: { type: 'Feature', parent: '[[Sign-up flow]]', order: 2, release: '[[0.9]]' },
	});
	vault.addFile('Billing.md', { frontmatter: { type: 'Epic', order: 2 } });
	vault.addFile('Invoices.md', {
		frontmatter: { type: 'Feature', parent: '[[Billing]]', order: 1, release: `[[${LONG_NAME}]]` },
	});
	// One done member each, so a shipped band draws a FULL bar rather than "No items yet" —
	// the one fill percentage no other release in this fixture reaches.
	vault.addFile('Card payments.md', {
		frontmatter: { type: 'Feature', parent: '[[Billing]]', order: 2, release: '[[0.7]]', status: 'Done' },
	});
	vault.addFile('Tax rates.md', {
		frontmatter: { type: 'Feature', parent: '[[Billing]]', order: 3, release: '[[0.6]]', status: 'Done' },
	});
	// Two members for the overdue release, one of them done: an overdue band draws its bar in
	// the error colour, and a bar needs a fill somewhere between empty and full to be looked
	// at. "No items yet" draws no bar at all, so a memberless overdue release would show
	// three of the four signals and hide the one this pair exists for.
	vault.addFile('Audit log.md', {
		frontmatter: { type: 'Feature', parent: '[[Billing]]', order: 4, release: '[[0.5]]', status: 'Done' },
	});
	vault.addFile('Retention policy.md', {
		frontmatter: { type: 'Feature', parent: '[[Billing]]', order: 5, release: '[[0.5]]', status: 'Ready' },
	});
	// The two shapes the note under the list counts: a value naming no note at all, and a
	// row the plan does not hold carrying the property by hand.
	vault.addFile('Rotate the signing key.md', { frontmatter: { type: 'PBI', order: 3, release: '[[Gone]]' } });
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 1, release: '[[0.8]]' } });
	return vault;
}

export interface MountedReleaseHarness {
	view: ReleaseView;
	vault: FakeVault;
	containerEl: HTMLElement;
}

/**
 * Build the view into `root`. The Bases leaf is real nesting, `mountHarness`'s own
 * reason: the view-state store — this view's picked release — has no identity to key on
 * without it, so without the leaf every pick would be forgotten on the next data update.
 */
export function mountReleaseHarness(root: HTMLElement, variant: ReleaseConfigVariant = 'full'): MountedReleaseHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const vault = releaseHarnessVault(variant);
	const leafEl = root.createDiv('pbl-harness-leaf');
	const containerEl = leafEl.createDiv();
	vault.addLeaf(new FileView(vault.addFile('Releases demo.base'), leafEl));

	const view = new ReleaseView(fakeController(), containerEl, new WriteLock());
	const config = new FakeViewConfig(configValues(variant));
	config.name = 'Releases';
	mountView(view, vault, config, vault.entries());

	return { view, vault, containerEl };
}
