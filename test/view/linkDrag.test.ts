// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, useViewHarness } from '../helpers/view';
import { barFor, gripNames, rowFor, shelfOf } from '../helpers/roadmap';
import { cardDrag, gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
import { legalTargetPaths } from '../../src/view/interactions/dependencies';
import { BacklogItem, BacklogModel } from '../../src/domain/model';

useViewHarness();

const DEPS = { dependsOnProperty: 'note.dependsOn' };

/** B waits for A, C waits for B, D waits for nothing — a two-deep chain plus a loner. */
function chainVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' } });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' } });
	vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 40 } });
	return vault;
}

/**
 * A, B (waits for A) and C (waits for B) under an Epic parent — so filtering the Epic
 * out of the results still loads it as a genuine context row (`outsideFilter: true`),
 * an ancestor of every result, rather than dropping it from the model entirely. An
 * unrelated note excluded from `only` never loads at all (nothing pulls it in as
 * someone's ancestor), so it cannot stand in for this case — this fixture exists
 * because that distinction is exactly what the target-side guard is about.
 */
function ancestorVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 5 } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' }, parentLink: 'Epic' });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' }, parentLink: 'Epic' });
	return vault;
}

function itemFor(model: BacklogModel, path: string): BacklogItem {
	const item = model.byPath.get(path);
	if (!item) throw new Error(`no item: ${path}`);
	return item;
}

describe('which bars a link may be dropped onto', () => {
	function sweep(vault: FakeVault, from: string, only?: string[]) {
		const { view } = makeView(vault, DEPS, only ? { only } : {});
		const model = view.model;
		if (!model) throw new Error('no model');
		return { paths: [...legalTargetPaths(view.app, model, itemFor(model, from))].sort(), model, view };
	}

	it('refuses the source itself and anything already waiting for it', () => {
		// A is already B's prerequisite, so dropping A on B would write the line that is
		// on disk. A on A is the loop of length one.
		expect(sweep(chainVault(), 'A.md').paths).toEqual(['C.md', 'D.md']);
	});

	it('refuses a target the source waits on THROUGH a chain, not only directly', () => {
		// C waits for B waits for A. Dropping C onto A would make A wait for C and close
		// a three-node loop — a one-hop check would miss it and offer A.
		expect(sweep(chainVault(), 'C.md').paths).toEqual(['D.md']);
	});

	it('refuses a row the Base excluded, which is never a write target', () => {
		// Epic is a genuine context row here: it is A/B/C's parent, so `only` excluding it
		// from the results still loads it into the model as an ancestor — `outsideFilter:
		// true`, not simply absent. Nothing about its own dependency graph would disqualify
		// it as a target (it declares nothing, waits on nothing, closes no loop), so this
		// is the case that tells the target-side `outsideFilter` guard apart from a target
		// that was never a candidate to begin with.
		const { paths } = sweep(ancestorVault(), 'A.md', ['A.md', 'B.md', 'C.md']);
		expect(paths).toEqual(['C.md']);
	});

	it('refuses a target whose existing entry never resolved into a real edge', () => {
		// B names A twice, once bare and once bracketed. Both spellings are B's own
		// declaration, so A must not be offered for B however the line reads.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: ['A', '[[A]]'] } });
		expect(sweep(vault, 'A.md').paths).toEqual([]);
	});
});

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };

function datedLinkView(vault: FakeVault, values: Record<string, unknown> = { ...DATE_AXIS, ...DEPS }) {
	const harness = makeView(vault, values, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('dates');
	return harness;
}

function barVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' } });
	vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-20', due: '2026-08-28' } });
	return vault;
}

function connectorFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	return barFor(containerEl, title).querySelector<HTMLElement>('.pbl-bar-connector');
}

describe('the connector on a drawn bar', () => {
	it('is drawn on a result bar when the dependency key is bound', () => {
		const { containerEl } = datedLinkView(barVault());
		expect(connectorFor(containerEl, 'Alpha')).not.toBeNull();
	});

	it('is absent when the dependency key is unbound — a feature this view does not have', () => {
		const { containerEl } = datedLinkView(barVault(), DATE_AXIS);
		expect(connectorFor(containerEl, 'Alpha')).toBeNull();
	});

	it('is offered on an INFERRED bar, which has no date grip at all', () => {
		// A parent stating no dates of its own, drawn from its child's. `barHolds`
		// withholds every grip because there is no baseline to move from; a link claims
		// no date, so it needs none.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' },
			parentLink: 'Parent',
		});
		const { containerEl } = datedLinkView(vault);
		expect(gripNames(containerEl, 'Parent')).toEqual([]);
		expect(connectorFor(containerEl, 'Parent')).not.toBeNull();
	});

	it('marks a bar whose end the window clamps, so its connector can sit inside the grid', () => {
		// Far enough out that the window exceeds MAX_TIMELINE_DAYS and clamps around
		// today, leaving this bar's end off the drawn grid.
		const vault = barVault();
		vault.addFile('Far.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-08-04', due: '2036-08-04' } });
		const { containerEl } = datedLinkView(vault);
		const bar = barFor(containerEl, 'Far');
		expect(bar.classList.contains('pbl-bar-clipped-end')).toBe(true);
		expect(bar.querySelector('.pbl-bar-connector')).not.toBeNull();
	});

	it('is absent where no bar is drawn at all', () => {
		// Wholly outside the window: `barClasses` returns early with pbl-bar-outside and
		// there is no on-screen end for a handle to sit past.
		const vault = barVault();
		vault.addFile('Ancient.md', { frontmatter: { type: 'PBI', order: 30, start: '1990-01-01', due: '1990-02-01' } });
		const { containerEl } = datedLinkView(vault);
		const bar = barFor(containerEl, 'Ancient');
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		expect(bar.querySelector('.pbl-bar-connector')).toBeNull();
	});
});

/** The whole gesture: pick the connector up, cross a bar, release on it. */
function linkDrag(connector: HTMLElement, targetBar: HTMLElement): void {
	cardDrag(connector, targetBar);
}

describe('drawing a dependency from one bar to another', () => {
	it('writes to the bar dropped ONTO, which is the one that waits', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(vault.fm('Beta.md')['dependsOn']).toEqual(['[[Alpha]]']);
		expect(vault.fm('Alpha.md')['dependsOn']).toBeUndefined();
	});

	it('changes no date, on either note', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(vault.fm('Beta.md')['start']).toBe('2026-08-20');
		expect(vault.fm('Beta.md')['due']).toBe('2026-08-28');
		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});

	it('writes nothing when released on an illegal target', async () => {
		// Beta already waits for Alpha, so Alpha onto Beta would write the line on disk.
		const vault = barVault();
		vault.fm('Beta.md')['dependsOn'] = ['[[Alpha]]'];
		const { containerEl } = datedLinkView(vault);
		const before = JSON.stringify(vault.fm('Beta.md'));
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(JSON.stringify(vault.fm('Beta.md'))).toBe(before);
	});

	it('writes nothing when released on its own bar', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Alpha'));
		await flush();

		expect(vault.fm('Alpha.md')['dependsOn']).toBeUndefined();
	});

	it('marks the illegal targets while the drag is held, and clears them when it ends', () => {
		const vault = barVault();
		vault.fm('Beta.md')['dependsOn'] = ['[[Alpha]]'];
		const { containerEl } = datedLinkView(vault);
		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);

		expect(rowFor(containerEl, 'Beta')?.classList.contains('pbl-link-illegal')).toBe(true);
		expect(rowFor(containerEl, 'Alpha')?.classList.contains('pbl-link-source')).toBe(true);

		gesture.cancel();
		expect(rowFor(containerEl, 'Beta')?.classList.contains('pbl-link-illegal')).toBe(false);
	});

	it('sweeps legality ONCE per drag, not once per frame', () => {
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		const model = view.model;
		if (!model) throw new Error('no model');
		// The sweep walks `byPath` once for itself and once per target inside
		// `candidates`; what matters is that crossing more bars adds none of that.
		const spy = vi.spyOn(model.byPath, 'values');
		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);
		const afterStart = spy.mock.calls.length;
		expect(afterStart).toBeGreaterThan(0);

		gesture.over(barFor(containerEl, 'Beta'), { clientX: 40 });
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 60 });
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 80 });

		expect(spy.mock.calls.length).toBe(afterStart);
		gesture.cancel();
	});

	it('draws the preview line while the pointer moves, minting it once and moving it after', async () => {
		// `wireLinkPointer`'s own `onDrag` rides the library's per-frame throttle
		// (`raf-schd`), unlike `onDragEnter`, so this is the one interaction in the suite
		// that needs a REAL animation frame rather than a synthetic event alone — and
		// letting one elapse also ticks the scroller's own auto-scroll loop
		// (`wireScroller`, registered on every timeline render), which polls a jsdom API
		// this harness deliberately never stubs (`dnd.ts`'s own comment on `cancel()`).
		// Stubbed locally and restored after, rather than in the shared harness: every
		// other test in the suite ends its gesture before a real frame ever elapses, so
		// nothing else needs it, and a global stub would hide that from them too.
		const original = (document as { elementsFromPoint?: (x: number, y: number) => Element[] }).elementsFromPoint;
		(document as { elementsFromPoint?: (x: number, y: number) => Element[] }).elementsFromPoint = () => [];
		try {
			const vault = barVault();
			const { containerEl } = datedLinkView(vault);
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no content box');
			const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);

			gesture.over(barFor(containerEl, 'Beta'), { clientX: 40 });
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const line = content.querySelector('.pbl-link-preview-line');
			expect(line).not.toBeNull();
			expect(content.querySelectorAll('.pbl-link-preview').length).toBe(1);

			gesture.over(barFor(containerEl, 'Beta'), { clientX: 80 });
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			// The SAME layer and path, moved rather than replaced — one node per drag,
			// not one per frame.
			expect(content.querySelectorAll('.pbl-link-preview').length).toBe(1);
			expect(content.querySelector('.pbl-link-preview-line')).toBe(line);
			expect(line?.getAttribute('d')).toContain('80');

			gesture.cancel();
		} finally {
			(document as { elementsFromPoint?: (x: number, y: number) => Element[] }).elementsFromPoint = original;
		}
	});

	it('re-checks legality against the CURRENT model, not the snapshot taken at drag start', async () => {
		// The model object itself is mutated in place rather than driven through a
		// re-render: a re-render rewires every target from scratch (a fresh `dnd`
		// registration per row, same as any other render pass), which would tear down
		// the very gesture this test is mid-way through holding — the graph changing
		// underneath a LIVE registration, which a re-render can never exercise, is
		// exactly the case `drop`'s own comment is about.
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		const model = view.model;
		const alpha = model?.byPath.get('Alpha.md');
		const beta = model?.byPath.get('Beta.md');
		if (!model || !alpha || !beta) throw new Error('missing items');

		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);
		// Beta comes to already wait for Alpha while the gesture is held — closing the
		// very loop this drop would otherwise ask for.
		beta.prerequisites = [alpha];
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 10 });
		gesture.drop(barFor(containerEl, 'Beta'), { clientX: 10 });
		await flush();

		expect(vault.fm('Beta.md')['dependsOn']).toBeUndefined();
	});
});

describe('a link drag is refused by every target that means a move', () => {
	it('writes no date when released on the timeline grid', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		const at = pannedGrid(containerEl, { rectLeft: 320, scrollLeft: 90 });
		gridDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, overlayOf(containerEl), { clientX: at(400) });
		await flush();

		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});

	it('does not unschedule when released on the dated shelf', async () => {
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		view.setShelfCollapsed(false);
		const shelf = shelfOf(containerEl);
		if (!shelf) throw new Error('no shelf');
		cardDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, shelf);
		await flush();

		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});
});
