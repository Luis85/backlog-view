/** The bundle's entry point. Everything real is in `mount.ts`, which a test can drive. */
import { mountHarness } from './mount';
import { perfWanted, reportPerf, wantedNotes } from './perf';
import { drawSchemeToggle } from './theme';

/**
 * `?fixture=edges` mounts the awkward cases instead of the everyday backlog, and
 * `?fixture=folders` the same backlog filed in folders with inference on.
 */
const wantedFixture = new URLSearchParams(window.location.search).get('fixture');
const fixture = wantedFixture === 'edges' || wantedFixture === 'folders' ? wantedFixture : 'demo';
// Measured HERE rather than inside `reportPerf`, which cannot be handed a view that does
// not exist yet: the mount is the one measurement that happens before there is anything to
// measure it with. `?notes=800` is what makes the number worth reading.
//
// The HEIGHT is taken on the same line as the time, and that is the point of taking it
// here at all: `?view=` is applied below, so anything read after it describes the
// requested projection rather than the collapsed tree this pair is labelled for.
const mountStarted = performance.now();
const { view, containerEl } = mountHarness(document.body, fixture, wantedNotes(window.location.search));
const mount = { ms: performance.now() - mountStarted, px: containerEl.scrollHeight };

// After the mount: the toggle is the harness's own furniture and is appended to the
// body, which `mountHarness` empties.
drawSchemeToggle();

/**
 * `?view=board` / `?view=roadmap` / `?view=deliverables` opens straight into a projection.
 *
 * The toolbar toggle is the real control and works; this exists so that LOOKING at a
 * projection needs no way to click — a headless browser screenshotting a URL is the
 * whole recipe, and driving a click from outside would mean the browser automation
 * dependency this harness is built to avoid.
 */
const wanted = new URLSearchParams(window.location.search).get('view');
if (wanted === 'board' || wanted === 'roadmap' || wanted === 'tree' || wanted === 'deliverables') {
	view.setProjection(wanted);
}

// Last, because the run drives all four projections and restores whichever was open: run
// first, it would have restored the tree over the projection `?view=` was about to ask for.
if (perfWanted(window.location.search)) reportPerf(view, containerEl, mount);
