// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The Daily pick is working position (stored per saved view, per device); the spotlight is
 * something being looked at right now (session only, like the shelf search).
 */
describe('the iteration daily pick and the spotlight', () => {
	it('reopens Daily when the last session chose it, without writing the .base', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		expect(first.view.iterationDaily).toBe(false);
		first.view.setIterationDaily(true);
		first.view.onunload();

		expect(first.config.setCalls).toEqual([]);
		expect(makeView(vault, {}, { base: 'Backlog.base' }).view.iterationDaily).toBe(true);
	});

	it('stores nothing once the pick is back at the default', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setIterationDaily(true);
		first.view.setIterationDaily(false);
		first.view.onunload();
		expect(makeView(vault, {}, { base: 'Backlog.base' }).view.iterationDaily).toBe(false);
	});

	it('renders when the pick changes', () => {
		const { view } = makeView(fixture(), {}, { base: 'Backlog.base' });
		const render = vi.spyOn(view as unknown as { render(): void }, 'render');
		view.setIterationDaily(true);
		expect(render).toHaveBeenCalledTimes(1);
	});

	it('holds the spotlight for the session only, and never renders for it', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		expect(first.view.spotlight).toBeNull();
		const render = vi.spyOn(first.view as unknown as { render(): void }, 'render');
		first.view.setSpotlight('person:Ada');
		expect(first.view.spotlight).toBe('person:Ada');
		expect(render).not.toHaveBeenCalled();
		first.view.setSpotlight(null);
		expect(first.view.spotlight).toBeNull();
		first.view.setSpotlight('person:Ada');
		first.view.onunload();

		expect(makeView(vault, {}, { base: 'Backlog.base' }).view.spotlight).toBeNull();
	});
});
