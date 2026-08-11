import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { settingsFrom, settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { paletteFor, stateColorPaint, statePalettes } from '../../src/domain/board';
import { getViewOptions } from '../../src/domain/viewOptions';
import { colorableStates, STATE_COLOR_NAMES, stateColor, stateColorKey } from '../../src/domain/stateColors';

/**
 * What a pick IS: what a hand-editable `.base` may say, what the resolver keeps, and what
 * `stateColoring` answers for a state. What a bar and its legend swatch DO with one is
 * `test/view/stateColors.test.ts`, and the dialog that produces one is
 * `test/view/stateColorPicker.test.ts` — both need a DOM to ask.
 */

describe('a picked colour', () => {
	it('accepts a name or a six-digit hex, and nothing else', () => {
		// The two shapes, both ways round: a name is what a `.base` can be hand-edited to
		// and what tracks the theme; a hex is what the picker writes.
		expect(stateColor('orange')).toBe('orange');
		expect(stateColor(' RED ')).toBe('red');
		expect(stateColor('#ff0000')).toBe('#ff0000');
		expect(stateColor('#FF00AA')).toBe('#ff00aa');
		// Everything else, and `#fff` is the one worth naming: it is a legal CSS colour and
		// is REFUSED rather than expanded, because the picker emits one shape and this value
		// reaches a style attribute — a grammar with one shape is one a reader can check.
		for (const raw of ['', ' ', '#fff', 'rebeccapurple', 'rgb(1,2,3)', 'var(--color-red-rgb)', '#ff00', 'toString']) {
			expect(stateColor(raw), `${raw} resolved to a colour`).toBeNull();
		}
	});

	it('is idempotent, which is what the fixture guard rests on', () => {
		// `settingsInconsistency` recognises an unproducible value by asking this function
		// rather than by restating the rule — which only works because what it returns is
		// what the resolver stores.
		for (const raw of ['#ff0000', ' RED ', 'orange', '#FF00aa']) {
			const stored = stateColor(raw);
			expect(stored).not.toBeNull();
			expect(stateColor(stored as string)).toBe(stored);
		}
	});

	it('is painted by a rule per name, off the same token the slots set', () => {
		// The instrument, not a sample: every name the validator ACCEPTS is looked for, so a
		// name added to the list without a rule fails here rather than putting a class on a
		// bar that nothing paints. `--pbl-state-color` is what makes the bar and the legend
		// swatch one mapping — a rule setting `background-color` instead would colour the
		// swatch and leave the bar on its fallback accent.
		const css = readFileSync(new URL('../../styles/stateColors.css', import.meta.url), 'utf8');
		for (const name of STATE_COLOR_NAMES) {
			const rule = new RegExp(`\\.pbl-state-c-${name}\\s*\\{([^}]*)\\}`).exec(css);
			expect(rule, `styles/stateColors.css has no rule for ${name}`).not.toBeNull();
			expect(rule?.[1]).toContain('--pbl-state-color:');
		}
	});

	it('can be chosen only for a DECLARED state, in either workflow', () => {
		// The rule the whole feature rests on for persistence: `resolveSettings` builds the
		// table from these two lists and has no model, so an observed state's colour would
		// be written and then discarded on the next refresh. Deduped by `sameValue`, which
		// is the "one state, one control" rule the Deliverables options used to restate.
		expect(colorableStates(['New', 'Active'], ['active', 'Draft'])).toEqual(['New', 'Active', 'Draft']);
		expect(colorableStates([], [])).toEqual([]);
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
			[stateColorKey('Draft')]: 'Cyan',
			// A key left behind by a state that has since gone from both lists. Never read:
			// the table is built from the configured vocabularies, so a stale key cannot
			// colour anything by coming back through a value some note still carries.
			[stateColorKey('Blocked')]: '#ff00ff',
		});

		// Keyed by the LOWERCASED value and normalised, like every other per-state table.
		expect(settings.stateColors).toEqual({ active: '#ff0000', draft: 'cyan' });
	});
});

describe('stateColorPaint', () => {
	function coloringOf(options: Record<string, string>, state: string) {
		const settings = settingsFrom({ stateProperty: 'note.status', ...options });
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: state } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const palette = paletteFor(statePalettes(model, settings), model.items[0]);
		if (!palette) throw new Error('the configured workflow produced no palette');
		return stateColorPaint(settings, palette, state);
	}

	it('answers the class and the inline colour together, so neither is read without the other', () => {
		// A hex keeps the SLOT class and overrides it inline; a name IS the class, so it
		// resolves through the theme and needs no inline value at all.
		expect(coloringOf({ stateValues: 'New, Active', [stateColorKey('Active')]: '#ff0000' }, 'Active')).toEqual({
			cls: 'pbl-state-1',
			color: '#ff0000',
		});
		expect(coloringOf({ stateValues: 'New, Active', [stateColorKey('Active')]: 'orange' }, 'Active')).toEqual({
			cls: 'pbl-state-c-orange',
			color: null,
		});
	});

	it('leaves an unchosen state on its positional slot, with nothing inline', () => {
		expect(coloringOf({ stateValues: 'New, Active' }, 'Active')).toEqual({ cls: 'pbl-state-1', color: null });
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

		expect(stateColorPaint(settings, palette, 'constructor')).toEqual({ cls: 'pbl-state-0', color: null });
	});
});
