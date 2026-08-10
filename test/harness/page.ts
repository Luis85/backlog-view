/** The bundle's entry point. Everything real is in `mount.ts`, which a test can drive. */
import { mountHarness } from './mount';
import { drawSchemeToggle } from './theme';

/**
 * `?fixture=edges` mounts the awkward cases instead of the everyday backlog, and
 * `?fixture=folders` the same backlog filed in folders with inference on.
 */
const wantedFixture = new URLSearchParams(window.location.search).get('fixture');
const fixture = wantedFixture === 'edges' || wantedFixture === 'folders' ? wantedFixture : 'demo';
const { view } = mountHarness(document.body, fixture);

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
