// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { stateColorKey } from '../../src/domain/stateColors';
import { readDate, todayStamp } from '../../src/domain/noteFields';
import { addDays, formatCivil } from '../../src/domain/timeline';

useViewHarness();

/**
 * A colour named for a state, end to end: the option key, the resolver's validation of a
 * hand-editable value, the class the bar takes instead of its slot, and the legend swatch
 * that has to take the SAME one.
 *
 * That last pair is the whole risk in this feature. `docs/requirements/State colour and a
 * legend.md` records eight defects in it, every one a place where the strip keyed a colour
 * the grid did not draw — so a pick that moved the bar and not its swatch would be the
 * ninth. The tests below therefore never assert a class the bar carries without asking the
 * legend for the same state's swatch in the same breath.
 */

const TODAY = readDate(todayStamp()).value;
if (TODAY === null) throw new Error('todayStamp() did not parse as a date');
const DUE = formatCivil(addDays(TODAY, 10));

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };
const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done' };

function datedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Active.md', { frontmatter: { type: 'PBI', order: 10, due: DUE, status: 'Active' } });
	vault.addFile('New.md', { frontmatter: { type: 'PBI', order: 20, due: DUE, status: 'New' } });
	return vault;
}

/** The colour class a row carries — a slot, a named pick, or none. */
function rowColour(containerEl: HTMLElement, path: string): string | undefined {
	const row = containerEl.querySelector<HTMLElement>(`.pbl-timeline-row[data-path="${path}"]`);
	if (!row) throw new Error(`no timeline row for ${path}`);
	return Array.from(row.classList).find((c) => c.startsWith('pbl-state-'));
}

/** The swatch class the legend keys one state's label with. */
function swatchColour(containerEl: HTMLElement, label: string): string | undefined {
	const item = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item')).find(
		(el) => el.querySelector('.pbl-legend-label')?.textContent === label,
	);
	if (!item) throw new Error(`no legend swatch labelled ${label}`);
	return Array.from(item.querySelector('.pbl-legend-swatch')?.classList ?? []).find((c) => c !== 'pbl-legend-swatch');
}

function roadmapWith(options: Record<string, string>) {
	const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW, ...options }, { collapsed: true });
	view.setProjection('roadmap');
	return containerEl;
}

describe('a colour named for a state', () => {
	it('replaces that state’s slot on the bar AND on the swatch that keys it', () => {
		const containerEl = roadmapWith({ [stateColorKey('Active')]: 'red' });

		expect(rowColour(containerEl, 'Active.md')).toBe('pbl-state-c-red');
		expect(swatchColour(containerEl, 'Active')).toBe('pbl-state-c-red');
	});

	it('leaves every state nobody named on its positional slot', () => {
		// The pick is per state, not per workflow: naming one colour must not renumber or
		// unkey the rest, which still take the slot their place in the list gives them.
		const containerEl = roadmapWith({ [stateColorKey('Active')]: 'red' });

		expect(rowColour(containerEl, 'New.md')).toBe('pbl-state-0');
		expect(swatchColour(containerEl, 'New')).toBe('pbl-state-0');
	});

	it('is inert on a done state, which stays green on both sides', () => {
		// Green means finished everywhere in this plugin, and the bar takes it by
		// specificity in `styles/timeline.css` whatever class the row also carries. The
		// swatch is keyed `pbl-legend-done` for the same reason, so the pair still agrees —
		// this states that the pick changes NEITHER, rather than one of them.
		const vault = new FakeVault();
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, due: DUE, status: 'Done' } });
		const { view, containerEl } = makeView(
			vault,
			{ ...DATE_AXIS, ...WORKFLOW, doneValues: 'Done', [stateColorKey('Done')]: 'pink' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(swatchColour(containerEl, 'Done')).toBe('pbl-legend-done');
		const row = containerEl.querySelector<HTMLElement>('.pbl-timeline-row[data-path="Done.md"]');
		expect(row?.classList.contains('pbl-done')).toBe(true);
	});

	it('ignores a value no dropdown could have produced, rather than classing on it', () => {
		// A `.base` is hand-editable and this string becomes a CSS class — so the resolver
		// validates rather than passes through, and the state falls back to its slot.
		const containerEl = roadmapWith({ [stateColorKey('Active')]: 'rebeccapurple; }' });

		expect(rowColour(containerEl, 'Active.md')).toBe('pbl-state-1');
		expect(swatchColour(containerEl, 'Active')).toBe('pbl-state-1');
	});

	it('colours nothing where the item’s OWN palette does not carry that state', () => {
		// The pick is per VALUE while the slot is per palette, so the two can disagree: this
		// Deliverable's own state is `Active`, which its own vocabulary does not list but the
		// requirements one does — and colours. Such a bar draws the plain accent and the
		// legend has no swatch for it, so honouring the pick would put a colour on the grid
		// nothing keys, which is the one rule every defect in this feature has broken.
		//
		// This is what makes the ORDER in `stateColorClass` load-bearing rather than taste:
		// asking the pick before the slot passes every other test in this file and fails
		// only here.
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, due: DUE, status: 'New', deliverableStatus: 'Active' },
		});
		const { view, containerEl } = makeView(
			vault,
			{
				...DATE_AXIS,
				...WORKFLOW,
				deliverableStateProperty: 'note.deliverableStatus',
				deliverableStateValues: 'Draft, Published',
				[stateColorKey('Active')]: 'red',
			},
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(rowColour(containerEl, 'D.md')).toBeUndefined();
	});
});
