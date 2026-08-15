// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { NullValue } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import { Harness, makeView, useViewHarness } from '../helpers/view';
import { BacklogItem } from '../../src/domain/model';
import { Column } from '../../src/view/host';
import { renderInputs, reusableColumns, rowSignature } from '../../src/view/rowSignature';

useViewHarness();

const PLACE = { pos: 1, count: 1 };

/** A one-note view whose only file carries the given frontmatter beside a type and an order. */
function viewOf(fm: Record<string, unknown> = {}, config: Record<string, unknown> = {}): Harness {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, ...fm } });
	return makeView(vault, config);
}

function itemIn(harness: Harness, path = 'Alpha.md'): BacklogItem {
	const item = harness.view.model?.byPath.get(path);
	if (!item) throw new Error(`no item for ${path}`);
	return item;
}

function sigOf(fm: Record<string, unknown>, config: Record<string, unknown> = {}): string {
	const harness = viewOf(fm, config);
	return rowSignature(harness.view, itemIn(harness), PLACE);
}

describe('rowSignature', () => {
	it('agrees for two items drawing the same row', () => {
		expect(sigOf({ status: 'Open' })).toBe(sigOf({ status: 'Open' }));
	});

	it('differs when a frontmatter value a cell draws changes', () => {
		expect(sigOf({ status: 'Open' })).not.toBe(sigOf({ status: 'Doing' }));
	});

	it('differs across values JSON would flatten together', () => {
		// Each pair serializes identically under a plain `JSON.stringify`, and each is a
		// FALSE MATCH — the direction that ships a stale row. Table-driven so a fourth
		// collision is a row rather than another test.
		const collisions: Array<[Record<string, unknown>, Record<string, unknown>]> = [
			[{ n: null }, { n: NaN }],
			[{ n: NaN }, { n: Infinity }],
			[{ d: new Date('2026-01-01T00:00:00.000Z') }, { d: '2026-01-01T00:00:00.000Z' }],
			// A key holding `undefined` is dropped entirely, so it reads as a key that is absent.
			[{ u: undefined }, {}],
			// The tagging must not create a collision of its own: an authored string that
			// spells a sentinel is escaped out of that namespace.
			[{ n: NaN }, { n: '#num:NaN' }],
			[{ d: new Date('2026-01-01T00:00:00.000Z') }, { d: '#date:2026-01-01T00:00:00.000Z' }],
			[{ s: '#num:NaN' }, { s: '##num:NaN' }],
		];
		for (const [left, right] of collisions) {
			expect(sigOf(left)).not.toBe(sigOf(right));
		}
	});

	it('differs when a frontmatter key nothing draws is added', () => {
		// A false DIFFERENCE is the safe direction: one wasted row build, never a stale
		// cell. The frontmatter is one term precisely so no one has to decide which keys
		// a column might be pointed at tomorrow.
		expect(sigOf({ status: 'Open' })).not.toBe(sigOf({ status: 'Open', notes: 'x' }));
	});

	it('differs when the row sits at a different position among its siblings', () => {
		const harness = viewOf({ status: 'Open' });
		const item = itemIn(harness);
		// Both halves of `aria-posinset` / `aria-setsize`, because each moves alone: a
		// sibling inserted above changes the position, one appended below the size.
		const sig = (pos: number, count: number): string => rowSignature(harness.view, item, { pos, count });
		expect(sig(1, 2)).not.toBe(sig(2, 2));
		expect(sig(1, 1)).not.toBe(sig(1, 2));
	});

	it('differs when a focus level re-roots the row to another depth', () => {
		// `depth` draws `aria-level` and `--pbl-depth`, and a focus re-roots it without
		// touching a note: the same PBI is a child at depth 1 and a focus root at 0.
		const atDepth = (focus?: string): string => {
			const vault = new FakeVault();
			vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
			const harness = makeView(vault, {}, focus ? { focus } : {});
			return rowSignature(harness.view, itemIn(harness), PLACE);
		};
		expect(atDepth()).not.toBe(atDepth('PBI'));
	});

	it('differs when the row is a context row rather than a result', () => {
		// `outsideFilter` draws `.pbl-outside`, stops the row being draggable, turns every
		// chip into its static form and withholds the tag controls. The parent note is
		// byte-identical either way; only whether the Base returned it moves.
		const parentSig = (only: string[]): string => {
			const vault = new FakeVault();
			vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
			const harness = makeView(vault, {}, { only });
			return rowSignature(harness.view, itemIn(harness, 'Parent.md'), PLACE);
		};
		expect(parentSig(['Alpha.md'])).not.toBe(parentSig(['Alpha.md', 'Parent.md']));
	});

	it('differs when the rollup below the row changes', () => {
		// Both numbers, because each moves alone: a child added changes the count, a child
		// finished changes the done share. Neither touches the parent's own note, and the
		// visible-children term stays true throughout.
		const rollup = (children: Record<string, unknown>[]): string => {
			const vault = new FakeVault();
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 } });
			children.forEach((fm, i) => {
				vault.addFile(`Kid${i}.md`, { frontmatter: { type: 'Task', order: i, ...fm }, parentLink: 'Alpha' });
			});
			const harness = makeView(vault, { stateProperty: 'note.status' });
			return rowSignature(harness.view, itemIn(harness), PLACE);
		};
		expect(rollup([{ status: 'Open' }])).not.toBe(rollup([{ status: 'Open' }, { status: 'Open' }]));
		expect(rollup([{ status: 'Open' }])).not.toBe(rollup([{ status: 'Done' }]));
	});

	it('differs when the row is the selected one', () => {
		const harness = viewOf({ status: 'Open' });
		const item = itemIn(harness);
		const before = rowSignature(harness.view, item, PLACE);
		harness.view.selectItem(item, false);
		expect(rowSignature(harness.view, item, PLACE)).not.toBe(before);
	});

	it('differs when the row is collapsed', () => {
		const vault = new FakeVault();
		vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('Beta.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Alpha' });
		const harness = makeView(vault, {});
		const item = itemIn(harness);
		const before = rowSignature(harness.view, item, PLACE);
		harness.view.setCollapsed('Alpha.md', true);
		expect(rowSignature(harness.view, item, PLACE)).not.toBe(before);
	});

	it('differs when a child stops being drawn, so the chevron becomes a leaf', () => {
		// A chevron follows the VISIBLE children, so hiding a done child turns the parent
		// into a leaf without touching a byte of the parent's note — and without moving
		// its rollup, which goes on counting the child either way.
		const withChild = (showCompleted: boolean): string => {
			const vault = new FakeVault();
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, status: 'Open' } });
			vault.addFile('Beta.md', {
				frontmatter: { type: 'Task', order: 10, status: 'Done' },
				parentLink: 'Alpha',
			});
			const harness = makeView(vault, { stateProperty: 'note.status', showCompleted });
			return rowSignature(harness.view, itemIn(harness), PLACE);
		};
		expect(withChild(true)).not.toBe(withChild(false));
	});

	it('differs when the badge changes because the PARENT was retyped', () => {
		// `displayType` reads `ladder`, `levelIndex` and `typeName`. An untyped note takes
		// its rung from the parent chain, so retyping the parent redraws this badge while
		// this row's own note stays byte-identical — the `item.orphan` shape again.
		const badgeOf = (parentType: string): string => {
			const vault = new FakeVault();
			vault.addFile('Parent.md', { frontmatter: { type: parentType, order: 10 } });
			vault.addFile('Alpha.md', { frontmatter: { order: 10 }, parentLink: 'Parent' });
			const harness = makeView(vault, {});
			return rowSignature(harness.view, itemIn(harness), PLACE);
		};
		expect(badgeOf('Epic')).not.toBe(badgeOf('Feature'));
	});

	it('differs when a referenced parent starts being returned by the Base', () => {
		// `item.orphan` draws the `.pbl-orphan` unlink marker and flips with the
		// frontmatter, the depth and the position all unchanged — the enumeration gap
		// review found in the first draft of this list.
		// Focused on its own level, the row is a rendered ROOT either way, so `depth` is 0
		// in both — which is what makes this a test of `orphan` rather than of depth.
		const orphaned = (parentExists: boolean): string => {
			const vault = new FakeVault();
			if (parentExists) vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
			const harness = makeView(vault, {}, { focus: 'PBI' });
			return rowSignature(harness.view, itemIn(harness), PLACE);
		};
		expect(orphaned(false)).not.toBe(orphaned(true));
	});
});

describe('renderInputs', () => {
	it('differs when a setting that changes a row is toggled', () => {
		// showCounts turns renderRollup from no cell into a count cell, with the
		// frontmatter and the rollup numbers both unchanged.
		expect(renderInputs(viewOf({}, { showCounts: false }).view)).not.toBe(
			renderInputs(viewOf({}, { showCounts: true }).view),
		);
	});

	it('differs when the filter text changes', () => {
		const { view } = viewOf({});
		const before = renderInputs(view);
		view.setFilter('alp');
		expect(renderInputs(view)).not.toBe(before);
	});

	it('differs when the kind of value a column draws changes, the frontmatter untouched', () => {
		// The property's TYPE is Obsidian's, not the note's. What this harness can vary is
		// the CONSTRUCTOR of what a fake entry hands back, which is what `valueKinds`
		// reads; a live vault's registry retyping one scalar is out of its reach — see the
		// task report.
		const vault = new FakeVault();
		vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.entryValues.set('Alpha.md', { 'note.points': 3 });
		const { view } = makeView(vault, {}, { order: ['note.points'] });
		const before = renderInputs(view);
		vault.entryValues.set('Alpha.md', { 'note.points': '3' });
		expect(renderInputs(view)).not.toBe(before);
	});

	it('probes each column past the rows that leave it empty', () => {
		// A missing property comes back as a `NullValue` INSTANCE, not `null`, so a probe
		// asking `!= null` stops at the first empty row and records `NullValue` as that
		// column's type for good. Whichever row carries the value, the answer is the same.
		const probed = (populated: string): string => {
			const vault = new FakeVault();
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 } });
			vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20 } });
			for (const path of ['Alpha.md', 'Beta.md']) {
				vault.entryValues.set(path, { 'note.points': path === populated ? 3 : new NullValue() });
			}
			return renderInputs(makeView(vault, {}, { order: ['note.points'] }).view);
		};
		expect(probed('Alpha.md')).toBe(probed('Beta.md'));
	});

	it('reports nothing for a column no result populates, and something for one they do', () => {
		const kinds = (value: unknown): string => {
			const vault = new FakeVault();
			vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 } });
			vault.entryValues.set('Alpha.md', { 'note.points': value });
			return renderInputs(makeView(vault, {}, { order: ['note.points'] }).view);
		};
		// A value declaring itself empty draws nothing, so it is no more a source of a
		// type than an absent one is.
		expect(kinds({ isEmpty: () => true })).toBe(kinds(new NullValue()));
		expect(kinds(3)).not.toBe(kinds(new NullValue()));
	});

	it('steps over an entry that refuses the property', () => {
		const vault = new FakeVault();
		vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20 } });
		vault.entryValues.set('Beta.md', { 'note.points': 3 });
		const harness = makeView(vault, {}, { order: ['note.points'] });
		const expected = renderInputs(harness.view);
		// Bases can throw for a property an entry cannot answer for; the next row may.
		const refuser = itemIn(harness);
		refuser.entry = {
			getValue: () => {
				throw new Error('no such property');
			},
		} as unknown as typeof refuser.entry;
		expect(renderInputs(harness.view)).toBe(expected);
	});
});

describe('reusableColumns', () => {
	const col = (prop: string): Column => ({ prop: prop as Column['prop'], label: 'X', kind: 'value' });

	it('accepts frontmatter columns', () => {
		expect(reusableColumns([col('note.status')])).toBe(true);
		expect(reusableColumns([])).toBe(true);
	});

	it('refuses a column whose value can change with the frontmatter untouched', () => {
		expect(reusableColumns([col('file.mtime')])).toBe(false);
		expect(reusableColumns([col('formula.spent')])).toBe(false);
		// One is enough to refuse the pass.
		expect(reusableColumns([col('note.status'), col('file.mtime')])).toBe(false);
	});
});
