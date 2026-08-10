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
			assigneeProperty: 'note.assignee',
		});
		// Deliberately not the order the old code pinned them in: a chip goes where the
		// user put it, between two ordinary properties if that is what they chose.
		config.order = ['note.status', 'note.points', 'note.horizon', 'note.tags', 'note.risk', 'note.assignee'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([
			['note.status', 'state'],
			['note.points', 'value'],
			['note.horizon', 'horizon'],
			['note.tags', 'tags'],
			['note.risk', 'risk'],
			['note.assignee', 'assignee'],
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

	it('keeps the assignee a chip with no names observed at all', () => {
		// The exception to the pair above, and the reason it is one: Set assignee always
		// carries New assignee..., so there is no vocabulary this chip could be missing
		// and nothing an empty base could make it into a plain column for.
		const { config, containerEl, view } = makeView(fixture(), { assigneeProperty: 'note.assignee' });
		config.order = ['note.assignee'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([['note.assignee', 'assignee']]);
		expect(containerEl.querySelector('.pbl-assignee-chip')).not.toBeNull();
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

	it('gives each chip its own column’s name, so two state columns do not announce alike', () => {
		// The header is aria-hidden, so the chip's accessible name is the only thing that
		// says which property it writes. Both workflows hold the SAME value here, so a
		// name built from the kind rather than from the column is two identical
		// announcements for two different properties.
		const vault = fixture();
		vault.addFile('Doc.md', { frontmatter: { type: 'Deliverable', order: 10, docStatus: 'Active' } });
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 30, status: 'Active' } });
		const { config, containerEl, view } = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.docStatus',
			deliverableStateValues: 'Active, Done',
		});
		config.order = ['note.status', 'note.docStatus'];
		view.onDataUpdated();

		const chipLabel = (title: string) =>
			rowByTitle(containerEl, title).querySelector('.pbl-state-chip')?.getAttribute('aria-label');
		expect(chipLabel('Epic C')).toBe('Change status (currently Active)');
		expect(chipLabel('Doc')).toBe('Change docStatus (currently Active)');
		// And the unset shape names its property too, not just the set one.
		expect(chipLabel('Epic A')).toBe('Set status');
	});

	it('falls back to the property key when the config will not name it', () => {
		// `getDisplayName` is Bases', so it can throw. The column still has to be named:
		// the chip's accessible name is the only thing on the row that says which property
		// it writes, so a nameless one would be worse than a crude one.
		const vault = fixture();
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 30, status: 'Active' } });
		const { config, containerEl, view } = makeView(vault, { stateProperty: 'note.status' });
		config.getDisplayName = () => {
			throw new Error('no display name');
		};
		config.order = ['note.status'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([['note.status', 'state']]);
		expect(
			rowByTitle(containerEl, 'Epic C').querySelector('.pbl-state-chip')?.getAttribute('aria-label'),
		).toBe('Change status (currently Active)');
		expect(treeOf(containerEl).querySelector('.pbl-col-label')?.textContent).toBe('status');
	});

	it('draws no columns at all when the properties menu itself throws', () => {
		const { config, containerEl, view } = makeView(fixture(), { stateProperty: 'note.status' });
		config.getOrder = () => {
			throw new Error('no order');
		};
		view.onDataUpdated();

		expect(kinds(view)).toEqual([]);
		// The rollup still heads and draws itself — it is not one of the columns — but
		// there is no property cell anywhere, in the header or on a row.
		expect(containerEl.querySelector('.pbl-prop')).toBeNull();
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
