// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog } from '../../src/i18n/t';
import { announced } from '../helpers/dnd';
import { installObsidianDom } from '../helpers/dom';
import { roadmapView } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { itemAt, useViewHarness } from '../helpers/view';
import { MARK, markedCatalog, useMarkedLocale } from './fixtures';

installObsidianDom();
useViewHarness();

/**
 * What a card move SAYS, driven under a catalog that is not English.
 *
 * A surface of its own because it is not rendered by any projection: the announcement
 * goes to the drag library's live region, so every test in this directory that reads
 * `containerEl` walks straight past it. `roadmapMoves.test.ts` already drives these
 * sentences and reads them in ENGLISH, which cannot tell a swept call site from a missed
 * one — that is the pairing this file completes, and it is why the phrases below sat
 * unkeyed through the sweep of `view/` and its two review rounds.
 *
 * The WHOLE catalog goes behind the marker, `projections.test.ts`'s construction — but the
 * assertion is EQUALITY against the composed sentence rather than that file's "the
 * remainder is data". One string is why: an unkeyed phrase removes nothing from it, it
 * adds English BETWEEN two marked pieces, and any check that splits on the marker reads
 * that addition as the tail of the piece before it. The whole string is what sees it.
 *
 * `spanWords` is the reason to ask it here rather than at a list of keys. Its three shapes
 * are templates whose first quasi is empty or lowercase, so `UI_TEXT_LITERAL` reads no
 * capital, `TEXT_TERNARY` reads two identifiers, and an AST walk for prose finds nothing —
 * the tree rollup's own blind spot, one slice later and on a surface with no DOM.
 */

const xx: Catalog = markedCatalog();

useMarkedLocale(xx);

/**
 * The whole announcement, composed the way the view composes it: the frame with each end
 * substituted in, every piece behind the marker. Equality rather than containment, because
 * an unkeyed phrase does not remove anything — it ADDS English between two marked pieces,
 * which only the whole string can see.
 */
const said = (title: string, from: string, to: string): string =>
	MARK + en['move.announced'].replace('{title}', title).replace('{from}', from).replace('{to}', to);

const key = (name: 'lane.spanRange' | 'lane.spanFrom' | 'lane.spanUntil' | 'lane.unreadableStart' | 'placement.unscheduled', params: Record<string, string> = {}): string =>
	Object.entries(params).reduce((text, [param, value]) => text.replace(`{${param}}`, value), MARK + en[name]);

/** The dated axis, where a span is what a move is named by. */
function datedView(vault: FakeVault) {
	const harness = roadmapView(vault, { startProperty: 'note.start', targetProperty: 'note.target' });
	harness.view.setProjection('roadmap');
	return harness;
}

describe('a move on the dated axis names both its ends from the catalog', () => {
	it('names a two-ended span through the catalog, not a joined pair of dates', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Both.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		const { view } = datedView(vault);
		const item = itemAt(view, 'Both.md');

		await view.performScheduleMove(item, { start: null, target: null });

		expect(await announced()).toBe(
			said('Both', key('lane.spanRange', { start: '2026-08-01', target: '2026-08-31' }), key('placement.unscheduled')),
		);
	});

	it('names an open start and an open end from it, each by its own key', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		vault.addFile('Until.md', { frontmatter: { type: 'PBI', order: 20, target: '2026-08-31' } });
		const { view } = datedView(vault);

		await view.performScheduleMove(itemAt(view, 'Open.md'), { start: null, target: null });
		const fromSaid = await announced();
		await view.performScheduleMove(itemAt(view, 'Until.md'), { start: null, target: null });
		const untilSaid = await announced();

		expect(fromSaid).toBe(said('Open', key('lane.spanFrom', { start: '2026-08-01' }), key('placement.unscheduled')));
		expect(untilSaid).toBe(said('Until', key('lane.spanUntil', { target: '2026-08-31' }), key('placement.unscheduled')));
	});

	it('names an unreadable end from it too, rather than reporting no placement', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Bad.md', { frontmatter: { type: 'PBI', order: 10, start: 'soon' } });
		const { view } = datedView(vault);

		await view.performScheduleMove(itemAt(view, 'Bad.md'), { start: null, target: null });

		expect(await announced()).toBe(said('Bad', key('lane.unreadableStart'), key('placement.unscheduled')));
	});
});
