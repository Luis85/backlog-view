// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadViewState } from '../../../src/storage/viewStateStore';
import { WriteLock } from '../../../src/view/writeLock';
import { button, makeReleaseView, RELEASE_CONFIG, releaseVault, scopeVault } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';

useViewHarness();

const ID = { base: 'Releases.base', view: 'Backlog' };

function mounted(lock = new WriteLock()) {
	return makeReleaseView(releaseVault(), RELEASE_CONFIG, { base: 'Releases.base', lock });
}

describe('the List | Map control', () => {
	it('heads the index as a named group, with List pressed', () => {
		const { view } = mounted();
		const group = view.viewEl.querySelector('.pbl-rel-actions .pbl-rel-tabs');
		expect(group?.getAttribute('role')).toBe('group');
		expect(group?.getAttribute('aria-label')).toBe('Show releases as');
		expect(button(view, '.pbl-rel-tab-list').getAttribute('aria-pressed')).toBe('true');
		expect(button(view, '.pbl-rel-tab-map').getAttribute('aria-pressed')).toBe('false');
		// First in the bar, so `New release` stays last.
		expect(view.viewEl.querySelector('.pbl-rel-actions')?.firstElementChild).toBe(group);
	});

	it('switches to the map, presses Map, and remembers only that word', () => {
		const { view } = mounted();
		button(view, '.pbl-rel-tab-map').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
		expect(button(view, '.pbl-rel-tab-map').getAttribute('aria-pressed')).toBe('true');
		expect(loadViewState(view.app, ID).prefs.releaseTab).toBe('map');

		button(view, '.pbl-rel-tab-list').click();
		expect(view.viewEl.querySelector('.pbl-rel-bands')).not.toBeNull();
		expect(loadViewState(view.app, ID).prefs.releaseTab).toBeUndefined();
	});

	it('keeps focus on the tab that was pressed, across the redraw it caused', () => {
		const { view } = mounted();
		const map = button(view, '.pbl-rel-tab-map');
		map.focus();
		map.click();
		expect(document.activeElement).not.toBe(map);
		expect(document.activeElement).toBe(button(view, '.pbl-rel-tab-map'));
	});

	it('keeps focus on the same map row across a data update', () => {
		const { view } = mounted();
		view.setTab('map');
		button(view, '.pbl-relmap-row[data-path="0.9.md"]').focus();
		view.onDataUpdated();
		expect((document.activeElement as HTMLElement | null)?.dataset.path).toBe('0.9.md');
	});

	it('stays enabled while a write holds the lock, since switching tabs writes nothing', () => {
		const lock = new WriteLock();
		const { view } = mounted(lock);
		lock.applying = true;
		lock.notify();
		expect(button(view, '.pbl-rel-new').disabled).toBe(true);
		expect(button(view, '.pbl-rel-tab-list').disabled).toBe(false);
		expect(button(view, '.pbl-rel-tab-map').disabled).toBe(false);
	});

	it('is not drawn on a release’s own screen', () => {
		const { view } = makeReleaseView(scopeVault(), RELEASE_CONFIG, { base: 'Releases.base' });
		view.pick('R.md');
		expect(view.viewEl.querySelector('.pbl-rel-tabs')).toBeNull();
	});
});
