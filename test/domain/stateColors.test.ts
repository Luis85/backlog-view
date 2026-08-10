import { describe, expect, it } from 'vitest';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { settingsFrom, settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { paletteFor, stateColoring, statePalettes } from '../../src/domain/board';
import { getViewOptions } from '../../src/domain/viewOptions';
import { stateColorKey, stateColorValue } from '../../src/domain/stateColors';

/**
 * What a pick IS: what a hand-editable `.base` may say, what the resolver keeps, and what
 * `stateColoring` answers for a state. What a bar and its legend swatch DO with one is
 * `test/view/stateColors.test.ts`, and the dialog that produces one is
 * `test/view/stateColorPicker.test.ts` — both need a DOM to ask.
 */

describe('a picked colour', () => {
	it('keeps only what a picker could have produced, normalised', () => {
		expect(stateColorValue('#ff0000')).toBe('#ff0000');
		// Shorthand and case are what a person types; the picker emits neither, so both are
		// normalised rather than refused — a `.base` is edited by hand as well as by us.
		expect(stateColorValue('#ABC')).toBe('#aabbcc');
		expect(stateColorValue('  #FF00aa ')).toBe('#ff00aa');
		// Every one of these was a legal value at some point in this feature's life or is a
		// plausible hand-edit. `orange` is the whole of the vocabulary this replaced: it is
		// refused rather than mapped, because no release ever carried it.
		for (const raw of ['', ' ', 'orange', 'rebeccapurple', 'rgb(1,2,3)', 'var(--color-red-rgb)', '#ff00', 'toString']) {
			expect(stateColorValue(raw), `${raw} resolved to a colour`).toBeNull();
		}
	});

	it('is idempotent, which is what the fixture guard rests on', () => {
		// `settingsInconsistency` recognises an unproducible value by asking this function
		// rather than by restating the rule — which only works because what it returns is
		// what the resolver stores.
		for (const raw of ['#ff0000', '#ABC', ' #FF00aa ']) {
			const stored = stateColorValue(raw);
			expect(stored).not.toBeNull();
			expect(stateColorValue(stored as string)).toBe(stored);
		}
	});

	it('is no longer a view option, because Bases has no colour control', () => {
		// The reason the picker is a dialog at all. Asserted from the SCHEMA rather than
		// from a comment: a colour dropdown quietly reappearing here would be two controls
		// over one key, and the manual's coverage check would then demand an entry claiming
		// `stateColor.*` — which is the other half of this, checked in `surfaces.test.ts`.
		const config = new FakeViewConfig({ stateValues: 'New, Active, Done' });
		const keys = getViewOptions(config as never)
			.flatMap((group) => ('items' in group ? group.items : []))
			.map((option) => option.key);

		expect(keys.filter((key) => key.startsWith('stateColor.'))).toEqual([]);
	});

	it('is read for either workflow’s states into the one table', () => {
		const settings = settingsFrom({
			stateValues: 'New, Active',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft',
			[stateColorKey('Active')]: '#ff0000',
			[stateColorKey('Draft')]: '#00FFFF',
			// A key left behind by a state that has since gone from both lists. Never read:
			// the table is built from the configured vocabularies, so a stale key cannot
			// colour anything by coming back through a value some note still carries.
			[stateColorKey('Blocked')]: '#ff00ff',
		});

		// Keyed by the LOWERCASED value and normalised, like every other per-state table.
		expect(settings.stateColors).toEqual({ active: '#ff0000', draft: '#00ffff' });
	});
});

describe('stateColoring', () => {
	function coloringOf(options: Record<string, string>, state: string) {
		const settings = settingsFrom({ stateProperty: 'note.status', ...options });
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: state } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const palette = paletteFor(statePalettes(model, settings), model.items[0]);
		if (!palette) throw new Error('the configured workflow produced no palette');
		return stateColoring(settings, palette, state);
	}

	it('answers the slot and the pick together, so neither can be read without the other', () => {
		const picked = coloringOf({ stateValues: 'New, Active', [stateColorKey('Active')]: '#ff0000' }, 'Active');

		expect(picked).toEqual({ cls: 'pbl-state-1', pick: '#ff0000' });
	});

	it('keeps the slot class under a pick, so clearing one falls back to it', () => {
		// The reason the stylesheet composes two tokens rather than TS writing one: the row
		// carries its slot either way, so a cleared pick lands on the positional colour in
		// the same render instead of on the plain accent.
		const unpicked = coloringOf({ stateValues: 'New, Active' }, 'Active');

		expect(unpicked).toEqual({ cls: 'pbl-state-1', pick: null });
	});

	it('takes no colour off Object.prototype for a state named like one', () => {
		// A state VALUE is user data, so `constructor` and `toString` are configurations
		// someone can have — and a bare index finds something truthy on every one of them.
		// `nameTable` builds the resolver's own map null-prototype, so this is only reachable
		// through a hand-built fixture holding a plain object; that is exactly the fixture
		// `settingsWith` exists to let people write, and `byName` is the rule `nameTable`'s
		// own doc states for reading one back — broken on three tables before this one.
		const settings = settingsWith({ stateKey: 'status', states: ['constructor'], stateColors: {} });
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'constructor' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const palette = paletteFor(statePalettes(model, settings), model.items[0]);
		if (!palette) throw new Error('the configured workflow produced no palette');

		expect(stateColoring(settings, palette, 'constructor')).toEqual({ cls: 'pbl-state-0', pick: null });
	});
});
