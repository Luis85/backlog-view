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
		expect(settings.stateKey).toBe('state');
	});

	it('reads a CLEARED option as unbound rather than as the default', () => {
		const settings = resolveMyWorkSettings(new FakeViewConfig({ assigneeProperty: '' }) as never);
		expect(settings.assigneeKey).toBe('');
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
