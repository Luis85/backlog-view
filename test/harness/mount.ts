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
import type { BasesPropertyId } from 'obsidian';
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
	/** Rows and cards the first draw put on screen — see `Row.drew` in `perf.ts`. */
	drew: number;
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

/**
 * FNV-1a over the lines, as eight hex digits. Nothing here needs collision resistance —
 * the question is whether two builds handed the view the same thing, and a hash that
 * differs when they differ answers it. `crypto.subtle` is async and wants a secure
 * context, which a `file://` page is not.
 */
function fingerprint(lines: string[]): string {
	let hash = 0x811c9dc5;
	for (const char of lines.join('\u0001')) {
		hash ^= char.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

/**
 * Keys in sorted order, so an object literal's own ordering cannot move the fingerprint —
 * and everything that is NOT an object serialized as itself.
 *
 * The second half was missing while this only ever saw the options object, and became a
 * hole the moment entry VALUES joined the hash: `Object.keys(1)` and `Object.keys(true)`
 * are both empty, so every truthy primitive collapsed to `[]`, and the `!value` guard put
 * `0`, `false`, `''` and `null` together at `''`. A Base answering `1` where another
 * answers `2` would have fingerprinted identically — the exact comparison this exists to
 * refuse. Recursive, so a nested object is ordered too rather than only the top level.
 * (Codex, PR #137.)
 */
function stableJson(value: unknown): string {
	const ordered = (v: unknown): unknown => {
		if (Array.isArray(v)) return v.map(ordered);
		if (v !== null && typeof v === 'object') {
			const obj = v as Record<string, unknown>;
			return Object.keys(obj).sort().map((key) => [key, ordered(obj[key])]);
		}
		return v;
	};
	// `JSON.stringify(undefined)` is `undefined`, not a string, and a hash input has to be
	// one — spelled out rather than defaulted to `''`, which is what an empty string is.
	return JSON.stringify(ordered(value)) ?? 'undefined';
}

export interface MountedHarness {
	view: ProductBacklogView;
	vault: FakeVault;
	containerEl: HTMLElement;
	mount: Mount;
	/**
	 * A fingerprint of the WORKLOAD — the view options and property order this mount
	 * configured, every note in the vault with its frontmatter, and which of them the Base
	 * returns, in its order.
	 *
	 * The COUNT is not the workload: two builds can hand the view the same number of notes
	 * with a different hierarchy, different fields or a different generated shape, and then
	 * `results` and `drew` both match while the cards and the layout work do not. A run
	 * comparing them reported no mismatch and presented the delta as like-for-like. The
	 * configuration is in here for the same reason and arrived one round later: the notes
	 * can be identical while the columns, the workflow or the horizons are not.
	 *
	 * What is deliberately NOT in it is the RESOLVED settings — the ladder and every other
	 * default that `domain/` supplies where the options are silent. Those are the code under
	 * measurement: a run comparing a build that changed a default is a run asking what that
	 * change cost, and answering it with "unlike workloads" would refuse the question this
	 * tool exists for. The line is inputs, not behaviour. (Codex, PR #137.)
	 *
	 * Cheap and non-cryptographic on purpose: this answers "did the workload change", never
	 * "what was it", and it is computed before the mount's own clock starts.
	 */
	contents: string;
	/**
	 * How many results the view was HANDED — the population every number is of.
	 *
	 * Not the `?notes=` request, which the edge-case fixture ignores entirely, and not the
	 * generated extras either: `edges` mounts curated cases and would have reported "0
	 * notes" while drawing four, and the demo's own curated notes are in every measurement
	 * beside the generated ones. Counted off the array actually given to the view, which is
	 * the only number that cannot disagree with what was drawn. (Codex, PR #137.)
	 */
	results: number;
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

	// The edge-case fixture ignores `extra`: a thousand more awkward cases is not a bigger
	// question. What the run reports is the population below, never this request.
	const vault = fixture === 'edges' ? edgeCaseVault() : demoVault(fixture === 'folders' ? 'folders' : 'flat', extra);
	const leafEl = root.createDiv('pbl-harness-leaf');
	const containerEl = leafEl.createDiv();
	vault.addLeaf(new FileView(vault.addFile('Demo.base'), leafEl));

	const view = new ProductBacklogView({} as never, containerEl);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	const options = fixture === 'folders' ? folderOptions() : demoOptions();
	const config = new FakeViewConfig(options);
	// The Bases properties menu is what puts a column on a row, chips included, so the
	// page has to declare a visible order or it draws a strip with nothing in it.
	const order = demoOrder();
	config.order = order;
	anyView.config = config;
	const results = demoResults(vault);
	anyView.data = { data: results };
	// The CONFIGURATION is workload too, not just the notes: the visible property order,
	// the workflow states, the horizons and the scale all change what each card and bucket
	// draws while every note stays as it was — and then the counts and the contents match
	// across two builds that rendered different work. (Codex, PR #137.)
	const contents = fingerprint([
		stableJson(options),
		JSON.stringify(order),
		// Every note in the VAULT, not only the results: `Retired platform` is excluded from
		// what the Base returns and the model still loads it as a context row, so a change to
		// it is a change to the work with nothing in a results-only hash to show for it.
		// (Codex, PR #137.)
		...[...vault.frontmatter.keys()].sort().map((path) => `${path}\u0000${stableJson(vault.frontmatter.get(path))}`),
		// And which of them the Base returns, in its order, since that is a second fact
		// about the workload that the note set alone does not carry.
		results.map((entry) => entry.file.path).join('\u0002'),
		// And what each result ANSWERS for each visible property, which is neither of the
		// two above: `renderValue` draws `entry.getValue()`, not the frontmatter, so a Base
		// supplying a different computed or plain value draws a different cell over notes
		// that never moved. It hashes to a run of nulls today — `FakeVault.entryValues` is
		// populated by nothing — so this catches no comparison that can be made right now,
		// and it is here because the fingerprint's promise is "the inputs the view was
		// handed" and an input left out of it opens silently the day a fixture supplies
		// one. (Codex, PR #137.)
		...results.map((entry) => order.map((id) => stableJson(entry.getValue(id as BasesPropertyId))).join('\u0001')),
	]);

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
	// After the clock, like `sample`'s own count: this says what the row is a measurement
	// OF, and a query inside the measurement would be measuring the query.
	const mount = { ms: performance.now() - started, px, drew: containerEl.querySelectorAll('.pbl-row, .pbl-card').length };
	return { view, vault, containerEl, mount, results: results.length, contents };
}
