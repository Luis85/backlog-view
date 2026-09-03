import { BasesView, QueryController, TFile } from 'obsidian';
import { WriteGate } from '../writeGate';
import { WriteLock } from '../writeLock';
import { t } from '../../i18n/t';
import { BacklogModel, buildModel } from '../../domain/model';
import { MyWorkSettings, resolveMyWorkSettings } from '../../domain/myWorkOptions';
import { pickedResource } from '../../domain/assignedWork';
import { resolveSettings } from '../../domain/settingsResolve';
import { configProblems } from '../../domain/settingsConsistency';
import { BacklogSettings, defaultSettings } from '../../domain/settings';
import { ItemWrite } from '../../domain/writePlan';
import { applyWrites } from '../../storage/frontmatter';
import { loadViewState, updateViewPrefs } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';
import { guidanceShell } from '../render/emptyStates';
import { OpenContext, OpenController } from '../openTarget';
import type { TreeDraw } from '../scopeKeys';
import { drawMyWorkTree } from './renderTree';
import { drawMyWorkToolbar } from './toolbar';

export const MY_WORK_VIEW_TYPE = 'product-my-work';

/**
 * The classes a redraw's own controls carry — `ReleaseView.render()`'s own
 * `FOCUS_HANDLE_CLASSES` mechanism (`view/release/releaseView.ts`), over this view's own
 * vocabulary. `pbl-mw-tree` (Task 6) and Task 8's own four toolbar controls — the
 * person picker and the collapse-all/expand-all/hide-done trio (`toolbar.ts`) — are what
 * this view draws today. `ReleaseView`'s own list grew the same way, one control at a
 * time, and three separate fixes for a lost focus shipped on that branch before the list
 * did.
 *
 * No `data-path` tiebreak, unlike `ReleaseView`'s: nothing this view draws repeats one
 * handle class per item (there is one tree, one picker, one of each toolbar button), so a
 * bare class is already a unique answer.
 */
const FOCUS_HANDLE_CLASSES = ['pbl-mw-tree', 'pbl-mw-person', 'pbl-mw-collapse', 'pbl-mw-expand', 'pbl-mw-hidedone'];

export class MyWorkView extends BasesView {
	type = MY_WORK_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: MyWorkSettings;
	model: BacklogModel | null = null;
	pickedPerson: string | null = null;

	/** Whose tree the last `render()` actually drew — the subject the remembered scroll
	 *  offset belongs to. `pickedPerson` cannot answer that: `pick()` writes it before the
	 *  render that redraws for it, so at capture time it already names the NEW person. */
	private drawnPerson: string | null = null;
	planSettings: BacklogSettings = defaultSettings();
	activeRowFile: TFile | null = null;
	treeHadFocus = false;
	/** The last draw's own row index, kept so `syncOpenRow` can mark a row without
	 *  querying the tree — `TREE_SCAN`'s own ban, and the reason `wireScopeKeys` takes
	 *  this index rather than building one. Null in every state that draws no tree. */
	private treeDraw: TreeDraw | null = null;
	private watchedApp = false;
	readonly opener = new OpenController();
	readonly gate: WriteGate<ItemWrite>;

	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock) {
		super(controller);
		// `tabindex: '-1'` makes the ROOT itself a programmatic focus target — never a real
		// tab stop, only `restoreFocus`'s own last resort (fix round 1, finding 2): a redraw
		// into the "no assignee"/"no roster" guidance states draws no toolbar at all (`draw()`
		// returns before `drawMyWorkToolbar` runs), so a config change reached from a focused
		// control there has no button to land on, and an element removed from the document
		// resets focus to `document.body` unless something else claims it first.
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-mw-view', attr: { tabindex: '-1' } });
		this.viewEl.setText(t('mywork.loading'));
		this.settings = resolveMyWorkSettings({ get: () => undefined, getAsPropertyId: () => null } as never);
		this.gate = new WriteGate<ItemWrite>(
			{
				app: () => this.app,
				writeProblems: () => configProblems(this.planSettings),
				outsideFilter: (path) => this.model?.byPath.get(path)?.outsideFilter !== false,
			},
			{ syncBusy: () => this.syncBusy(), flushDataUpdate: () => this.refresh() },
			lock,
			(writes, onProgress, onInverse) => applyWrites(this.app, this.planSettings, writes, onProgress, onInverse),
		);
	}

	onunload(): void {
		this.gate.dispose();
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		this.watchApp();
		if (this.gate.deferUpdate()) return;
		this.refresh();
	}

	refresh(): void {
		this.settings = resolveMyWorkSettings(this.config);
		this.restorePick();
		this.render();
	}

	/**
	 * What this view subscribes to on the APP, wired on the first data update rather
	 * than in the constructor — `backlogView.ts`'s own `watchApp` and its reason: a Bases
	 * view is handed its `app` afterwards, so there is nothing to subscribe to yet when it
	 * is built. `registerEvent` takes it off with the view.
	 *
	 * `file-open` is the only one this view needs. A note opened from a link, the graph or
	 * another pane changes which row is the one the reader is looking at, and NOTHING else
	 * tells this view that: opening a note is not a data update, so no render follows one.
	 */
	private watchApp(): void {
		if (this.watchedApp) return;
		this.watchedApp = true;
		this.registerEvent(this.app.workspace.on('file-open', () => this.syncOpenRow()));
	}

	/**
	 * Mark the row whose note the workspace has open, through the last draw's own index.
	 *
	 * A class of its own, never `.pbl-selected`: the selection is the row the KEYBOARD is
	 * on, and this is the note the WORKSPACE has open. Reusing the selection would move a
	 * reader's cursor because a note opened somewhere else, and `wireScopeKeys` would then
	 * be reading a selection it did not set.
	 *
	 * Called from the listener AND from the end of `render()`, because a redraw builds
	 * fresh elements that carry no class of ours.
	 */
	private syncOpenRow(): void {
		const openPath = this.app.workspace.getActiveFile()?.path ?? null;
		for (const [path, el] of this.treeDraw?.rowEls ?? []) el.toggleClass('pbl-mw-open', path === openPath);
	}

	openContext(): OpenContext {
		return { app: this.app, viewEl: this.viewEl, settings: { openIn: this.settings.openIn } };
	}

	pick(path: string | null): void {
		this.pickedPerson = path;
		this.activeRowFile = null;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) updateViewPrefs(this.app, id, { person: path ?? undefined });
		this.render();
	}

	private restorePick(): void {
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (!id) return;
		this.pickedPerson = loadViewState(this.app, id).prefs.person ?? null;
	}

	/**
	 * Redraw. Two things are read before `empty()` detaches them, for the identical
	 * reason `ReleaseView.render()` states: a detached element answers nothing.
	 *
	 * `treeHadFocus` is consumed downstream, by `wireScopeKeys` (`view/scopeKeys.ts`, Task
	 * 7's shared mechanism — the way `ReleaseView.treeHadFocus` is consumed there too,
	 * rather than by either view's own `render()`) — it answers "was focus somewhere
	 * INSIDE the tree", which only that module can act on once it knows which row to
	 * restore it to.
	 *
	 * `focusedHandle()` is this render's own to answer, because it is a different
	 * question: "did focus sit on one of THIS view's own controls" — a toolbar button, or
	 * the tree root itself with nothing focused inside it yet. Without restoring it here,
	 * a keyboard user who changes the person or activates a toolbar control is dropped
	 * onto `document.body` on every redraw, because nothing else in this class ever reads
	 * `focusedHandle()`'s answer (PR #234, correction 1).
	 *
	 * **The restore happens ONCE, after `draw()` returns, never inside it** — fix round 1
	 * on PR #234's own finding: the brief's shape called `this.restoreFocus(focusHandle)`
	 * at all four of `draw`'s exits, which is the defect correction 1 fixed made
	 * reappearable by anyone adding a fifth exit (`noWork`, `allDone`) who forgets the
	 * call — nothing would fail. `ReleaseView.render()` does not have this shape either:
	 * it captures, empties, calls `this.draw()`, and restores once. Structuring it the same
	 * way here means a state `draw()` adds later needs no reminder to restore focus, because
	 * it never had the choice not to.
	 */
	render(): void {
		const treeEl = this.viewEl.querySelector('.pbl-mw-tree');
		this.treeHadFocus = treeEl?.contains(document.activeElement) === true;
		// Read beside the focus, and for the same reason: `empty()` is about to detach the
		// scroller. `.pbl-tree` IS the scroll container (`styles/tree.css` — `overflow-y:
		// auto`), so unlike `ReleaseView` this view needs no separate `scrollerEl()`.
		//
		// Without this, a state write's own refresh — and every ordinary Bases update —
		// jumps a scrolled reader back to the top. `wireScopeKeys` hides it from the
		// KEYBOARD, which scrolls its row back into view; a pointer user has no such row.
		//
		// **An offset belongs to the PERSON it was scrolled in, which is why this needs
		// `drawnPerson` and the element's own presence is not enough** (PR #234, review):
		// `pick()` sets `pickedPerson` and then renders, so a switch reaches here with the
		// old tree still mounted and the new person already picked. Carrying that offset
		// over opened the next person halfway down an unrelated tree, with their highest
		// ranked work above the fold — the one thing this view exists to put in front of
		// them. `ReleaseView` keeps `drawnKey` for exactly this question; the tree element
		// answers "same screen", never "same subject".
		const previousTop = this.drawnPerson === this.pickedPerson ? (treeEl?.scrollTop ?? 0) : 0;
		const focusHandle = this.focusedHandle();
		this.viewEl.empty();
		this.treeDraw = null;
		this.draw();
		this.drawnPerson = this.pickedPerson;
		const drawnEl = this.viewEl.querySelector('.pbl-mw-tree');
		// Clamped to the FRESH `scrollHeight`, `releaseView.ts`'s own rule: a redraw with
		// fewer rows — an item reassigned away, hide-done switched on — must not park the
		// pane below its own last row.
		if (drawnEl !== null) drawnEl.scrollTop = Math.min(previousTop, drawnEl.scrollHeight);
		this.restoreFocus(focusHandle);
		this.syncOpenRow();
	}

	/** Draw whichever state applies, over the current `settings`/`data` — the four
	 *  screens `render()` used to restore focus after individually. Returning at each
	 *  early exit is still how a screen picks itself; only the focus restore moved out,
	 *  to the one place `render()` runs it. */
	private draw(): void {
		if (!this.settings.assigneeKey) {
			// A property nothing is bound to is a configuration to fix, and a DIFFERENT
			// answer from a base that simply holds no roster yet.
			//
			// **Cleared before this early return** (PR #234, correction 2): every later Bases
			// update takes this same branch for as long as the property stays unbound, so
			// without this the stale pair from the last CONFIGURED render never clears. A row
			// menu opened before the property was cleared could then still write through it —
			// the gate's `outsideFilter` asks `this.model?.byPath`, and a stale model reports
			// the write's target as still in-filter. `model = null` makes `outsideFilter`
			// answer true for every path (nothing to look up), which is what makes the gate
			// refuse the whole batch; `planSettings` is reset alongside it so nothing here
			// keeps holding this view's own writable mappings once the model they describe is
			// gone.
			this.model = null;
			this.planSettings = defaultSettings();
			guidanceShell(this.viewEl, 'settings-2', t('mywork.empty.noAssignee.title'), t('mywork.empty.noAssignee.hint'));
			return;
		}
		// The model is built with THIS view's own mappings layered onto the backlog
		// resolver's — `resolveSettings` reads through `propKey`, which cannot tell a
		// cleared option from an unset one, so a property this view reports as unbound
		// would come back as the default and the tree would nest by a mapping the options
		// screen says is off. Two resolvers disagreeing at the model boundary is the same
		// defect as one view reading another's configuration.
		this.planSettings = {
			...resolveSettings(this.config),
			typeKey: this.settings.typeKey,
			parentKey: this.settings.parentKey,
			orderKey: this.settings.orderKey,
			assigneeKey: this.settings.assigneeKey,
			stateKey: this.settings.stateKey,
			doneValues: this.settings.doneValues,
			// Task 3b's four new fields (`deliverableStateKey`/`deliverableDoneValues`/
			// `testStateKey`/`testDoneValues`) need NO override here, unlike the six above:
			// `resolveMyWorkSettings` resolves them with `resolveSecondaryWorkflow` over
			// the SAME option keys, the SAME `fallback: defaultSettings()`, and plain
			// `propKey` (no clearable distinction to protect, since these four ship no real
			// default to begin with) — so `resolveSettings(this.config)` above already
			// computes the identical answer. Overriding them anyway was reviewed off this
			// list: it added untested scope for no behavioural difference.
		};
		this.model = buildModel(this.app, this.data.data, this.planSettings);
		if (this.model.resources.length === 0) {
			guidanceShell(this.viewEl, 'users', t('mywork.empty.noRoster.title'), t('mywork.empty.noRoster.hint'));
			return;
		}
		// The picker is drawn in every state that HAS a roster, including the one below:
		// the way out of "nobody picked" is the control itself.
		drawMyWorkToolbar(this, this.viewEl);
		// Asked of `resources`, never of `byPath`: a `Resource` note is kept on the roster
		// and produces no `BacklogItem`, so a picked person's path is never a key in
		// `byPath` and that guard would send every valid pick to the no-pick state.
		if (this.pickedPerson === null || !pickedResource(this.model, this.pickedPerson)) {
			const shellEl = guidanceShell(
				this.viewEl,
				'user-round-search',
				t('mywork.empty.noPick.title'),
				t('mywork.empty.noPick.hint'),
			);
			this.drawSoloPress(shellEl);
			return;
		}
		this.treeDraw = drawMyWorkTree(this, this.viewEl);
	}

	/**
	 * A roster of ONE has one answer, and this is the press that gives it — appended to
	 * the no-pick guidance rather than drawn instead of it, so the picker above stays the
	 * way to a different answer.
	 *
	 * **Never an auto-pick**, and that is the decision rather than the lazy half of one:
	 * `pick(null)` stores nothing, so "never picked" and "deliberately cleared" are the
	 * same stored state. An auto-pick would undo a clear on the next data update, and
	 * telling the two apart costs a second stored value — the shape ADR 0011 already
	 * charges for. One press buys the same "one person, no ceremony" with no new state.
	 */
	private drawSoloPress(shellEl: HTMLElement): void {
		const roster = this.model?.resources ?? [];
		if (roster.length !== 1) return;
		const only = roster[0];
		const btn = shellEl.createEl('button', {
			cls: 'mod-cta pbl-mw-solo',
			text: t('mywork.empty.noPick.cta', { name: only.title }),
		});
		btn.addEventListener('click', () => this.pick(only.file.path));
	}

	/**
	 * Restore focus onto whichever control in {@link FOCUS_HANDLE_CLASSES} held it before
	 * this render's `empty()` detached it — the exact match first, the redrawn screen's
	 * first `button` when the exact control is gone (a toolbar control that a config change
	 * removed, `ReleaseView.render()`'s own fallback and its reason: a keyboard user should
	 * not pay for a redraw that removed the very control they acted on), and — third, fix
	 * round 1's own addition — the view root itself when the redraw drew no button at all,
	 * which the "no assignee"/"no roster" guidance states still can: `draw()` returns
	 * before `drawMyWorkToolbar` runs for either, so there is no button anywhere on
	 * screen to fall back to.
	 */
	private restoreFocus(handle: string | null): void {
		if (handle === null) return;
		const match = this.viewEl.querySelector<HTMLElement>(`.${handle}`);
		// Third resort: the view root itself (see its own `tabindex` comment above), for the
		// redraw this task's own fifth exit made reachable — a data update that empties the
		// tree while it holds focus, landing on a screen with no button on it yet.
		const fallback = match ?? this.viewEl.querySelector<HTMLElement>('button') ?? this.viewEl;
		fallback.focus({ preventScroll: true });
	}

	/** The one class in {@link FOCUS_HANDLE_CLASSES} the currently focused element carries,
	 *  or null when focus is outside this view or on something the redraw does not track
	 *  (a per-row control, once Task 6 draws rows — `treeHadFocus`'s `contains` check is
	 *  what covers that case, the same split `ReleaseView.focusedHandle` states). */
	private focusedHandle(): string | null {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || !this.viewEl.contains(active)) return null;
		return FOCUS_HANDLE_CLASSES.find((name) => active.classList.contains(name)) ?? null;
	}

	/**
	 * Publish the gate's progress the way `ReleaseView.syncBusy` does for the identical
	 * reason (ADR 0030): `aria-busy` on the whole pane, asked of the LOCK rather than
	 * this view's own gate — a sibling view's batch changes the very notes this tree
	 * reads, and `onDataUpdated` already defers this view's own model rebuild while it
	 * runs. No per-control disabling to go with it, unlike `ReleaseView`'s or the
	 * estimation view's own `syncBusy`: every control this toolbar draws today touches
	 * only view state (a pick, a fold, the hide-done flag), never a note, so none of them
	 * has anything to be refused for — Task 9's own write control is what will give this
	 * a second half.
	 */
	private syncBusy(): void {
		this.viewEl.toggleAttribute('aria-busy', this.gate.writing);
	}
}
