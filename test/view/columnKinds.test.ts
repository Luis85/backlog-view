// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixture, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/** The prop/kind pairs the view resolved, which is what every renderer reads. */
function kinds(view: { columns: readonly { prop: string; kind: string }[] }): [string, string][] {
	return view.columns.map((column) => [column.prop, column.kind]);
}

describe('the columns are the properties menu, in its order', () => {
	it('tags each visible property with the rendering it gets, keeping the menu order', () => {
		const { config, view } = makeView(fixture(), {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			riskProperty: 'note.risk',
		});
		// Deliberately not the order the old code pinned them in: a chip goes where the
		// user put it, between two ordinary properties if that is what they chose.
		config.order = ['note.status', 'note.points', 'note.horizon', 'note.tags', 'note.risk'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([
			['note.status', 'state'],
			['note.points', 'value'],
			['note.horizon', 'horizon'],
			['note.tags', 'tags'],
			['note.risk', 'risk'],
		]);
	});

	it('draws nothing for a configured property the properties menu does not show', () => {
		// The invariant the whole change rests on, asked of all four kinds at once:
		// configuring a property is not what puts it on a row — visibility is.
		const { config, containerEl, view } = makeView(fixture(), {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			riskProperty: 'note.risk',
		});
		config.order = [];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([]);
		expect(containerEl.querySelector('.pbl-state-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-horizon-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-risk-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-prop-tags')).toBeNull();
	});

	it('reads a special property as an ordinary value when its vocabulary is empty', () => {
		// hasHorizonAxis and hasRiskLevels are each a PAIR — a key AND a declared list.
		// With the list cleared there is no chip to draw and no menu it could open, so
		// the column falls through to the plain rendering rather than drawing a control
		// that can set nothing.
		const { config, view } = makeView(fixture(), {
			horizonProperty: 'note.horizon',
			horizonValues: '',
			riskProperty: 'note.risk',
			riskValues: '',
		});
		config.order = ['note.horizon', 'note.risk'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([
			['note.horizon', 'value'],
			['note.risk', 'value'],
		]);
	});

	it("never draws the view's own machinery, however visible it is made", () => {
		// The tree IS the parent column and the badge IS the type; `order` is an
		// implementation number. These are not properties the view declines to show,
		// they are the view itself.
		const { config, view } = makeView(fixture());
		config.order = ['file.name', 'note.parent', 'note.order', 'note.type', 'note.points'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([['note.points', 'value']]);
	});

	it('gives each workflow its own column, and fills only the one a row writes', () => {
		// Two visible state properties are two columns now. The old single column held
		// both and had to call itself "State"; each of these takes its own property's
		// name, and a row fills exactly one of them.
		const vault = fixture();
		vault.addFile('Doc.md', { frontmatter: { type: 'Deliverable', order: 10, docStatus: 'Draft' } });
		const { config, containerEl, view } = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.docStatus',
			deliverableStateValues: 'Concept, Draft, Published',
		});
		config.order = ['note.status', 'note.docStatus'];
		view.onDataUpdated();

		const cellsOf = (title: string) =>
			Array.from(rowByTitle(containerEl, title).querySelectorAll('.pbl-prop-state')).map(
				(cell) => cell.querySelector('.pbl-state-text')?.textContent ?? '',
			);
		// The Deliverable writes docStatus, so its chip is in the second column and the
		// first is an empty cell — empty, or every column after it would shift.
		expect(cellsOf('Doc')).toEqual(['', 'Draft']);
		// And the other way round for an item on the requirements workflow.
		expect(cellsOf('Epic A')[1]).toBe('');
	});
});

describe('the header of a strip with no columns in it', () => {
	it('still names the rollup every row is drawing', () => {
		// The rollup is not one of the columns — it is pinned past their end — so the
		// count going to zero says nothing about whether it renders. A header that
		// returned early here would leave the Progress column of every row unlabelled.
		const { config, containerEl, view } = makeView(fixture(), { stateProperty: 'note.status' });
		config.order = [];
		view.onDataUpdated();

		const header = treeOf(containerEl).querySelector('.pbl-cols');
		expect(Array.from(header?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent)).toEqual([
			'Progress',
		]);
	});

	it('is absent entirely when there is nothing to head at all', () => {
		const { config, containerEl, view } = makeView(fixture(), { showCounts: false });
		config.order = [];
		view.onDataUpdated();

		expect(treeOf(containerEl).querySelector('.pbl-cols')).toBeNull();
	});
});
