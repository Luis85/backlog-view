// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BasesViewRegistration } from 'obsidian';
import { registerReleaseView } from '../../../src/view/release/register';
import { getReleaseViewOptions } from '../../../src/domain/releaseOptions';
import { RELEASE_VIEW_TYPE, ReleaseView } from '../../../src/view/release/releaseView';
import { useViewHarness, captureRegistrations } from '../../helpers/view';

useViewHarness();

/**
 * `test/view/estimation/register.test.ts`'s first two cases, for the third registration.
 * Its third case — that two factory-built views share one `WriteLock` — has no analogue
 * here and must not gain one: this view takes no lock, and a test asserting one would be
 * asserting the relationship the register says does not exist.
 */
describe('registerReleaseView', () => {
	it('registers the release view with the correct config', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();

		registerReleaseView(fakePlugin as never);

		expect(specs.has(RELEASE_VIEW_TYPE)).toBe(true);
		const spec = specs.get(RELEASE_VIEW_TYPE)!;
		expect(spec.name).toBe('Product release');
		expect(spec.icon).toBe('lucide-package');
		// The identity, not merely "something is set": the options screen is this view's
		// own option set, and handing Bases the backlog view's set would draw a menu that
		// binds properties nothing here reads.
		expect(spec.options).toBe(getReleaseViewOptions);
	});

	it('factory-built view is a ReleaseView, mounted in the container it was given', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();
		registerReleaseView(fakePlugin as never);
		const spec = specs.get(RELEASE_VIEW_TYPE)!;

		const containerEl = document.body.createDiv();
		const view = spec.factory({} as never, containerEl);

		expect(view).toBeInstanceOf(ReleaseView);
		expect(containerEl.querySelector('.pbl-rel-view')).toBe((view as ReleaseView).viewEl);
	});
});
