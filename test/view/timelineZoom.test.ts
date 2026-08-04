// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, refresh, treeOf, useViewHarness } from '../helpers/view';
import { cellLabels, shelfOf } from '../helpers/roadmap';
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
		expect(cellLabels(containerEl).some((l) => /^Q[1-4] \d{4}$/.test(l))).toBe(true);
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

describe('the shelf on a narrow pane', () => {
	function shelvedVault() {
		const vault = new FakeVault();
		vault.addFile('Dated.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04' } });
		for (let i = 0; i < 6; i++) vault.addFile(`Unplanned ${i}.md`, { frontmatter: { type: 'PBI', order: 20 + i } });
		return vault;
	}

	function widthOf(el: HTMLElement, width: number) {
		Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
	}

	it('compacts on a narrow pane and states so on a real control', () => {
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();

		const toggle = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle');
		expect(toggle?.getAttribute('aria-expanded')).toBe('false');
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(true);
		// The way back is a press, not an arrow into the dark: a real focusable control
		// outside the composite, naming the region it controls.
		expect(toggle?.getAttribute('aria-controls')).toBe(shelfOf(containerEl)?.id);
	});

	it('a press overrides the width, and survives the rebuild a write causes', () => {
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();

		containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);

		refresh(view, vault);
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);
	});

	it('answers a keyboard activation, because it is a real button', () => {
		// Asserted as a CONTROL, not as a class: it is the way back to cards a
		// measurement hid, so reaching it without a pointer is the whole point of
		// putting it in the toolbar rather than on the shelf's header.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();
		const toggle = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle');

		expect(toggle?.tagName).toBe('BUTTON');
		toggle?.focus();
		// Enter on a focused button dispatches a click; the harness's `key` helper does
		// not, so the activation is driven the way the browser would deliver it.
		toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

		expect(toggle?.getAttribute('aria-expanded')).toBe('true');
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);
	});

	it('releases a selection the toggle itself just hid', () => {
		// The toggle path re-renders nothing, so a selection left behind would keep
		// `aria-activedescendant` pointing into hidden content until some later
		// navigation happened to move it. Reconciled in the one compaction path, so
		// this passes for the same reason the resize case does.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		view.setShelfCollapsed(false);
		widthOf(treeOf(containerEl), 900);
		view.render();
		const shelfCard = view.roadmap?.cards.at(-1);
		view.selectItem(shelfCard as never);

		containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.selectedPath).not.toBe(shelfCard?.file.path);
		expect(treeOf(containerEl).getAttribute('aria-activedescendant')).not.toBe(shelfCard?.file.path);
	});

	it('measures again after a resize, not only on the first render', () => {
		// A fixture that is only ever measured once cannot fail this: the pane crosses
		// the threshold AFTER the first render, which is the case the tree's own ladder
		// needed a ResizeObserver for.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 900);
		view.render();
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);

		widthOf(treeOf(containerEl), 320);
		(view as unknown as { onResize(): void }).onResize();

		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(true);
	});

	it('takes hidden cards out of the navigable set and clamps a selection in them', () => {
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		view.setShelfCollapsed(false);
		const shelfCard = view.roadmap?.cards.at(-1);
		view.selectItem(shelfCard as never);

		widthOf(treeOf(containerEl), 320);
		(view as unknown as { onResize(): void }).onResize();

		// A keyboard user with no visible position is the worse half of "hidden versus
		// absent", so the selection is clamped the way a vanished board column already
		// clamps `selectedBoardColumn`.
		expect(view.roadmap?.cards.map((c) => c.file.path)).not.toContain(shelfCard?.file.path);
		expect(view.selectedPath).not.toBe(shelfCard?.file.path);
	});

	it('stops calling the pane a listbox when compaction leaves it no options', () => {
		const vault = new FakeVault();
		for (let i = 0; i < 6; i++) vault.addFile(`Unplanned ${i}.md`, { frontmatter: { type: 'PBI', order: 10 + i } });
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();

		expect(treeOf(containerEl).getAttribute('role')).toBe('region');
	});

	it('keeps the toggle pointing at the shelf a content-only render just rebuilt', () => {
		// The toolbar outlives the pane: a quick filter rebuilds the pane and leaves the
		// toolbar standing, so a per-render id would leave `aria-controls` naming a
		// detached node — which exposes no region at all. The id is fixed for the life of
		// the VIEW, not a constant: two saved views can sit in split panes.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();
		const before = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.getAttribute('aria-controls');

		view.setFilter('Unplanned');

		expect(containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.getAttribute('aria-controls')).toBe(before);
		expect(shelfOf(containerEl)?.id).toBe(before);
	});
});
