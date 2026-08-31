import { describe, expect, it } from 'vitest';
import { getMyWorkViewOptions, resolveMyWorkSettings } from '../../src/domain/myWorkOptions';
import { FakeViewConfig } from '../helpers/vault';

describe('my work options', () => {
	it('offers the same suggestions the backlog view does, without sharing the setting', () => {
		const settings = resolveMyWorkSettings(new FakeViewConfig({}) as never);
		expect(settings.parentKey).toBe('parent');
		expect(settings.orderKey).toBe('order');
		expect(settings.typeKey).toBe('type');
		expect(settings.assigneeKey).toBe('assignee');
		// The backlog view's own suggestion for the state property is `status`, not the
		// field's own name — `optionalProperty('state').suggested` in
		// `src/domain/optionalProperties.ts`. A vault's items carry `status`, never `state`,
		// so this view's untouched box has to bind the same key or a stock vault's finished
		// items would read as open here.
		expect(settings.stateKey).toBe('status');
	});

	it('reads a CLEARED option as unbound rather than as the default', () => {
		const settings = resolveMyWorkSettings(new FakeViewConfig({ assigneeProperty: '' }) as never);
		expect(settings.assigneeKey).toBe('');
	});

	// Fix round 1: the three model mappings ship a real default (`parent`/`order`/`type`),
	// so a reader who deliberately clears one must see it resolve to unbound — exactly the
	// distinction `clearablePropKey` exists to draw, and exactly what the PBI
	// ("The person is a pick") already promised for these three. `propKey` alone cannot
	// tell that clear from an untouched box, so this is the case that would still pass
	// with the bug: it fails without `clearablePropKey` on all three fields.
	it('tells a CLEARED model mapping from one never set, for all three hierarchy keys', () => {
		const cleared = resolveMyWorkSettings(
			new FakeViewConfig({ parentProperty: '', orderProperty: '', typeProperty: '' }) as never,
		);
		expect(cleared.parentKey).toBe('');
		expect(cleared.orderKey).toBe('');
		expect(cleared.typeKey).toBe('');

		const untouched = resolveMyWorkSettings(new FakeViewConfig({}) as never);
		expect(untouched.parentKey).toBe('parent');
		expect(untouched.orderKey).toBe('order');
		expect(untouched.typeKey).toBe('type');
	});

	it('offers every key exactly once', () => {
		const keys = getMyWorkViewOptions(new FakeViewConfig({}) as never)
			.flatMap((group) => group.items ?? [])
			.map((item) => item.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('falls back to the shipped done values when none are configured', () => {
		expect(resolveMyWorkSettings(new FakeViewConfig({}) as never).doneValues).toEqual([
			'Done',
			'Closed',
			'Completed',
			'Removed',
		]);
	});

	it('carries a default on its open-target dropdown, and resolves split when unset', () => {
		const openIn = getMyWorkViewOptions(new FakeViewConfig({}) as never)
			.flatMap((group) => group.items ?? [])
			.find((item) => item.key === 'openIn') as { default?: unknown } | undefined;
		expect(openIn?.default).toBe('split');
		expect(resolveMyWorkSettings(new FakeViewConfig({}) as never).openIn).toBe('split');
	});

	// The widened part of this task's brief: a note marked done from this sidebar must get
	// the same frontmatter a backlog-view write would, so the two stamp keys and the
	// started-states vocabulary that decide it are bound here too — resolved exactly the
	// way `resolveSettings` reads them for the backlog view.
	it('resolves the started/finished stamp keys and the started-states vocabulary', () => {
		const settings = resolveMyWorkSettings(
			new FakeViewConfig({
				startedDateProperty: 'note.started',
				finishedDateProperty: 'note.finished',
				startedStates: 'Active, In review',
			}) as never,
		);
		expect(settings.startedDateKey).toBe('started');
		expect(settings.finishedDateKey).toBe('finished');
		expect(settings.startedStates).toEqual(['Active', 'In review']);
	});

	it('leaves the stamp keys and started-states list unconfigured by default', () => {
		const settings = resolveMyWorkSettings(new FakeViewConfig({}) as never);
		expect(settings.startedDateKey).toBe('');
		expect(settings.finishedDateKey).toBe('');
		expect(settings.startedStates).toEqual([]);
	});
});
