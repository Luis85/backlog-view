import { describe, expect, it } from 'vitest';
import { typesSection } from '../../src/view/manual/typesSection';
import { ALL_TYPES, LEVELS } from '../../src/domain/settings';

describe('the types section', () => {
	// The check behind "derived, not retyped": a type added to the vocabulary without an
	// explanation fails here rather than shipping as a gap in the manual.
	it('explains every type in the vocabulary', () => {
		const explained = typesSection().entries.filter((e) => e.badge).map((e) => e.badge?.text);
		expect(explained).toEqual(ALL_TYPES);
	});

	it('gives every type entry a non-empty explanation', () => {
		for (const entry of typesSection().entries.filter((e) => e.badge)) {
			expect(entry.text.length, `${entry.badge?.text} has no explanation`).toBeGreaterThan(0);
		}
	});

	it('badges a ladder type by its rung and an extra type by its name', () => {
		const of = (name: string) => typesSection().entries.find((e) => e.badge?.text === name)?.badge?.cls;
		expect(of('Epic')).toBe(`pbl-lvl-${LEVELS.indexOf('Epic')}`);
		expect(of('Bug')).toBe('pbl-lvl-bug');
		expect(of('Milestone')).toBe('pbl-lvl-milestone');
	});

	it('is a pure read — calling it twice gives equal content', () => {
		expect(typesSection()).toEqual(typesSection());
	});
});
