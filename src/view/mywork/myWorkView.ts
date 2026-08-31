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
import { loadViewState, saveViewState } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';
import { guidanceShell } from '../render/emptyStates';
import { OpenContext, OpenController } from '../openTarget';

export const MY_WORK_VIEW_TYPE = 'product-my-work';

/**
 * The classes a redraw's own controls carry — `ReleaseView.render()`'s own
 * `FOCUS_HANDLE_CLASSES` mechanism (`view/release/releaseView.ts`), over this view's own
 * vocabulary. `pbl-mw-tree` is the only entry today: the toolbar is a stub until Task 8, so
 * nothing else this view draws yet carries a class of its own. Task 6 and Task 8 append
 * their own controls' classes here as they land — `ReleaseView`'s own list grew the same
 * way, one control at a time, and three separate fixes for a lost focus shipped on that
 * branch before the list did.
 *
 * No `data-path` tiebreak, unlike `ReleaseView`'s: nothing this view draws repeats one
 * handle class per item (there is one tree, one picker, one of each toolbar button), so a
 * bare class is already a unique answer.
 */
const FOCUS_HANDLE_CLASSES = ['pbl-mw-tree'];

export class MyWorkView extends BasesView {
	type = MY_WORK_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: MyWorkSettings;
	model: BacklogModel | null = null;
	pickedPerson: string | null = null;
	planSettings: BacklogSettings = defaultSettings();
	activeRowFile: TFile | null = null;
	treeHadFocus = false;
	readonly opener = new OpenController();
	readonly gate: WriteGate<ItemWrite>;

	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-mw-view' });
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
		if (this.gate.deferUpdate()) return;
		this.refresh();
	}

	refresh(): void {
		this.settings = resolveMyWorkSettings(this.config);
		this.restorePick();
		this.render();
	}

	openContext(): OpenContext {
		return { app: this.app, viewEl: this.viewEl, settings: { openIn: this.settings.openIn } };
	}

	pick(path: string | null): void {
		this.pickedPerson = path;
		this.activeRowFile = null;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) {
			const state = loadViewState(this.app, id);
			saveViewState(this.app, id, { ...state, prefs: { ...state.prefs, person: path ?? undefined } });
		}
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
	 * `treeHadFocus` is consumed downstream, by whichever module wires the tree's own
	 * roving keyboard (Task 7's `scopeKeys.ts`-shared mechanism, the way
	 * `ReleaseView.scopeHadFocus` is consumed by `scopeKeys.ts` rather than by `render()`
	 * itself) — it answers "was focus somewhere INSIDE the tree", which only that module
	 * can act on once it knows which row to restore it to.
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
		this.treeHadFocus = this.viewEl.querySelector('.pbl-mw-tree')?.contains(document.activeElement) === true;
		const focusHandle = this.focusedHandle();
		this.viewEl.empty();
		this.draw();
		this.restoreFocus(focusHandle);
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
			// Task 3b: the tree's own membership predicate (`assignedWork.ts`) admits
			// Deliverables and test-catalog rows, whose done-ness `ownWorkflowReading`
			// (`board.ts`) reads through THESE two fields rather than `stateKey` above — so
			// they join the override for the identical reason the six above already are:
			// this view's own resolver is where a cleared/unbound distinction on these
			// options is decided, and the model must see that answer rather than whatever a
			// second resolver over the same config happens to compute.
			deliverableStateKey: this.settings.deliverableStateKey,
			deliverableDoneValues: this.settings.deliverableDoneValues,
			testStateKey: this.settings.testStateKey,
			testDoneValues: this.settings.testDoneValues,
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
			guidanceShell(this.viewEl, 'user-round-search', t('mywork.empty.noPick.title'), t('mywork.empty.noPick.hint'));
			return;
		}
		drawMyWorkTree(this, this.viewEl);
	}

	/**
	 * Restore focus onto whichever control in {@link FOCUS_HANDLE_CLASSES} held it before
	 * this render's `empty()` detached it — the exact match first, and the redrawn
	 * screen's first `button` when the exact control is gone (a toolbar control that a
	 * config change removed, `ReleaseView.render()`'s own fallback and its reason: a
	 * keyboard user should not pay for a redraw that removed the very control they acted
	 * on).
	 */
	private restoreFocus(handle: string | null): void {
		if (handle === null) return;
		const match = this.viewEl.querySelector<HTMLElement>(`.${handle}`);
		(match ?? this.viewEl.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
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

	private syncBusy(): void {
		// Nothing to publish yet — Task 8 gives the toolbar its indicator.
	}
}

function drawMyWorkToolbar(_view: MyWorkView, _parentEl: HTMLElement): void {
	// Task 8 draws the person picker, collapse-all, expand-all and hide-done here.
}

function drawMyWorkTree(_view: MyWorkView, parentEl: HTMLElement): void {
	// Task 6 draws the rows here — a bare, focusable container for now, carrying BOTH the
	// shared `pbl-tree` class every scope tree in this plugin draws (`backlogView.ts`'s own
	// root, `scopeTree.ts`'s release scope) and this view's own `pbl-mw-tree` handle. Both,
	// not either: `shell.test.ts`'s "no tree when unbound" case asserts `.pbl-tree` is
	// absent, which is only a real assertion about THIS view if a drawn tree actually
	// carries it — a stub with `pbl-mw-tree` alone left that assertion unable to fail
	// (fix round 1, PR #234) — and `pbl-mw-tree` is what this task's own focus-restore
	// mechanism above answers about, since it is this view's own handle rather than the
	// class every tree shares.
	parentEl.createDiv({ cls: 'pbl-tree pbl-mw-tree', attr: { tabindex: '0' } });
}
