/** The bundle's entry point. Everything real is in `mount.ts`, which a test can drive. */
import { mountHarness } from './mount';
import { PROJECTIONS, perfWanted, reportPerf, wantedNotes } from './perf';
import { drawSchemeToggle } from './theme';
import { Projection } from '../../src/view/host';
import { RoadmapAxis } from '../../src/domain/roadmap';

/**
 * `?fixture=edges` mounts the awkward cases instead of the everyday backlog, and
 * `?fixture=folders` the same backlog filed in folders with inference on.
 */
const wantedFixture = new URLSearchParams(window.location.search).get('fixture');
const fixture = wantedFixture === 'edges' || wantedFixture === 'folders' ? wantedFixture : 'demo';
// `mount` is measured INSIDE `mountHarness`, around the view's own first draw — see
// `Mount` there. Timed from out here it counted the fixture generation and the harness
// chrome, which scale with `?notes=` and are not the view.
const { view, containerEl, mount, results, contents } = mountHarness(document.body, fixture, wantedNotes(window.location.search));

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
if (PROJECTIONS.includes(wanted as Projection)) {
	view.setProjection(wanted as Projection);
}

/**
 * `?axis=dates` (or `horizons`, `resources`) picks the roadmap's axis the same way
 * `?view=` picks the projection — and for the same reason: the axis is a toolbar menu,
 * so a headless browser could reach neither the timeline nor the resources rows without
 * clicking, which is the one thing a page opened by URL cannot do. It is also what lets
 * `scripts/perf.mjs` time the dated axis, whose grid and bars are a render path no other
 * URL reaches.
 *
 * Like `?view=`, this WRITES the pick — it is UI state, stored per base, so the next
 * plain open shows the axis last asked for. That is the projection knob's own bargain
 * rather than a new one.
 */
const axis = new URLSearchParams(window.location.search).get('axis');
const AXES: RoadmapAxis[] = ['horizons', 'dates', 'resources'];
if (AXES.includes(axis as RoadmapAxis)) {
	view.setAxisPick(axis as RoadmapAxis);
}

/**
 * The view and its container, for a throwaway probe pasted into a console.
 *
 * `?perf` answers what a whole call costs; a QUESTION about a call — does the scroll
 * position survive a rebuild, does hovering force layout — is a few lines of script that
 * need the view itself, and without this hook each of those means editing this file and
 * rebuilding the bundle. Nothing in the harness or the suite reads it: it exists so that
 * the thing thrown away afterwards is a paste rather than a commit.
 */
(window as unknown as Record<string, unknown>).__pbl = { view, containerEl };

// Last, because the run drives all four projections and restores whichever was open: run
// first, it would have restored the tree over the projection `?view=` was about to ask for.
if (perfWanted(window.location.search)) reportPerf(view, containerEl, mount, { fixture, results, contents });
