// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { movedPath, viewNameOf, viewStateKey } from '../../src/storage/viewIdentity';
import { installObsidianDom } from '../helpers/dom';

installObsidianDom();

describe('viewStateKey', () => {
	it('encodes both halves, so no pair of base and view can collide with another', () => {
		// 'A#B' + 'C' and 'A' + 'B#C' are different views and must not share a key.
		expect(viewStateKey({ base: 'A#B', view: 'C' })).not.toBe(viewStateKey({ base: 'A', view: 'B#C' }));
	});

	it('round-trips a view name through viewNameOf, separator and all', () => {
		expect(viewNameOf(viewStateKey({ base: 'Docs/Plan.base', view: 'Sprint #3' }))).toBe('Sprint #3');
	});

	it('refuses a key it did not write rather than guessing a name', () => {
		expect(viewNameOf('one#two#three')).toBeNull();
		expect(viewNameOf('%E0%A4%A#Backlog')).toBeNull();
	});
});

describe('movedPath', () => {
	it('moves the renamed thing itself', () => {
		expect(movedPath('Old.base', 'Old.base', 'New.base')).toBe('New.base');
	});

	it('carries everything under a renamed folder', () => {
		expect(movedPath('Plans/Q3/Old.base', 'Plans', 'Archive')).toBe('Archive/Q3/Old.base');
	});

	it('leaves a path that merely shares a name prefix alone', () => {
		expect(movedPath('Plans2/Old.base', 'Plans', 'Archive')).toBeNull();
	});
});
