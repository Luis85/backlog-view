// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { stateColorKey } from '../../src/domain/stateColors';
import { hexOf, openStateColors } from '../../src/view/interactions/stateColors';

useViewHarness();

/**
 * The dialog itself: which rows it offers, and what reaches the `.base` when it is saved.
 *
 * What it CANNOT check is the picker: `<input type="color">` opens the platform's own
 * popover, so a test sets the input's value and fires `change` — everything after a colour
 * is chosen. It also cannot check a seed, because jsdom loads no stylesheet, so every slot
 * resolves to `FALLBACK_SEED`; that a seeded swatch matches the bar beside it is the
 * live-vault item in `docs/requirements/Smoke test the roadmap.md`.
 */

const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done', doneValues: 'Done' };

function vaultWith(frontmatter: Record<string, unknown> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'Active', ...frontmatter } });
	return vault;
}

/** Open the picker the way the `⋯` menu does, and hand back what it drew. */
function openPicker(options: Record<string, string> = {}, vault = vaultWith()) {
	const { view, containerEl } = makeView(vault, { ...WORKFLOW, ...options }, { collapsed: true });
	openStateColors(view);
	return { view, containerEl };
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

function save(): void {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no dialog was opened');
	const btn = Array.from(modal.contentEl.querySelectorAll('button')).find((el) => el.textContent === 'Save');
	if (!btn) throw new Error('the dialog has no Save button');
	btn.dispatchEvent(new MouseEvent('click'));
}

describe('the state-colour picker', () => {
	it('offers one row per state a colour can reach, and no done state', () => {
		// `Done` is absent because its bar is green by specificity whatever is picked — a row
		// that provably changes nothing. The other two are the vocabulary, in slot order.
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

	it('writes only the rows that were touched', () => {
		// A dialog opened and saved must write nothing: every swatch holds a colour whether
		// or not anyone chose it, so a full set would turn every seeded row into a pick.
		const { view } = openPicker();
		pick(rows()[1], '#ff0000');
		save();

		expect(view.config.setCalls).toEqual([{ key: stateColorKey('Active'), value: '#ff0000' }]);
	});

	it('writes nothing at all when nothing was touched', () => {
		const { view } = openPicker();
		save();

		expect(view.config.setCalls).toEqual([]);
	});

	it('clears a pick through the reset beside the swatch', () => {
		// The way BACK to no pick, and it needs its own control: a colour input has no empty
		// state, so without this the positional default is unreachable once anything is set.
		const { view } = openPicker({ [stateColorKey('Active')]: '#ff0000' });
		const active = rows()[1];
		expect(active.input.value).toBe('#ff0000');

		active.reset.dispatchEvent(new MouseEvent('click'));
		save();

		expect(view.config.setCalls).toEqual([{ key: stateColorKey('Active'), value: null }]);
	});

	it('opens each swatch on a colour, picked or seeded', () => {
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
		// Two configurations reach the same empty screen — no state property, and a
		// vocabulary that is all done values — and the notice names the one thing that
		// fixes both.
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
