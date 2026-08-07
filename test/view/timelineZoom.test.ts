// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { cellLabels } from '../helpers/roadmap';
import { scaleFor } from '../../src/domain/timeline';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function datedVault() {
	const vault = new FakeVault();
	vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-20' } });
	return vault;
}

function zoomButton(containerEl: HTMLElement, label: string): HTMLButtonElement {
	const btn = containerEl.querySelector<HTMLButtonElement>(`.pbl-zoom-btn[aria-label="${label}"]`);
	if (!btn) throw new Error(`zoom button not found: ${label}`);
	return btn;
}

describe('the zoom control', () => {
	it('renders only on the dated axis, and states which scale is active', () => {
		const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');

		expect(zoomButton(containerEl, 'Zoom to months').getAttribute('aria-pressed')).toBe('true');
		zoomButton(containerEl, 'Zoom to quarters').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(zoomButton(containerEl, 'Zoom to quarters').getAttribute('aria-pressed')).toBe('true');
		expect(view.zoom).toBe('quarter');
	});

	it('is absent in tree mode, on the board, and on the horizon axis', () => {
		const vault = datedVault();
		vault.addFile('Triaged.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, horizonProperty: 'note.horizon' }, { collapsed: true });

		expect(containerEl.querySelector('.pbl-zoom-picker')).toBeNull();
		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		expect(containerEl.querySelector('.pbl-zoom-picker')).toBeNull();
		view.setAxisPick('dates');
		expect(containerEl.querySelector('.pbl-zoom-picker')).not.toBeNull();
	});

	it('comes back at the scale it was left, across a reopen', () => {
		// A round trip, not a store call: `CollapseState` is what holds this, and a
		// store-only change gives a picker that works all session and reverts the moment
		// the view is reopened — nothing fails until someone comes back the next day.
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		first.view.setProjection('roadmap');
		first.view.setZoom('week');
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(second.view.zoom).toBe('week');
	});

	it('is session-only in an embedded base — the exception it joins, checked not assumed', () => {
		// `collapseStoreIdentity` deliberately returns no identity for an embedded view,
		// so nothing persists there today: not collapse state, not the mode, not the
		// axis, and now not the zoom. That gap is [[Embedded bases do not persist
		// collapse state]]'s, and minting an identity is a collision question about
		// where a base is embedded, not a timeline question.
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true });
		first.view.setProjection('roadmap');
		first.view.setZoom('week');
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true });
		expect(second.view.zoom).toBe('month');
	});

	it('redraws the header at the picked unit without touching a note', () => {
		const vault = datedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');

		view.setZoom('quarter');
		expect(cellLabels(containerEl).some((l) => /^Q[1-4]$/.test(l))).toBe(true);
		expect(vault.writeLog).toHaveLength(0);
		expect(scaleFor(view.zoom).dayPx).toBe(2);
	});
});

describe('jump to today', () => {
	it('puts today back in view from a scrolled position', () => {
		const vault = datedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		if (!scroller) throw new Error('no timeline scroller');
		// NARROWER than twice the lead column, which is the case the centring gets wrong:
		// at 600px a bug that ignores the sticky lead still lands today in view and the
		// test passes. The timeline note says a narrow split is the common case, so the
		// fixture is one.
		Object.defineProperty(scroller, 'clientWidth', { value: 320, configurable: true });
		scroller.scrollLeft = 4000;

		containerEl.querySelector<HTMLButtonElement>('.pbl-today-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Centred in the band the reader can SEE — viewport 220…320 — not in the whole
		// scrollport, whose left 220px the lead column covers at every scroll position.
		const todayLeft = view.roadmap?.todayLeft ?? 0;
		expect(scroller.scrollLeft).toBe(Math.max(todayLeft - TIMELINE_LEAD_PX - 50, 0));
	});
});

describe('the density toggle', () => {
	function densityButton(containerEl: HTMLElement): HTMLButtonElement {
		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-density-toggle');
		if (!btn) throw new Error('density toggle not found');
		return btn;
	}

	it('compacts the grid from the toolbar without touching a note or the base', () => {
		const vault = datedVault();
		const { view, containerEl, config } = makeView(vault, DATE_AXIS, { collapsed: true });
		expect(containerEl.querySelector('.pbl-density-toggle')).toBeNull(); // tree mode
		view.setProjection('roadmap');

		expect(densityButton(containerEl).getAttribute('aria-pressed')).toBe('false');
		densityButton(containerEl).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(densityButton(containerEl).getAttribute('aria-pressed')).toBe('true');
		// The name is the setting, not the next action: it must NOT flip with the
		// state, or the pressed toggle announces the mode it is not in.
		expect(densityButton(containerEl).getAttribute('aria-label')).toBe('Compact rows');
		expect(containerEl.querySelector('.pbl-timeline')?.classList.contains('pbl-density-compact')).toBe(true);
		expect(vault.writeLog).toHaveLength(0);
		expect(config.setCalls).toEqual([]);

		// Toggling back clears the class and the pick.
		densityButton(containerEl).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-timeline')?.classList.contains('pbl-density-compact')).toBe(false);
		expect(view.density).toBeNull();
	});

	it('comes back compact across a reopen, and reads a foreign value as comfortable', () => {
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		first.view.setProjection('roadmap');
		first.view.setDensity('compact');
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(second.view.density).toBe('compact');
		second.view.onunload();

		// Stored state is user-writable data another version may have written: an
		// unknown density reads back as the default, never trusted into the class.
		const map = vault.localStorage.get('product-backlog:collapse') as Record<string, { density?: string }>;
		map['Plan.base#Roadmap'].density = 'cozy';
		const third = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(third.view.density).toBeNull();
	});
});

