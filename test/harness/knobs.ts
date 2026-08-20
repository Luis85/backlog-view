/**
 * URL knobs that drive the VIEW, for states a screenshot cannot click its way to.
 *
 * `?view=` and `?axis=` in `page.ts` are the same idea for the projection and the axis.
 * These are here rather than there because they are worth a test: what each does is a
 * real call into the view, and a knob that silently stopped making its state is a page
 * that looks fine and answers nothing.
 *
 * They exist because of a measurement (2026-08-15): of the `.pbl-*` classes the stylesheet
 * writes, 98 were rendered by no fixture in any projection. About twenty of those are a
 * DIALOG's — the manual, the state-colours editor, the creation prompt — needing no new
 * data and simply unreachable without a pointer, which is what a knob is for. The gestures
 * are a different problem and stay unreachable: a drag, a link drag, a hover reveal and a
 * selection ring are what a person does, and no URL can stand in for one.
 *
 * `?measure` belongs here for the same reason as the rest: it is a real call into the view
 * (`drawEstimationMeasurements`), and it is worth a test that the call still happens even
 * though jsdom cannot check what it reports — box geometry and computed type, which no
 * fixture or screenshot reaches either.
 */
import { ProductBacklogView } from '../../src/view/backlogView';
import { openManual } from '../../src/ui/manualDialog';
import { manualSections } from '../../src/view/manual/sections';
import { openStateColors } from '../../src/view/interactions/stateColors';
import { EstimationView } from '../../src/view/estimation/estimationView';

const DIALOGS = ['manual', 'colors', 'new'] as const;
type Dialog = (typeof DIALOGS)[number];

/**
 * `?dialog=manual` / `colors` / `new` — open one dialog on top of the mounted view.
 *
 * The manual and the colours editor are opened through the SAME functions their controls
 * call, so what is on screen is the dialog the plugin builds rather than a rebuild of it;
 * the creation prompt has no such door — its content depends on where the click came from
 * — so this presses the toolbar's own button. Which of the two a dialog gets is decided by
 * whether it has a single entry point, never by preference.
 *
 * Nothing here draws the WIDGET: that is `chrome.ts`, over Obsidian's own `modal` element.
 */
export function openWantedDialog(view: ProductBacklogView, containerEl: HTMLElement, search: string): void {
	const asked = new URLSearchParams(search).get('dialog');
	if (!DIALOGS.includes(asked as Dialog)) return;
	if (asked === 'manual') openManual(view.app, manualSections(), 'types');
	else if (asked === 'colors') openStateColors(view);
	else containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.click();
}

/**
 * `?shelf` opens the roadmap's shelf, `?focus=PBI` sets the focus level.
 *
 * Both are UI state the view already stores, and both hide a whole surface behind a
 * control: the shelf draws its groups, their counts, each card's shelving REASON, the sort
 * pick and the type filter only while it is open — the widest thing in the roadmap that a
 * screenshot could not reach — and a focus level re-roots the model, which is the one way
 * a context CARD is drawn at all. Setting them here is the same call the control makes.
 */
export function applyWantedState(view: ProductBacklogView, search: string): void {
	const params = new URLSearchParams(search);
	if (params.has('shelf')) view.setShelfCollapsed(false);
	const focus = params.get('focus');
	if (focus !== null && focus !== '') view.setFocusLevel(focus);
}

/**
 * `?select=<title>` — select a row in the ESTIMATION view by its note's title, the same
 * assignment a click makes (`renderTable.ts`'s `selectRow`) without a pointer to drive
 * it: the one way a screenshot reaches "a row selected, panel on screen" without
 * clicking one. `title` is turned into the fixture's own flat `<title>.md` path, which
 * is the only shape `estimationVault()`'s notes have.
 */
export function applyWantedEstimationSelection(view: EstimationView, search: string): void {
	const title = new URLSearchParams(search).get('select');
	if (!title) return;
	view.selectedPath = `${title}.md`;
	view.render();
}

/**
 * `?measure` — every column's own box and every named element's computed type, into one
 * element a headless `--dump-dom` can read.
 *
 * COMMITTED rather than left in a scratch mock, because it is the only instrument this
 * repository has for two whole classes of defect: jsdom lays nothing out, so
 * `getBoundingClientRect` answers zeros and a column that slides under its own header is
 * invisible to the suite; and jsdom applies no stylesheet, so a computed `font-size` cannot
 * be read there at all. Both shipped once — a 29.8px column slide and five wrong type sizes,
 * three of them rules that had silently stopped matching. Read with:
 *
 *   chrome --headless=new --dump-dom '<page>?measure'
 *
 * It reports and asserts nothing (ADR 0020). `harness.test.ts` checks that it still
 * reports a line per column and per probe — never what the numbers are, which would be the
 * screenshot suite that ADR refuses.
 */
export function drawEstimationMeasurements(view: EstimationView): void {
	const lines: string[] = [];
	const table = view.tableEl;
	const head = table?.querySelector('.pbl-est-head');
	const rows = Array.from(table?.querySelectorAll('.pbl-est-row') ?? []);
	const hosts: Array<[string, Element | null | undefined]> = [['head', head], ...rows.map((r, i) => [`row${i}`, r] as [string, Element])];

	for (const cls of ['pbl-est-title', 'pbl-est-total', 'pbl-est-coverage', 'pbl-est-cell', 'pbl-est-currency']) {
		for (const [name, host] of hosts) {
			const el = host?.querySelector(`.${cls}`);
			if (!(el instanceof HTMLElement)) continue;
			const box = el.getBoundingClientRect();
			lines.push(`BOX ${cls} ${name} left=${box.left.toFixed(1)} right=${box.right.toFixed(1)} w=${box.width.toFixed(1)}`);
		}
	}

	const probes: Array<[string, Element | null | undefined]> = [
		['row title', rows[0]?.querySelector('.pbl-est-title')],
		['row total', rows[0]?.querySelector('.pbl-est-total')],
		['row chip', rows[0]?.querySelector('.pbl-est-chip')],
		['head cell', head?.querySelector('.pbl-est-title')],
		['panel title', view.panelEl?.querySelector('.pbl-est-title')],
		['panel total', view.panelEl?.querySelector('.pbl-est-total')],
		['panel coverage', view.panelEl?.querySelector('.pbl-est-coverage')],
		['panel derived', view.panelEl?.querySelector('.pbl-est-derived')],
		['panel heading', view.panelEl?.querySelector('h4')],
		['dim label', view.panelEl?.querySelector('.pbl-est-dim-label')],
		['rubric', view.panelEl?.querySelector('.pbl-est-rubric')],
		['point button', view.panelEl?.querySelector('button.pbl-est-point')],
		['decomp term', view.panelEl?.querySelector('.pbl-est-decomp span')],
		['toolbar count', view.viewEl.querySelector('.pbl-est-count')],
	];
	for (const [name, el] of probes) {
		if (!(el instanceof HTMLElement)) continue;
		const cs = getComputedStyle(el);
		lines.push(`TYPE ${name} size=${cs.fontSize} weight=${cs.fontWeight} color=${cs.color}`);
	}

	document.getElementById('pbl-measure')?.remove();
	const pre = document.body.createEl('pre', { text: lines.join('\n') });
	pre.id = 'pbl-measure';
}
