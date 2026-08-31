// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { makeView, refresh, useViewHarness } from '../helpers/view';
import { stateColorKey } from '../../src/domain/stateColors';
import { hasColorableStates, hexOf, openStateColors } from '../../src/view/interactions/stateColors';

useViewHarness();

/**
 * The dialog itself: which rows it offers, and what reaches the `.base` when it is saved.
 *
 * What it CANNOT check is the picker: `<input type="color">` opens the platform's own
 * popover, so a test sets the input's value and fires `change` — everything after a colour
 * is chosen. It also cannot check a seed, because jsdom loads no stylesheet, so every slot
 * resolves to `FALLBACK_SEED`; that a seeded swatch matches the bar beside it is the
 * live-vault item in `docs/tests/suites/Smoke test the roadmap.md`.
 */

const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done', doneValues: 'Done' };

function vaultWith(frontmatter: Record<string, unknown> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'Active', ...frontmatter } });
	return vault;
}

/** Open the dialog the way the toolbar button does, and hand back what it drew. */
function openPicker(options: Record<string, string> = {}, vault = vaultWith()) {
	const { view, config, containerEl } = makeView(vault, { ...WORKFLOW, ...options }, { collapsed: true });
	openStateColors(view);
	return { view, config, containerEl };
}

function rows(): { label: string; input: HTMLInputElement; reset: HTMLElement }[] {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no dialog was opened');
	return Array.from(modal.contentEl.querySelectorAll<HTMLElement>('.setting-item'))
		.map((el) => ({
			label: el.querySelector('.setting-item-name')?.textContent ?? '',
			input: el.querySelector<HTMLInputElement>('input[type="color"]') as HTMLInputElement,
			reset: el.querySelector<HTMLElement>('.extra-setting-button') as HTMLElement,
		}))
		.filter((row) => row.input !== null);
}

function pick(row: { input: HTMLInputElement }, hex: string): void {
	row.input.value = hex;
	row.input.dispatchEvent(new Event('change'));
}



/** The toolbar button, found the way a user does. */
function colorButton(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-state-colors-btn');
}

describe('the state-colours button', () => {
	it('renders where a state colour is actually drawn, and nowhere else', () => {
		// The legend's own gate: roadmap mode, the dated axis. A control in the tree or on
		// the board would claim state colours affect those projections, which they do not.
		const { view, containerEl } = makeView(
			vaultWith({ due: '2026-08-20' }),
			{ ...WORKFLOW, startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: 'note.horizon' },
			{ collapsed: true },
		);
		expect(colorButton(containerEl)).toBeNull();

		view.setProjection('roadmap');
		view.setAxisPick('dates');
		expect(colorButton(containerEl)).not.toBeNull();

		// The horizon axis draws no bar and no legend, so it keys no state colour either.
		view.setAxisPick('horizons');
		expect(colorButton(containerEl)).toBeNull();
	});

	it('is withheld where there is nothing to colour, rather than opening onto nothing', () => {
		// The button and the dialog ask ONE question (`hasColorableStates`), so a button
		// that opened onto an empty dialog is impossible by construction.
		const { view, containerEl } = makeView(
			vaultWith({ due: '2026-08-20' }),
			{ stateProperty: 'note.status', startProperty: 'note.start', targetProperty: 'note.due' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		expect(colorButton(containerEl)).toBeNull();
	});

	it('puts focus on the REBUILT button when the dialog closes', () => {
		// The hazard this path meets on every use: a change writes the `.base`, the view
		// refreshes, and the toolbar is emptied — so the button that opened the dialog is
		// detached before it closes, and a modal handing focus back to its opener would put
		// it on an element no longer in the document. The replacement is looked up at close
		// time, which is why the refresh below is part of the test rather than noise.
		const vault = vaultWith({ due: '2026-08-20' });
		const { view, containerEl } = makeView(
			vault,
			{ ...WORKFLOW, startProperty: 'note.start', targetProperty: 'note.due' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		const opener = colorButton(containerEl);
		opener?.dispatchEvent(new MouseEvent('click'));
		refresh(view, vault);

		const rebuilt = colorButton(containerEl);
		expect(rebuilt).not.toBe(opener);
		Modal.lastOpened?.close();

		expect(document.activeElement).toBe(rebuilt);
	});

	it('opens the dialog when pressed', () => {
		const { view, containerEl } = makeView(
			vaultWith({ due: '2026-08-20' }),
			{ ...WORKFLOW, startProperty: 'note.start', targetProperty: 'note.due' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		colorButton(containerEl)?.dispatchEvent(new MouseEvent('click'));

		expect(Modal.lastOpened).not.toBeNull();
	});
});

describe('the state-colour picker', () => {
	it('offers one row per DECLARED state, in vocabulary order, without the done ones', () => {
		// `Done` is declared in `WORKFLOW` and is not offered: its bar is green by
		// specificity and its legend swatch is keyed `pbl-legend-done`, so a row for it
		// would write a key nothing on the grid reads.
		openPicker();

		expect(rows().map((row) => row.label)).toEqual(['New', 'Active']);
	});

	it('offers a state once across both workflows', () => {
		// The colours are one table keyed by the state VALUE, so a second row would be two
		// controls over one key — and a Deliverable workflow with states of its own still
		// contributes the ones the requirements list does not carry.
		openPicker({ deliverableStateProperty: 'note.ds', deliverableStateValues: 'Active, Draft' });

		expect(rows().map((row) => row.label)).toEqual(['New', 'Active', 'Draft']);
	});

	it('treats a state chosen by NAME as a choice like any other', () => {
		// The other stored shape reaching the dialog: a name is a class rather than a value,
		// so the row's swatch opens on what that CLASS paints while its reset restores what
		// the SLOT paints. jsdom resolves neither (both are the grey fallback), so what is
		// asserted here is the half that survives: the row knows it is set, so its reset is
		// live, and using it clears the key.
		const { config } = openPicker({ [stateColorKey('Active')]: 'orange' });
		const active = rows()[1];
		expect(active.reset.hasAttribute('disabled')).toBe(false);

		active.reset.dispatchEvent(new MouseEvent('click'));

		expect(config.setCalls).toEqual([{ key: stateColorKey('Active'), value: null }]);
	});

	it('offers nothing for a workflow that declares states but names no property', () => {
		// The mirror of the case below: the vocabulary exists and there is nowhere to write
		// it, so no palette can place any of it and a colour would decorate nothing.
		Notice.reset();
		const { view } = makeView(vaultWith(), { stateValues: 'New, Active' }, { collapsed: true });

		expect(hasColorableStates(view)).toBe(false);
		openStateColors(view);
		expect(Modal.lastOpened).toBeNull();
	});

	it('offers nothing for a workflow whose states are only OBSERVED', () => {
		// The finding this feature nearly shipped: `resolveSettings` builds the colour table
		// from the DECLARED lists and has no model, so a colour chosen for an observed state
		// would be written and silently dropped by the next refresh. Nothing is offered, the
		// button does not render, and the notice names the box that fixes it.
		Notice.reset();
		const { view } = makeView(vaultWith(), { stateProperty: 'note.status' }, { collapsed: true });

		expect(hasColorableStates(view)).toBe(false);
		openStateColors(view);
		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.join(' ')).toContain('list its states');
	});

	it('writes each choice as it is made, and only for the row touched', () => {
		// There is no Save: a row nobody touched must write nothing, and a dialog submitting
		// its whole row set would turn every seeded swatch into a choice.
		const { config } = openPicker();
		pick(rows()[1], '#ff0000');

		expect(config.setCalls).toEqual([{ key: stateColorKey('Active'), value: '#ff0000' }]);
	});

	it('writes nothing at all when nothing is touched', () => {
		const { config } = openPicker();

		expect(config.setCalls).toEqual([]);
	});

	it('clears a choice through the reset, and puts the DEFAULT back in the swatch', () => {
		// The way BACK to the default, and it needs its own control: a colour input has no
		// empty state, so without this "by position" is unreachable once anything is set.
		//
		// The swatch has to move too, and the value it moves to has to be the default rather
		// than the choice just cleared. Resetting to the choice would leave the old colour on
		// screen while the grid reverted — and, because the input's value never changed,
		// would then swallow the `change` event if the user immediately re-picked it. The
		// seed is the grey fallback here (jsdom paints nothing), which is what makes the two
		// distinguishable at all under test.
		const { config } = openPicker({ [stateColorKey('Active')]: '#ff0000' });
		const active = rows()[1];
		expect(active.input.value).toBe('#ff0000');

		active.reset.dispatchEvent(new MouseEvent('click'));

		expect(config.setCalls).toEqual([{ key: stateColorKey('Active'), value: null }]);
		expect(active.input.value).not.toBe('#ff0000');
		expect(active.input.value).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('lets a colour just chosen be undone, without reopening', () => {
		// `isSet` is a snapshot from the moment the dialog opened, so the reset has to track
		// the row as it is USED: choosing on a default row makes a setting that now exists,
		// and a control disabled over it would strand the user until they closed the dialog.
		const { config } = openPicker();
		const active = rows()[1];
		expect(active.reset.hasAttribute('disabled')).toBe(true);

		pick(active, '#ff0000');
		expect(active.reset.hasAttribute('disabled')).toBe(false);

		active.reset.dispatchEvent(new MouseEvent('click'));

		// And back again: the row is on its default once more, so the control goes with it.
		expect(active.reset.hasAttribute('disabled')).toBe(true);
		expect(config.setCalls).toEqual([
			{ key: stateColorKey('Active'), value: '#ff0000' },
			{ key: stateColorKey('Active'), value: null },
		]);
	});

	it('refuses a click that reaches the disabled reset anyway', () => {
		// `disabled` on its own is a request, not a guarantee — this codebase already records
		// that for the collapse controls, where a click landing on a child element bubbles
		// past it. So the handler asks the same question the attribute answers, and clicking
		// an unchosen row's reset writes nothing rather than clearing a key nobody set.
		const { config } = openPicker({ [stateColorKey('Active')]: '#ff0000' });

		rows()[0].reset.dispatchEvent(new MouseEvent('click'));

		expect(config.setCalls).toEqual([]);
	});

	it('offers no reset on a row with nothing to reset', () => {
		// Every swatch holds a colour whether or not anyone chose one, so "is there a choice"
		// is a fact the control cannot show by itself — an always-enabled reset would be
		// available on every row and do nothing on most of them.
		const { view: _view } = openPicker({ [stateColorKey('Active')]: '#ff0000' });
		const [unchosen, chosen] = rows();

		expect(unchosen.reset.hasAttribute('disabled')).toBe(true);
		expect(chosen.reset.hasAttribute('disabled')).toBe(false);
	});

	it('opens each swatch on a colour, chosen or seeded', () => {
		// The seed's VALUE is not asserted: jsdom paints nothing, so every slot resolves to
		// the fallback. What is asserted is that no row opens on a blank or absent colour,
		// which is the failure a missing seed would actually produce.
		openPicker({ [stateColorKey('Active')]: '#ff0000' });

		for (const row of rows()) expect(row.input.value, `${row.label} opened on no colour`).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('offers nothing while the view is still waiting for its first results', () => {
		// Not the same case as "no workflow": the vocabulary is configured, the MODEL is not
		// there yet, and the palettes are derived from one. The command withholds itself in
		// this state, so this is the path a `⋯` click takes if the two ever disagree.
		Notice.reset();
		const { view } = makeView(vaultWith(), WORKFLOW, { collapsed: true });
		(view as unknown as { model: unknown }).model = null;
		openStateColors(view);

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.join(' ')).toContain('No workflow states to colour yet');
	});

	it('says so rather than opening an empty dialog with no workflow', () => {
		Notice.reset();
		openStateColors(makeView(vaultWith(), {}, { collapsed: true }).view);

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.join(' ')).toContain('No workflow states to colour yet');
	});
});

describe('the seed a swatch opens on', () => {
	it('turns a painted colour into a hex a picker accepts', () => {
		// The only part of the seeding path a test can reach: `slotColor` reads
		// `getComputedStyle`, and jsdom loads no stylesheet, so every slot under test
		// resolves to the fallback. What a browser hands back is `rgb(r, g, b)`.
		expect(hexOf('rgb(255, 123, 0)')).toBe('#ff7b00');
		// A channel under 16 must keep its leading zero, or the hex is one character short
		// and the picker silently refuses it — the failure this is here for.
		expect(hexOf('rgb(0, 5, 16)')).toBe('#000510');
		expect(hexOf('rgba(1, 2, 3, 0.5)')).toBe('#010203');
		// Anything the regex cannot read is null, which is what makes the fallback reachable
		// rather than a colour built from nothing.
		for (const raw of ['', 'transparent', 'color(srgb 1 0 0)', '#ff0000']) {
			expect(hexOf(raw), `${raw} produced a hex`).toBeNull();
		}
	});
});
