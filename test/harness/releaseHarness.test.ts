// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountReleaseHarness, ReleaseConfigVariant } from './mountRelease';
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
		expect(names(containerEl)).toEqual(['0.8', '0.9', '1.0', 'Someday', '0.7', '0.6']);
	});

	it('draws BOTH group headings, with the shipped tail under the second', () => {
		const { containerEl } = mount();

		// The whole of Task 7 on this screen, and the reason the fixture carries shipped
		// releases at all: with every release in flight the browser draws ONE heading and
		// the two-group layout cannot be looked at.
		expect(Array.from(containerEl.querySelectorAll('.pbl-rel-group')).map((el) => el.textContent)).toEqual([
			'In flight (4)',
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
			en['column.rollupTooltip'].other.replace('{done}', '1').replace('{count}', '3'),
			en['column.rollupTooltip'].one.replace('{done}', '0').replace('{count}', '1'),
			en['column.rollupTooltip'].one.replace('{done}', '0').replace('{count}', '1'),
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

	it('mounts the three unconfigured states each variant exists for', () => {
		expect(mount('notype').containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('type property');

		const empty = mount('empty').containerEl;
		expect(empty.querySelector('.pbl-empty-title')?.textContent).toContain('No releases');
		// A base with no release is the state where EVERY membership value is unresolved —
		// all nine the fixture holds, not just the two the index reports — so the note under
		// the empty state is the whole of what it can report.
		expect(empty.querySelector('.pbl-rel-note')?.textContent).toContain('9 items');

		const nomembership = mount('nomembership');
		nomembership.view.pick('Releases/0.8.md');
		expect(nomembership.containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('membership property');
	});
});
