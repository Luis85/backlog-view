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

/** What decides a mark's colour: its slot class, and the picked token if it has one. */
interface Painted {
	cls: string | undefined;
	pick: string;
}

function paintedBy(el: HTMLElement | null | undefined, what: string): Painted {
	if (!el) throw new Error(`no ${what}`);
	return {
		// `pbl-legend-swatch` is the swatch's own base class, not a colour — excluded by name
		// so the two marks answer in the same vocabulary.
		cls: Array.from(el.classList).find(
			(c) => c !== 'pbl-legend-swatch' && (c.startsWith('pbl-state-') || c.startsWith('pbl-legend-')),
		),
		pick: el.style.getPropertyValue('--pbl-state-pick'),
	};
}

/** How a bar's row is painted — the two things `stateColoring` decides, read off the DOM. */
function rowColour(containerEl: HTMLElement, path: string): Painted {
	return paintedBy(containerEl.querySelector<HTMLElement>(`.pbl-timeline-row[data-path="${path}"]`), `row for ${path}`);
}

/** How the legend paints the swatch keying one state. */
function swatchColour(containerEl: HTMLElement, label: string): Painted {
	const item = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item')).find(
		(el) => el.querySelector('.pbl-legend-label')?.textContent === label,
	);
	return paintedBy(item?.querySelector<HTMLElement>('.pbl-legend-swatch'), `legend swatch labelled ${label}`);
}

function roadmapWith(options: Record<string, string>) {
	const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW, ...options }, { collapsed: true });
	view.setProjection('roadmap');
	return containerEl;
}

describe('a colour picked for a state', () => {
	it('reaches the bar AND the swatch that keys it, through the same token', () => {
		const containerEl = roadmapWith({ [stateColorKey('Active')]: '#ff0000' });

		// The slot class STAYS under the pick on both — that is what makes a cleared pick
		// fall back to the positional colour rather than to the plain accent.
		expect(rowColour(containerEl, 'Active.md')).toEqual({ cls: 'pbl-state-1', pick: '#ff0000' });
		expect(swatchColour(containerEl, 'Active')).toEqual({ cls: 'pbl-state-1', pick: '#ff0000' });
	});

	it('leaves every state nobody picked on its positional slot, with no token at all', () => {
		// The pick is per state, not per workflow: picking one colour must not renumber or
		// unkey the rest, which still take the slot their place in the list gives them — and
		// must not write the token on them, or the composition would have nothing to fall
		// back through.
		const containerEl = roadmapWith({ [stateColorKey('Active')]: '#ff0000' });

		expect(rowColour(containerEl, 'New.md')).toEqual({ cls: 'pbl-state-0', pick: '' });
		expect(swatchColour(containerEl, 'New')).toEqual({ cls: 'pbl-state-0', pick: '' });
	});

	it('is inert on a done state, which stays green on both sides', () => {
		// The picker does not OFFER a done state (see `stateColorPicker.test.ts`); this is
		// the same rule one layer down, for a `.base` edited by hand.
		// Green means finished everywhere in this plugin, and the bar takes it by
		// specificity in `styles/timeline.css` whatever class the row also carries. The
		// swatch is keyed `pbl-legend-done` for the same reason, so the pair still agrees —
		// this states that the pick changes NEITHER, rather than one of them.
		const vault = new FakeVault();
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, due: DUE, status: 'Done' } });
		const { view, containerEl } = makeView(
			vault,
			{ ...DATE_AXIS, ...WORKFLOW, doneValues: 'Done', [stateColorKey('Done')]: '#ff00ff' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(swatchColour(containerEl, 'Done')).toEqual({ cls: 'pbl-legend-done', pick: '' });
		const row = containerEl.querySelector<HTMLElement>('.pbl-timeline-row[data-path="Done.md"]');
		expect(row?.classList.contains('pbl-done')).toBe(true);
	});

	it('ignores a value no picker could have produced, painting nothing from it', () => {
		// A `.base` is hand-editable and this string would go straight into a custom
		// property — so the resolver validates rather than passes through, and the state
		// falls back to its slot with no token on it.
		const containerEl = roadmapWith({ [stateColorKey('Active')]: 'red; --x: y' });

		expect(rowColour(containerEl, 'Active.md')).toEqual({ cls: 'pbl-state-1', pick: '' });
		expect(swatchColour(containerEl, 'Active')).toEqual({ cls: 'pbl-state-1', pick: '' });
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
				[stateColorKey('Active')]: '#ff0000',
			},
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(rowColour(containerEl, 'D.md')).toEqual({ cls: undefined, pick: '' });
	});
});
