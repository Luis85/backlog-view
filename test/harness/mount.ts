/**
 * Mount the REAL view outside Obsidian, for looking at rather than for asserting on.
 *
 * Everything here already existed for the test suite — the `obsidian` module mock, the
 * fake vault, the construction order a Bases view needs. The only thing this adds is a
 * mount that does not depend on vitest, so the same view can be bundled into a page and
 * opened in a browser (`npm run harness`). It draws; it checks nothing. jsdom remains
 * the substitute for Obsidian in tests (ADR 0006), and a real vault remains the only
 * place appearance is verified (ADR 0020).
 */
import { ProductBacklogView } from '../../src/view/backlogView';
import { drawChrome } from './chrome';
import { drawIcons } from './icons';
import { installObsidianDom } from '../helpers/dom';
import { demoOptions, demoOrder, demoResults, demoVault, edgeCaseVault, folderOptions } from '../helpers/fixtures';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { FileView } from '../helpers/obsidian-mock';

/**
 * How long after the last write of a batch the view is re-rendered.
 *
 * `FakeVault.afterWrite` fires as each write LANDS, which is inside the batch — the
 * point the suite uses to interleave a Bases update with one on purpose. Re-rendering
 * there would rebuild the model mid-batch, so the hook resets a timer instead and the
 * render happens once the writes stop. The delay is the cost of the fake vault not
 * exposing a batch boundary; nothing in the harness is timed against it.
 */
const SETTLE_MS = 100;

/**
 * What the view's own first draw cost, for `?perf`'s mount row.
 *
 * Measured HERE because this is the only place the boundary exists. Timing `mountHarness`
 * from outside it counted generating the fixture's notes, filling the fake vault and
 * drawing the harness's chrome — work that scales with `?notes=` and belongs to the
 * harness rather than to the view, so the row got more misleading exactly at the sizes
 * this mode is aimed at. The clock now starts after all of that. (Codex, PR #128.)
 *
 * The height is taken on the same call for the same reason the time is: everything after
 * this point — `?view=`, the expansion — describes something other than the collapsed
 * tree the row is labelled for.
 */
export interface Mount {
	ms: number;
	px: number;
}

/**
 * The height of what was actually DRAWN, and the layout flush that reading it forces.
 *
 * Neither `scrollHeight` answers this. The container's is clamped to the pane, and the
 * scroller `.pbl-tree` is a flex child that fills it — an element's `scrollHeight` can
 * never be smaller than its `clientHeight`, so both report the viewport whenever the
 * content is shorter than the pane, which is every sparse fixture and every small
 * `?notes=`. Twice now that column has looked like data and been the pane's height.
 * (Codex, PR #128.)
 *
 * The last child's bottom, measured against the scroller's own top and its scroll
 * offset, is the content height in both directions — and it forces the same layout,
 * which is the reason the read sits inside the measurement at all.
 */
export function drawnHeight(containerEl: HTMLElement): number {
	const scroller = containerEl.querySelector<HTMLElement>('.pbl-tree');
	if (scroller === null) return containerEl.scrollHeight;
	const last = scroller.lastElementChild;
	if (last === null) return 0;
	return Math.round(last.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top + scroller.scrollTop);
}

export interface MountedHarness {
	view: ProductBacklogView;
	vault: FakeVault;
	containerEl: HTMLElement;
	mount: Mount;
}

/**
 * Which backlog to mount. See `edgeCaseVault` for why there is more than one, and
 * `Layout` for why `folders` is the same backlog rather than a third one: it is
 * `demo` filed the way a folder-note vault files it, mounted with inference on.
 */
export type HarnessFixture = 'demo' | 'edges' | 'folders';

/**
 * Build the view into `root` against a fixture and return the pieces, so a test can
 * drive the same mount a browser gets.
 *
 * `extra` grows the backlog by that many generated notes (`?notes=800`), which is what
 * makes the page usable for asking what the view costs at a size — see `addBulk`. The
 * edge-case fixture ignores it: it is a set of awkward cases, and a thousand more of them
 * is not a bigger question.
 *
 * The Bases leaf is real nesting on purpose: the
 * view identifies its base through the leaf showing the `.base` file, and without it
 * the view-state store — projection, expanded rows, shelf state — has no identity to key
 * on and nothing survives a reload.
 */
export function mountHarness(root: HTMLElement, fixture: HarnessFixture = 'demo', extra = 0): MountedHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const vault =
		fixture === 'edges' ? edgeCaseVault() : demoVault(fixture === 'folders' ? 'folders' : 'flat', extra);
	const leafEl = root.createDiv('pbl-harness-leaf');
	const containerEl = leafEl.createDiv();
	vault.addLeaf(new FileView(vault.addFile('Demo.base'), leafEl));

	const view = new ProductBacklogView({} as never, containerEl);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	const config = new FakeViewConfig(fixture === 'folders' ? folderOptions() : demoOptions());
	// The Bases properties menu is what puts a column on a row, chips included, so the
	// page has to declare a visible order or it draws a strip with nothing in it.
	config.order = demoOrder();
	anyView.config = config;
	anyView.data = { data: demoResults(vault) };

	let settle: ReturnType<typeof setTimeout> | undefined;
	vault.afterWrite = () => {
		clearTimeout(settle);
		settle = setTimeout(() => {
			anyView.data = { data: demoResults(vault) };
			view.onDataUpdated();
		}, SETTLE_MS);
	};

	// The one measurement that has to happen here rather than in `perf.ts` — see `Mount`.
	// Unconditional because a branch on `?perf` would mean the timed mount and the ordinary
	// one were different code paths, and the timed one is the whole point.
	const started = performance.now();
	view.onDataUpdated();
	// Read BEFORE the clock stops, and that ordering is the measurement rather than a detail
	// of it: reading it is what forces the browser to do the style and layout work it would
	// otherwise defer past the last `performance.now()`. `sample()` in `perf.ts` is built
	// the same way, so this row is comparable with the four below it — written as one object
	// literal, whose properties evaluate left to right, it excluded the layout it was
	// supposed to include and understated the draw.
	// See `drawnHeight`: neither container nor scroller `scrollHeight` answers this.
	const px = drawnHeight(containerEl);
	const mount = { ms: performance.now() - started, px };
	return { view, vault, containerEl, mount };
}
