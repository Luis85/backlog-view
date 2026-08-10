import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeViewConfig } from '../helpers/vault';
import { settingsFrom } from '../helpers/settings';
import { getViewOptions } from '../../src/domain/viewOptions';
import { STATE_COLOR_NAMES, stateColorKey, stateColorName } from '../../src/domain/stateColors';

/**
 * The colour vocabulary itself: what a state may be given, what a hand-edited `.base` is
 * allowed to say, which boxes the view options generate for it, and the stylesheet that
 * paints each name. What a bar and its legend swatch DO with a pick is
 * `test/view/stateColors.test.ts`, which needs a rendered grid to ask.
 */

describe('the colour vocabulary', () => {
	it('refuses everything outside the offered names', () => {
		for (const name of STATE_COLOR_NAMES) expect(stateColorName(name.toUpperCase())).toBe(name);
		// `''` is the no-pick default and must read as no pick, not as a colour called ''.
		for (const raw of ['', ' ', 'rebeccapurple', '#ff0000', 'var(--color-red-rgb)', 'toString']) {
			expect(stateColorName(raw), `${raw} resolved to a colour`).toBeNull();
		}
	});

	it('is painted by a rule per name, off the same token the slots set', () => {
		// The instrument, not a sample: every name the dropdown OFFERS is looked for, so a
		// name added to the list without a rule fails here rather than rendering a bar with
		// a class nothing paints. `--pbl-state-color` is what makes the bar and the legend
		// swatch one mapping — a rule setting `background-color` instead would colour the
		// swatch and leave the bar on its fallback accent.
		const css = readFileSync(new URL('../../styles/stateColors.css', import.meta.url), 'utf8');
		for (const name of STATE_COLOR_NAMES) {
			const rule = new RegExp(`\\.pbl-state-c-${name}\\s*\\{([^}]*)\\}`).exec(css);
			expect(rule, `styles/stateColors.css has no rule for ${name}`).not.toBeNull();
			expect(rule?.[1]).toContain('--pbl-state-color:');
		}
	});

	it('offers one box per state across both workflows, and never two for one key', () => {
		// The colours are one table keyed by the state VALUE, so a state both workflows
		// spell the same way is ONE setting — and a Deliverable workflow that declares no
		// states of its own falls back to the requirements list entire, which is the common
		// case rather than an edge one. Two boxes over one key is two controls disagreeing.
		const config = new FakeViewConfig({
			stateValues: 'New, Active, Done',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Active',
		});
		const keys = getViewOptions(config as never)
			.flatMap((group) => ('items' in group ? group.items : []))
			.map((option) => option.key)
			.filter((key) => key.startsWith('stateColor.'));

		expect(keys).toEqual(['New', 'Active', 'Done', 'Draft'].map(stateColorKey));
	});

	it('reads a pick for either workflow’s states into the one table', () => {
		const settings = settingsFrom({
			stateValues: 'New, Active',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft',
			[stateColorKey('Active')]: 'red',
			[stateColorKey('Draft')]: 'Cyan',
			// A key left behind by a state that has since gone from both lists. Never read:
			// the table is built from the configured vocabularies, so a stale key cannot
			// colour anything by coming back through a value some note still carries.
			[stateColorKey('Blocked')]: 'pink',
		});

		// Keyed by the LOWERCASED value, like every other per-state table here.
		expect(settings.stateColors).toEqual({ active: 'red', draft: 'cyan' });
	});
});
