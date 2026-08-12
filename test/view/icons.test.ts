// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setIconRenderer } from '../helpers/obsidian-mock';
import { installObsidianDom } from '../helpers/dom';
import { drawIcon } from '../../src/view/render/icons';

installObsidianDom();

/**
 * The cached icon path. Its claim is exact parity with `setIcon` at a fraction of the
 * cost: whatever `setIcon` leaves on an element — the mock's `data-icon`, the harness
 * renderer's SVG child or its missing-name marker, Obsidian's parsed glyph — lands on
 * every element `drawIcon` serves, while the underlying builder runs once per name.
 * Distinct icon names per test: the template cache is module state, exactly like the
 * icons it holds, so a name built under one renderer stays built.
 */
describe('drawIcon', () => {
	beforeEach(() => {
		document.body.empty();
	});

	it('records the name the way setIcon does, so every existing assertion holds', () => {
		const el = document.body.createDiv();
		drawIcon(el, 'plus');
		expect(el.dataset.icon).toBe('plus');
	});

	it('builds a name once and clones it after — the cache is the mechanism, not a hope', () => {
		const built = vi.fn((el: HTMLElement, icon: string) => {
			el.createSvg('svg', { cls: ['svg-icon'] }).createSvg('path', { attr: { d: `M0 0 ${icon}` } });
		});
		setIconRenderer(built);
		const first = document.body.createDiv();
		const second = document.body.createDiv();
		drawIcon(first, 'grip-vertical');
		drawIcon(second, 'grip-vertical');
		expect(built).toHaveBeenCalledTimes(1);
		expect(second.innerHTML).toBe(first.innerHTML);
		expect(second.querySelector('svg.svg-icon path')?.getAttribute('d')).toBe('M0 0 grip-vertical');
	});

	it('carries a renderer marker through, so an unresolvable name stays visible', () => {
		setIconRenderer((el, icon) => {
			el.dataset.iconMissing = icon;
		});
		const el = document.body.createDiv();
		drawIcon(el, 'no-such-icon');
		expect(el.dataset.iconMissing).toBe('no-such-icon');
	});
});
