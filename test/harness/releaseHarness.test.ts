// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { LONG_NAME, mountReleaseHarness, ReleaseConfigVariant } from './mountRelease';
import { installObsidianDom } from '../helpers/dom';
import { en } from '../../src/i18n/en';

installObsidianDom();

/**
 * The release entry's own guarantees, `describe('the estimation harness mounts', ...)`'s
 * shape for the third view: it still mounts, the fixture still draws the cases it exists
 * for, and the `?config=` variants still make their states. In its own file rather than
 * `harness.test.ts`, which is within a handful of lines of the 450 the test budget allows.
 *
 * **What this file CANNOT check is the whole reason the entry exists.** jsdom computes no
 * layout and no styles, so nothing here sees a column ellipsise, an outline paint, or a row
 * take Tab focus — the `display: contents` defect passed eight jsdom tests. These assertions
 * pin that the entry keeps mounting the states a browser is opened to LOOK at; the looking
 * is `npm run harness -- test/harness/release.ts` and, for colour and theme, a live vault.
 */
describe('the release harness mounts', () => {
	function mount(variant?: ReleaseConfigVariant) {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountReleaseHarness(root, variant);
	}

	function names(containerEl: HTMLElement): (string | null)[] {
		return Array.from(containerEl.querySelectorAll('.pbl-rel-band .pbl-rel-name')).map((el) => el.textContent);
	}

	it('draws every release in the index, in the order the index sorts them', () => {
		const { containerEl } = mount();

		// In flight first — dated by date, undated last — then the shipped tail, newest
		// released first. The fixture exists to show that order, so a fixture that stopped
		// showing it would leave the screenshot proving nothing.
		expect(names(containerEl)).toEqual([
			'0.5',
			'0.8',
			'0.9',
			// The long-named band, which is also the long version and the long status: the one
			// row that shows which of line 1's cells yields its width first.
			LONG_NAME,
			'1.1',
			'Someday',
			'0.7',
			'0.6',
		]);
	});

	it('draws BOTH group headings, with the shipped tail under the second', () => {
		const { containerEl } = mount();

		// The whole of Task 7 on this screen, and the reason the fixture carries shipped
		// releases at all: with every release in flight the browser draws ONE heading and
		// the two-group layout cannot be looked at.
		expect(Array.from(containerEl.querySelectorAll('.pbl-rel-group')).map((el) => el.textContent)).toEqual([
			'In flight (6)',
			'Shipped (2)',
		]);
	});

	it('draws both answers a slip can give — shipped late, and shipped early', () => {
		const { containerEl } = mount();
		const note = (name: string) =>
			Array.from(containerEl.querySelectorAll('.pbl-rel-band'))
				.find((band) => band.querySelector('.pbl-rel-name')?.textContent === name)
				?.querySelector('.pbl-rel-band-note')?.textContent;

		// Both dates are fixed and both are past, so neither answer moves with the clock —
		// a slip is target against released, never against today.
		expect(note('0.7')).toBe('7 days late');
		// Early is a real answer, rendered differently, and no fixture exercised it before.
		expect(note('0.6')).toBe('7 days early');
	});

	it('counts the members and the unresolved memberships the fixture was built to show', () => {
		const { containerEl } = mount();
		// The member count is folded into the progress phrase rather than kept as its own
		// column — `column.rollupTooltip`, or `release.index.noMembers` for the release with
		// none. `Send the magic link` is the fixture's only member typed Done, which is why
		// 0.8 alone reads a numerator of 1.
		const progress = Array.from(containerEl.querySelectorAll('.pbl-rel-band')).map(
			(band) => band.querySelector('.pbl-rel-progress')?.textContent ?? band.querySelector('.pbl-rel-nomembers')?.textContent,
		);
		expect(progress).toEqual([
			// The overdue release: half done, so its bar has a fill to draw in the error colour.
			en['column.rollupTooltip'].other.replace('{done}', '1').replace('{count}', '2'),
			en['column.rollupTooltip'].other.replace('{done}', '1').replace('{count}', '3'),
			en['column.rollupTooltip'].one.replace('{done}', '0').replace('{count}', '1'),
			en['column.rollupTooltip'].one.replace('{done}', '0').replace('{count}', '1'),
			// 1.1 and Someday, neither with members.
			en['release.index.noMembers'],
			en['release.index.noMembers'],
			// The two shipped releases: one done member each, so the bar reads full — the
			// fill no in-flight band in this fixture reaches.
			en['column.rollupTooltip'].one.replace('{done}', '1').replace('{count}', '1'),
			en['column.rollupTooltip'].one.replace('{done}', '1').replace('{count}', '1'),
		]);
		// Both shapes: a value naming no note, and an Iteration carrying the property by hand.
		expect(containerEl.querySelector('.pbl-rel-note')?.textContent).toContain('2 items');
	});

	it('opens one release on a pick, with the member and the context row beneath it', () => {
		const { view, containerEl } = mount();
		view.pick('Releases/0.8.md');

		expect(containerEl.querySelector('.pbl-rel-header h2')?.textContent).toBe('0.8');
		expect(Array.from(containerEl.querySelectorAll('.pbl-row .pbl-title')).map((el) => el.textContent)).toEqual([
			'Sign-up flow',
			'Passwordless sign-in',
			'Send the magic link',
			'Expire the link',
		]);
		// The Epic holds two members and is one itself in neither direction — the only kind
		// of row that proves the scope draws scaffolding rather than inheriting membership.
		expect(containerEl.querySelectorAll('.pbl-rel-context').length).toBe(1);
	});

	it('draws the overdue band the default fixture exists to show', () => {
		const { containerEl } = mount();
		const overdue = Array.from(containerEl.querySelectorAll('.pbl-rel-overdue'));

		// Exactly one, and it is the release whose target is fixed in the past with nothing
		// released. A second would mean some other band had drifted into the treatment.
		expect(overdue.map((band) => band.querySelector('.pbl-rel-name')?.textContent)).toEqual(['0.5']);
		// The count itself moves with the clock and is not asserted; that it is the OVERDUE
		// sentence rather than a days-remaining one is the whole of what a browser is opened
		// to look at, and drawing "-N days left" here is the defect this pins.
		expect(overdue[0]?.querySelector('.pbl-rel-band-note')?.textContent).toMatch(/overdue$/);
		expect(overdue[0]?.querySelector('.pbl-rel-days')).toBeNull();
	});

	it('withholds the whole overdue treatment when no released-date property is bound', () => {
		const { containerEl } = mount('noreleased');

		// The upgrade state: the same past target, and NOT painted. Without the binding the
		// view cannot tell a late release from one that already shipped, so it says nothing
		// — [[Every release in one list]] 2f. This variant is the only way to look at it.
		expect(containerEl.querySelectorAll('.pbl-rel-overdue').length).toBe(0);
		expect(containerEl.querySelector('.pbl-rel-band-note')).toBeNull();
		// Every release reads in flight, so the Shipped heading has nothing to head.
		expect(Array.from(containerEl.querySelectorAll('.pbl-rel-group')).map((el) => el.textContent)).toEqual([
			'In flight (8)',
		]);
		// And the missing binding is named once beneath the list rather than left to be
		// guessed at from a screen that has quietly stopped saying anything.
		expect(containerEl.querySelector('.pbl-rel-note')?.textContent).toContain(en['release.index.column.released']);
	});

	it('draws a date it cannot read, beside a target it can', () => {
		const { containerEl } = mount();
		const band = Array.from(containerEl.querySelectorAll('.pbl-rel-band')).find(
			(el) => el.querySelector('.pbl-rel-name')?.textContent === '1.1',
		);

		// The one presentation this increment fixed three times and nobody has ever looked
		// at. The marker names WHICH figure is unreadable, and the target keeps its own date
		// and days count beside it — the two dates answer for themselves.
		expect(band?.querySelector('.pbl-rel-unreadable')?.textContent).toBe(
			en['release.figureUnreadable'].replace('{label}', en['release.index.column.released']),
		);
		// A civil date rather than a literal year: the fixture derives this target from the
		// clock (`inDays`), so a year written here would be a second statement of the same
		// fact and would go stale the way `2027-01-15` did — it was 18 days from turning
		// this assertion red on its own.
		expect(band?.querySelector('.pbl-rel-date')?.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(band?.querySelector('.pbl-rel-days')).not.toBeNull();
	});

	it('draws the scope header’s three write surfaces, in the two states each has', () => {
		const { view, containerEl } = mount();
		const header = () => containerEl.querySelector('.pbl-rel-header');

		// SET: `0.8` is the only release carrying a description, and the only screen where
		// the sentence has to wrap under a two-line header — the thing a browser is opened
		// for. Its status is a plain chip, and its released date draws NOTHING now:
		// `Mark as released` below is offered (2026-08-30) and is this fixture's way to set
		// it, so a second invitation on the same field would be two controls for one.
		view.pick('Releases/0.8.md');
		expect(header()?.querySelector('.pbl-rel-desc')?.classList.contains('pbl-rel-desc-empty')).toBe(false);
		expect(header()?.querySelector('.pbl-rel-status.pbl-state-unset')).toBeNull();
		expect(header()?.querySelector('.pbl-rel-released')).toBeNull();
		expect(containerEl.querySelector('.pbl-rel-close')).not.toBeNull();

		// UNSET: `Someday` is the release nobody has ruled on — no version, no target, no
		// status, no description. Its status and description are still invitations; its
		// released date is withheld for the same reason 0.8's is — `Mark as released` is
		// offered here too, since a release with nothing ruled on is not already out.
		view.pick('Releases/Someday.md');
		expect(header()?.querySelector('.pbl-rel-status.pbl-state-unset')).not.toBeNull();
		expect(header()?.querySelector('.pbl-rel-desc.pbl-rel-desc-empty')).not.toBeNull();
		expect(header()?.querySelector('.pbl-rel-released')).toBeNull();

		// SHIPPED: the released date as a VALUE rather than an invitation — the state the
		// index's Shipped group is built on, and the one form of this control no screen drew
		// before the date became settable at all.
		view.pick('Releases/0.7.md');
		expect(header()?.querySelector('.pbl-rel-released-unset')).toBeNull();
		expect(header()?.querySelector('.pbl-rel-released')?.textContent).toBe(
			en['release.scope.releasedOn'].replace('{date}', '2026-06-18'),
		);
	});

	it('refuses all three controls on the release whose every figure is unreadable', () => {
		const { view, containerEl } = mount();
		view.pick('Releases/1.1.md');
		const header = containerEl.querySelector('.pbl-rel-header');

		// `drawStatus`, `drawReleased` and `drawDescription` each refuse a value they cannot
		// read, and each says WHICH figure it is refusing rather than going quiet. Three
		// refusals on one screen is the state this fixture exists to draw: "somebody wrote
		// something there" is not an invitation to write over it blind, so not one of the
		// three is a control.
		expect(Array.from(header?.querySelectorAll('.pbl-rel-unreadable') ?? []).map((el) => el.textContent)).toEqual([
			en['release.figureUnreadable'].replace('{label}', en['release.index.column.status']),
			en['release.figureUnreadable'].replace('{label}', en['release.index.column.released']),
			en['release.figureUnreadable'].replace('{label}', en['release.scope.descriptionLabel']),
		]);
		expect(header?.querySelector('.pbl-rel-status')).toBeNull();
		expect(header?.querySelector('.pbl-rel-released')).toBeNull();
		expect(header?.querySelector('.pbl-rel-desc')).toBeNull();
		// And the way OUT of that state is still one press away: the note itself is where an
		// unreadable value is repaired, which is what makes refusing the three honest.
		expect(header?.querySelector('.pbl-rel-open')).not.toBeNull();
	});

	it('mounts the four unconfigured states each variant exists for', () => {
		expect(mount('notype').containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('type property');

		const empty = mount('empty').containerEl;
		expect(empty.querySelector('.pbl-empty-title')?.textContent).toContain('No releases');
		// A base with no release is the state where EVERY membership value is unresolved —
		// all nine the fixture holds, not just the two the index reports — so the note under
		// the empty state is the whole of what it can report.
		expect(empty.querySelector('.pbl-rel-note')?.textContent).toContain('11 items');

		const nomembership = mount('nomembership');
		nomembership.view.pick('Releases/0.8.md');
		expect(nomembership.containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('membership property');
	});
});
