/** The bundle's entry point. Everything real is in `mount.ts`, which a test can drive. */
import { mountHarness } from './mount';
import { drawSchemeToggle } from './theme';

const { view } = mountHarness(document.body);

// After the mount: the toggle is the harness's own furniture and is appended to the
// body, which `mountHarness` empties.
drawSchemeToggle();

/**
 * `?view=board` / `?view=roadmap` opens straight into a projection.
 *
 * The toolbar toggle is the real control and works; this exists so that LOOKING at a
 * projection needs no way to click — a headless browser screenshotting a URL is the
 * whole recipe, and driving a click from outside would mean the browser automation
 * dependency this harness is built to avoid.
 */
const wanted = new URLSearchParams(window.location.search).get('view');
if (wanted === 'board' || wanted === 'roadmap' || wanted === 'tree') view.setProjection(wanted);
