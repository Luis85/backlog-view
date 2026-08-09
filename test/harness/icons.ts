/**
 * Draw the icons the module mock only names.
 *
 * `setIcon` in the mock records `data-icon` and nothing else, which is everything the
 * suite needs and nothing a person can see. The theme stub used to print the NAME in a
 * `::after`, which made the page readable but distorted the one thing the harness exists
 * to show: a word like `chevron-down` is several times the width of the 14px glyph it
 * stands for, so every control carrying an icon measured wider in the harness than in a
 * vault. A layout tool whose placeholders change the layout is answering a question
 * nobody asked.
 *
 * So the harness draws the real thing. Lucide is the library Obsidian itself renders
 * (`lucide-static` here, a devDependency of the harness alone), and the SVG is built the
 * way Obsidian's own `setIcon` builds it — an `<svg class="svg-icon">` child — because
 * the plugin's stylesheet sizes icons through that class (`.pbl-shelf-icon .svg-icon`
 * and its neighbours). A CSS mask on the parent would have looked right and exercised
 * none of those rules.
 *
 * Installed from HERE rather than built into the mock, the reason `chrome.ts` gives for
 * the menus: the suite empties `document.body` between tests and asserts on `data-icon`,
 * so a mock that also appended nodes would change what 68 test files measure to serve a
 * page none of them opens. `data-icon` is still set, before this runs and regardless of
 * whether it resolves.
 */
import iconNodes from 'lucide-static/icon-nodes.json';
import { setIconRenderer } from '../helpers/obsidian-mock';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** One node of a lucide icon: the tag, then its attributes. */
type IconNode = [string, Record<string, string>];

/**
 * Names Obsidian uses that this lucide no longer keys by. Obsidian bundles its own,
 * older lucide, so a handful of its names are that release's — the icon is still
 * shipped, under the name lucide renamed it to. Each of these was resolved by comparing
 * the alias's own SVG against every canonical icon's, not by guessing from the name:
 * `circle-help` and `circle-question-mark` are byte-identical drawings.
 */
const RENAMED: Record<string, string> = {
	'alert-triangle': 'triangle-alert',
	'check-square': 'square-check-big',
	'circle-help': 'circle-question-mark',
	filter: 'funnel',
	'filter-x': 'funnel-x',
	// lucide's chart rename. NOT `chart-gantt`, which is the trap here: that one draws
	// an axis — `M3 3v16a2 2 0 0 0 2 2h16`, a path `chart-no-axes-gantt` does not carry,
	// which is checkable in the installed package rather than quoted from a release this
	// repository no longer has. Obsidian's `gantt-chart` is the bare bars, so it is the
	// no-axes drawing that carries it forward under the longer name.
	'gantt-chart': 'chart-no-axes-gantt',
	'indent-decrease': 'list-indent-decrease',
	'indent-increase': 'list-indent-increase',
	'loader-2': 'loader-circle',
};

const NODES = iconNodes as unknown as Record<string, IconNode[]>;

/**
 * Obsidian's own `setIcon` presentation attributes. Stroke and width are what make a
 * lucide glyph a lucide glyph; `currentColor` is what lets the plugin's own rules colour
 * it, which several of them do (`.pbl-shelf-icon { color: var(--text-muted) }`).
 */
const SVG_ATTRS: Record<string, string> = {
	xmlns: SVG_NS,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	'stroke-width': '2',
	'stroke-linecap': 'round',
	'stroke-linejoin': 'round',
	class: 'svg-icon',
};

function buildIcon(nodes: IconNode[]): SVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	for (const [name, value] of Object.entries(SVG_ATTRS)) svg.setAttribute(name, value);
	for (const [tag, attrs] of nodes) {
		const child = document.createElementNS(SVG_NS, tag);
		for (const [name, value] of Object.entries(attrs)) child.setAttribute(name, value);
		svg.appendChild(child);
	}
	return svg;
}

/**
 * Install the renderer. Idempotent, and safe to call before any icon is drawn — the
 * mount does, beside `drawChrome`.
 *
 * An unresolved name is marked rather than skipped: drawing nothing would make a typo in
 * an icon name invisible in the one tool built for looking, and the theme stub prints
 * the name for anything wearing `data-icon-missing`. That is the old behaviour, kept
 * exactly where it is still the useful one.
 */
export function drawIcons(): void {
	setIconRenderer((el, icon) => {
		el.querySelector('svg.svg-icon')?.remove();
		const nodes = NODES[icon] ?? NODES[RENAMED[icon] ?? ''];
		if (!nodes) {
			el.dataset.iconMissing = icon;
			return;
		}
		delete el.dataset.iconMissing;
		el.appendChild(buildIcon(nodes));
	});
}
