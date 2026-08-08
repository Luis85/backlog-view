import { describe, expect, it } from 'vitest';
import { paletteDone, paletteFor, paletteSlot, statePalettes } from '../../src/domain/board';
import { buildModel } from '../../src/domain/model';
import { BacklogSettings, defaultSettings, STATE_COLOR_SLOTS } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/** One workflow, the ordinary base: a state property and a list. */
const oneWorkflow: BacklogSettings = {
	...defaultSettings(),
	stateKey: 'status',
	states: ['New', 'Active', 'Done'],
	doneValues: ['Done'],
};

/** Two workflows: the Deliverable one declares its own property, values and done list. */
const twoWorkflows: BacklogSettings = {
	...oneWorkflow,
	deliverableStateKey: 'deliverableStatus',
	deliverableStates: ['Draft', 'Published'],
	deliverableDoneValues: ['Published'],
};

function modelOf(settings: BacklogSettings) {
	const vault = new FakeVault();
	vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'Active' } });
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 20, status: 'New', deliverableStatus: 'Published' },
	});
	return buildModel(vault.app, vault.entries(), settings);
}

describe('statePalettes', () => {
	it('is one unlabelled palette where only one workflow is configured', () => {
		const palettes = statePalettes(modelOf(oneWorkflow), oneWorkflow);

		// Nothing to tell apart, so nothing names it: the strip a single-workflow base
		// draws is exactly what it drew before a second one existed.
		expect(palettes).toHaveLength(1);
		expect(palettes[0].label).toBe('');
		expect(palettes[0].values).toEqual(['New', 'Active', 'Done']);
		expect(palettes[0].offset).toBe(0);
	});

	it('splits on the RAW deliverable key, so a falling-back workflow is still one workflow', () => {
		// `resolvedDeliverableStateKey` falls back to the requirements key, which is the
		// SAME property holding the SAME values — a second section there would key one
		// vocabulary twice and invite the reader to look for a difference that is not there.
		const fallsBack = { ...oneWorkflow, deliverableStateKey: '' };

		expect(statePalettes(modelOf(fallsBack), fallsBack)).toHaveLength(1);
	});

	it('carries each workflow’s own values and its own done list', () => {
		const palettes = statePalettes(modelOf(twoWorkflows), twoWorkflows);

		expect(palettes.map((p) => p.label)).toEqual(['Work', 'Deliverables']);
		expect(palettes[0].doneValues).toEqual(['Done']);
		expect(palettes[1].values).toEqual(['Draft', 'Published']);
		expect(palettes[1].doneValues).toEqual(['Published']);
	});

	it('continues the slot sequence rather than restarting it', () => {
		const palettes = statePalettes(modelOf(twoWorkflows), twoWorkflows);

		// The whole point of asking an item's own workflow is that a Deliverable's first
		// state and a PBI's first state are different facts; restarting would paint them
		// the same colour and undo it.
		expect(palettes[1].offset).toBe(palettes[0].values.length);
		expect(paletteSlot(palettes[0], 'New')).not.toBe(paletteSlot(palettes[1], 'Draft'));
	});
});

describe('paletteFor', () => {
	it('keys a Deliverable into its own palette and everything else into the first', () => {
		const model = modelOf(twoWorkflows);
		const palettes = statePalettes(model, twoWorkflows);
		const deliverable = model.byPath.get('D.md')!;
		const pbi = model.byPath.get('P.md')!;

		expect(paletteFor(palettes, deliverable).label).toBe('Deliverables');
		expect(paletteFor(palettes, pbi).label).toBe('Work');
	});

	it('keys a Deliverable into the only palette when there is only one', () => {
		const model = modelOf(oneWorkflow);
		const palettes = statePalettes(model, oneWorkflow);

		// A base that tracks Deliverables on the requirements workflow has one vocabulary,
		// and a Deliverable is coloured by it like anything else.
		expect(paletteFor(palettes, model.byPath.get('D.md')!)).toBe(palettes[0]);
	});
});

describe('paletteSlot', () => {
	const single = () => statePalettes(modelOf(oneWorkflow), oneWorkflow)[0];

	it('gives no slot to an item with no state', () => {
		expect(paletteSlot(single(), null)).toBeNull();
	});

	it('gives no slot to a value outside the vocabulary', () => {
		expect(paletteSlot(single(), 'Blocked')).toBeNull();
	});

	it('is the value’s index in its own vocabulary, case-insensitively', () => {
		expect(paletteSlot(single(), 'new')).toBe(0);
		expect(paletteSlot(single(), 'Active')).toBe(1);
		expect(paletteSlot(single(), 'DONE')).toBe(2);
	});

	it('agrees with the board and the Set state menu: same vocabulary, observed included', () => {
		const observed = { ...defaultSettings(), stateKey: 'status' };
		const palette = statePalettes(modelOf(observed), observed)[0];

		// No configured list, so the vocabulary is what the results hold plus a done value
		// — the same fallback `stateMenuValues` states for the menu and the columns. The
		// Deliverable's own `New` is NOT in it: `requirementsWorkflow` collects from
		// non-Deliverable results only, so the bar colours key exactly the vocabulary the
		// requirements board draws columns for.
		expect(palette.values).toEqual(['Active', 'Done']);
		expect(paletteSlot(palette, 'Active')).toBe(0);
	});

	it('wraps modulo the slot count for a vocabulary longer than the palette', () => {
		const states = Array.from({ length: STATE_COLOR_SLOTS + 2 }, (_, i) => `State ${i}`);
		const long = { ...oneWorkflow, states };
		const palette = statePalettes(modelOf(long), long)[0];

		expect(paletteSlot(palette, `State ${STATE_COLOR_SLOTS}`)).toBe(0);
		expect(paletteSlot(palette, `State ${STATE_COLOR_SLOTS + 1}`)).toBe(1);
	});

	it('wraps the OFFSET too, so a second workflow keeps running through the palette', () => {
		const palettes = statePalettes(modelOf(twoWorkflows), twoWorkflows);

		// Three requirements states then two Deliverable ones: slots 3 and 0.
		expect(paletteSlot(palettes[1], 'Draft')).toBe(3);
		expect(paletteSlot(palettes[1], 'Published')).toBe(0);
	});
});

describe('paletteDone', () => {
	it('asks the palette’s OWN done list, not the requirements one', () => {
		const palettes = statePalettes(modelOf(twoWorkflows), twoWorkflows);

		// `Published` is done for a Deliverable and nothing at all for a PBI. Asking
		// `settings.doneValues` would key a finished Deliverable by its slot colour while
		// its bar took the green override.
		expect(paletteDone(palettes[1], 'Published')).toBe(true);
		expect(paletteDone(palettes[0], 'Published')).toBe(false);
		expect(paletteDone(palettes[0], 'Done')).toBe(true);
	});

	it('matches case-insensitively, like every other state comparison', () => {
		const palettes = statePalettes(modelOf(twoWorkflows), twoWorkflows);

		expect(paletteDone(palettes[1], 'PUBLISHED')).toBe(true);
	});
});
