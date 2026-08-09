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
import { demoOptions, demoResults, demoVault, edgeCaseVault } from '../helpers/fixtures';
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

export interface MountedHarness {
	view: ProductBacklogView;
	vault: FakeVault;
	containerEl: HTMLElement;
}

/** Which backlog to mount. See `edgeCaseVault` for why there is more than one. */
export type HarnessFixture = 'demo' | 'edges';

/**
 * Build the view into `root` against a fixture and return the pieces, so a test can
 * drive the same mount a browser gets. The Bases leaf is real nesting on purpose: the
 * view identifies its base through the leaf showing the `.base` file, and without it
 * the collapse store — projection, expanded rows, shelf state — has no identity to key
 * on and nothing survives a reload.
 */
export function mountHarness(root: HTMLElement, fixture: HarnessFixture = 'demo'): MountedHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const vault = fixture === 'edges' ? edgeCaseVault() : demoVault();
	const leafEl = root.createDiv('pbl-harness-leaf');
	const containerEl = leafEl.createDiv();
	vault.leaves.push({ view: new FileView(vault.addFile('Demo.base'), leafEl) });

	const view = new ProductBacklogView({} as never, containerEl);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = new FakeViewConfig(demoOptions());
	anyView.data = { data: demoResults(vault) };

	let settle: ReturnType<typeof setTimeout> | undefined;
	vault.afterWrite = () => {
		clearTimeout(settle);
		settle = setTimeout(() => {
			anyView.data = { data: demoResults(vault) };
			view.onDataUpdated();
		}, SETTLE_MS);
	};

	view.onDataUpdated();
	return { view, vault, containerEl };
}
