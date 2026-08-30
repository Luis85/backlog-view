import { describe, expect, it } from 'vitest';
import { offerableTypes } from '../../src/view/projection';
import type { BacklogViewHost, Projection } from '../../src/view/host';
import { ITERATION_TYPE, RELEASE_TYPE } from '../../src/domain/typeVocabulary';

/**
 * **A projection offers only the types it can show** — asked of the helper, across every
 * projection, rather than of a surface.
 *
 * That framing is the point. This rule has now been broken three times by being applied a
 * surface at a time, and each break was found by someone driving a screen nobody had
 * driven before: the boards offering `Deliverable`, then the board's early return leaving
 * `Test suite` and `Test case` offerable, then the same early return leaving `Iteration`
 * and `Release` offerable ([[An Iteration focus offers a type the board cannot draw]]).
 * A test per surface is exactly what let the second and third through, so this one asks
 * the category: no projection, on any of them, offers a type `inPlan` refuses to draw.
 *
 * A plain stub host rather than a mounted view, because the whole-vocabulary path reads
 * `host.projection` and nothing else — a fixture here would only add a way for this to
 * pass for the wrong reason.
 */
const PROJECTIONS: Projection[] = ['tree', 'board', 'roadmap', 'deliverables', 'catalog', 'iteration'];

const hostOn = (projection: Projection) => ({ projection }) as unknown as BacklogViewHost;

describe('what a projection offers', () => {
	it('offers Iteration and Release on no projection at all', () => {
		// Each has a door of its own — the board's scope picker and the release view's
		// `New release` — and neither is drawn by any projection of this view, so a `New`
		// here would make a note that vanished on the pass that created it.
		for (const projection of PROJECTIONS) {
			const offered = offerableTypes(hostOn(projection));
			expect(offered, projection).not.toContain(ITERATION_TYPE);
			expect(offered, projection).not.toContain(RELEASE_TYPE);
		}
	});

	it('still offers each projection something to create', () => {
		// The instrument before its verdict: a narrowing that returned nothing everywhere
		// would satisfy the assertion above and break every New menu in the plugin.
		for (const projection of PROJECTIONS) {
			expect(offerableTypes(hostOn(projection)), projection).not.toEqual([]);
		}
	});
});
