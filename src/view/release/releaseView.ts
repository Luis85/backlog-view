import { BasesView, Notice, QueryController, TFile } from 'obsidian';
import { PropertyWrite } from '../../domain/estimationWritePlan';
import { applyPropertyWrites } from '../../storage/propertyWrite';
import { WriteGate } from '../writeGate';
import { WriteLock } from '../writeLock';
import { t } from '../../i18n/t';
import { BacklogModel, buildModel } from '../../domain/model';
import { ReleaseSettings, resolveReleaseSettings } from '../../domain/releaseOptions';
import { releaseIndex, releaseScope } from '../../domain/releases';
import { todayCivil } from '../../domain/noteFields';
import { resolveSettings } from '../../domain/settingsResolve';
import { membershipCollision, releaseNoteProblems } from '../../domain/settingsConsistency';
import { reconfiguredKey, ReleaseWrite } from '../../domain/releaseWritePlan';
import { loadViewState, updateViewPrefs } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';
import { guidanceShell } from '../render/emptyStates';
import { OpenContext, OpenController } from '../openTarget';
import { RELEASE_SUGGESTED_KEYS, RELEASE_SUGGESTED_VALUES } from './init';
import { renderReleaseInit } from './initControl';
import { renderNewRelease } from './newRelease';
import { drawUnresolved, renderIndex } from './renderIndex';
import { renderScope } from './renderScope';

export const RELEASE_VIEW_TYPE = 'product-release';

/**
 * The classes a redraw's own controls carry — the fixed vocabulary {@link ReleaseView.render}
 * restores a lost focus through, in place of a bespoke restore per control. Three separate
 * fixes for the same class of bug shipped on this branch before this list did: the ✨
 * (`initControl.ts`), the scope tree's own row (`activeRowFile`/`treeHadFocus`, left
 * alone below — a different question, which ROW, not answered here), and the toolbar
 * (`scopeToolbar.ts`). None of the eight controls that carry one of these classes carries a
 * second, so checking them in this order is deterministic without needing to be.
 *
 * **`pbl-rel-new` and `pbl-rel-band` joined this list for the same reason and pay off
 * differently, which is worth knowing before reading either as broken.** `pbl-rel-new` gets
 * an EXACT match on most redraws — `New release` survives a bind, a metadata refresh, and
 * (per `focusNewRelease`'s own doc) most redraws after a creation — so `render()`'s exact
 * branch below is what puts focus back on it, the same as any other control here. `pbl-rel-band`
 * never does: activating a band changes SCREEN (index → scope), so no band exists once this
 * render finishes and the exact-match query always misses. What adding it buys is narrower —
 * `focusedControlClass()` stops answering null for a focused band, which is what lets this
 * method's own FALLBACK fire (the redrawn screen's first focusable control — the scope's Back
 * button) instead of leaving a reader on `document.body`. Landing beside the right control,
 * not on it, is still the whole of the fix: the alternative was never restoring anything.
 */
const FOCUS_HANDLE_CLASSES = [
	'pbl-rel-init',
	'pbl-rel-collapse',
	'pbl-rel-expand',
	'pbl-rel-hidedone',
	'pbl-rel-back',
	'pbl-tree',
	'pbl-rel-new',
	'pbl-rel-band',
	// The scope header's own three, added 2026-08-29 (Codex, PR #211, which caught the
	// first of them). Each is a real tab stop that this header draws exactly one of, so the
	// exact-match branch below finds it with no `data-path` to disambiguate — and each is
	// detached by a redraw the reader did not ask for: a Bases metadata refresh redraws the
	// same scope screen, and without a handle here focus fell to the body. The two write
	// controls make that sharper than the open control does: pressing one CAUSES the redraw
	// that detaches it, so a keyboard reader would pay for every status they set.
	'pbl-rel-open',
	'pbl-rel-status',
	'pbl-rel-desc',
	'pbl-rel-released',
	// The two closing actions, added with `releaseClose.ts`. Both are the sharp case this
	// list's header describes rather than the mild one: pressing either CAUSES the redraw
	// that detaches it, so without a handle a keyboard reader pays a lost place for every
	// release they close or write up. `pbl-rel-notes` is registered here with its sibling
	// even though the button that carries it arrives with `Generate release notes`: the
	// list is one vocabulary, and registering one and leaving the other is exactly the
	// defect it exists to stop.
	'pbl-rel-close',
	'pbl-rel-notes',
];

/**
 * The release view: the plugin's third Bases view, and the one that **creates release
 * notes and its own config, and edits the RELEASE NOTE it is showing and nothing else.**
 *
 * Read that claim as narrowly as it is written; it has now been narrowed twice. It was
 * `WRITES NOTHING` until 2026-08-24, when `New release` retired the wider sentence, and
 * `never edits a note that already exists` until 2026-08-29, when
 * [[Editing a release from its own screen]] asked for the status and the description to be
 * settable from the release's own screen. What is refused now is everything else: no MEMBER
 * is ever written to — a member is work, and the backlog view is where work is edited —
 * and `applyWrites` and `applyRestores`, the ITEM-batch entry points, are still never
 * called from `src/view/release/`. `test/view/releaseNeverEdits.test.ts` states what the
 * screens' ordinary gestures still do not do; `test/view/release/releaseEdits.test.ts`
 * drives the two that now write and asserts the batch names the release note alone.
 *
 * **So there is a `WriteGate` here now, and it is the plugin's own one lock behind it.**
 * The gate's absence used to be the design — a create is not a batch, so there was nothing
 * to serialize and no inverse to take back. An edit is a batch: it captures an inverse
 * (`applyPropertyWrites`, through `captureInverse`), so it belongs in the same undo slot
 * and the same serialization as every other view's write (ADR 0030). What follows is worth
 * knowing before reading the undo story as broken: this view draws no undo control of its
 * own, so a status set here is taken back from the BACKLOG view's undo button — which is
 * what "the undo slot is the vault's last batch, whichever view wrote it" means, rather
 * than a gap. The create path is unchanged and still installs nothing: a created note is
 * not undoable.
 *
 * Its entry point is the INDEX, not one release: with nothing picked it lists every
 * release the results hold, and picking a row opens that release's screen. Which release
 * is open is view state, per device and per saved view.
 */
export class ReleaseView extends BasesView {
	type = RELEASE_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: ReleaseSettings;
	/** The open release's path, or null for the index. Restored on mount, saved on every pick. */
	pickedPath: string | null = null;
	model: BacklogModel | null = null;
	/** Which screen the LAST render drew — see {@link draw}. */
	private drawnKey: string | null = null;
	/** Where a row's click opens its note — the estimation view's own `opener`
	 *  (`estimationView.ts`), reused for the identical reason: a click on a scope row is
	 *  ordinary navigation, never a write. */
	readonly opener = new OpenController();
	/** The scope tree's own roving selection, carried across a render — see
	 *  `scopeKeys.ts`'s own comment on why the redraw a fold triggers must not drop it.
	 *
	 *  The FILE, never its path. Obsidian mutates the one `TFile` in place on a rename, so
	 *  the identity survives what a captured path cannot: renaming the active member, or a
	 *  folder above it, left this naming a path the refreshed rows no longer hold and
	 *  dropped the keyboard back to the first row. Same rule `storage/CLAUDE.md` states for
	 *  a captured dependency — a captured thing holds a FILE, never a name — and it needs
	 *  no rename subscription of its own to keep. A note deleted and recreated at the same
	 *  path is deliberately NOT a match: that is a different file, and the row the reader
	 *  was on is genuinely not there. */
	activeRowFile: TFile | null = null;
	/** Whether the SCOPE TREE — never the index list, never a button — held focus just
	 *  before the current render's `empty()` detached it. Captured in `render()`, below,
	 *  beside `previousTop` and for the identical reason: a detached element answers
	 *  nothing, so this has to be read before the teardown rather than after it. */
	treeHadFocus = false;

	/**
	 * The gate every edit passes, over the plugin-wide lock this view is handed. There is
	 * no default for the lock, `registerEstimationView`'s own rule: a silent per-view
	 * fallback is exactly the bug a shared lock exists to prevent — one view serializing
	 * and undoing against nobody.
	 *
	 * `writeProblems` is `releaseNoteProblems` (`domain/settingsConsistency.ts`) — the
	 * collision `createRelease` already refuses, asked of the EDIT path too. It answered
	 * nothing until review found the hole (PR #211): with the status and the type on one
	 * key, picking a status rewrote `type: Release` to `type: Planned` and the release
	 * vanished from its own view, because the creator's guard is at the creator and an edit
	 * never passes it. ✨ cannot produce that state and a property picker can, which is why
	 * the guard belongs at the write rather than at the action.
	 *
	 * It is over the RELEASE-NOTE keys alone, so the sharing this view is built around —
	 * the release's own status and an item's workflow state on one property — stays legal.
	 * The other refusal a write here can meet is the planner's: an unconfigured key is
	 * dropped before a batch exists.
	 *
	 * `outsideFilter` asks the MODEL for the ITEM and reads its own flag — never
	 * `byPath.has(path)`, which was this predicate until review found the hole (PR #211).
	 * `byPath` holds context rows too: a work item with a hand-written `parent: [[R]]` pulls
	 * the release it names into the model through `loadOutsideParents`, which is not
	 * type-gated (`BacklogModel.releases`' own comment records that a release can be seated
	 * in the tree that way). So a release the Base EXCLUDED could be in the map, and `has`
	 * authorized an edit to it — the one thing the root guide's context-row rule says this
	 * plugin never does. It answers true before the first model too, which refuses a write
	 * nothing can have asked for yet.
	 */
	readonly gate: WriteGate<PropertyWrite>;

	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-rel-view' });
		// Nothing to render until Bases delivers the first result set — say what is
		// happening instead of showing an empty pane (the other two views' own rule).
		// `render` empties this element before it draws, so the first data update clears it.
		this.viewEl.setText(t('release.loading'));
		// `config`/`data`/`app` are not assigned until after construction (Obsidian's
		// contract), so the initial settings come from a config that answers "nothing is
		// set" rather than from `this.config` — the estimation view's own shape.
		this.settings = resolveReleaseSettings({ get: () => undefined, getAsPropertyId: () => null } as never);
		this.gate = new WriteGate<PropertyWrite>(
			{
				app: () => this.app,
				writeProblems: () => releaseNoteProblems(this.settings),
				outsideFilter: (path) => this.model?.byPath.get(path)?.outsideFilter !== false,
			},
			{ syncBusy: () => this.syncBusy(), flushDataUpdate: () => this.onDataUpdated() },
			lock,
			// The type key is read at WRITE time rather than captured with the gate, the
			// estimation view's own reason: the `.base` can be re-pointed at another property
			// while this view is open, and the writer's refusal has to ask the key the user
			// means now.
			(writes, onProgress, onInverse) => applyPropertyWrites(this.app, writes, this.settings.typeKey, onProgress, onInverse),
		);
	}

	/**
	 * Both existing Bases views detach their own element on unload, and this one has as
	 * much reason to: `viewEl` is a child appended to a container Bases owns and reuses, so
	 * a saved Base switching away from this view — or its leaf closing — would otherwise
	 * leave the old shell, and every row listener on it, attached under the next view.
	 *
	 * No gate to dispose and no observers to disconnect, unlike the other two: this view
	 * holds neither.
	 */
	onunload(): void {
		this.gate.dispose();
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		// A batch write touches one file at a time and each comes back as its own update;
		// deferring the rebuild until the batch settles is the contract every view's gate
		// keeps. This view's batches are one note today, so the deferral saves one redraw
		// rather than hundreds — it is here because the gate's flush is what redraws AFTER a
		// write, and a view that did not defer would draw the half-applied state first.
		if (this.gate.deferUpdate()) return;
		this.settings = resolveReleaseSettings(this.config);
		this.restorePick();
		this.render();
	}

	/**
	 * What this view publishes while a batch is in flight: `aria-busy` on the pane, and —
	 * since the closing actions — the actions themselves disabled.
	 *
	 * The premise this method used to state was that this view has no persistent write
	 * control: its writers opened a menu and a dialog, both gone from the screen before
	 * their batch ran. `releaseClose.ts` is what made that false. A press during a SIBLING
	 * view's batch is the case that matters — `onDataUpdated` defers the model rebuild
	 * while the lock is held, so the press would act on a stale model.
	 *
	 * It asks the LOCK (`gate.writing`) rather than this view's own progress, the rule ADR
	 * 0030 states: a batch is a fact about the vault, so a sibling view says so too.
	 */
	private syncBusy(): void {
		this.viewEl.toggleAttribute('aria-busy', this.gate.writing);
		for (const el of this.viewEl.querySelectorAll<HTMLButtonElement>('.pbl-rel-actions button')) {
			el.disabled = this.gate.writing;
		}
	}

	/**
	 * The one place an edit to the release note is applied — every input that changes a
	 * release's own field lands here, which is the root guide's "one move, N inputs" read
	 * for this view: the status menu, its Clear entry and the description dialog all hand
	 * this a planned batch rather than each calling the gate beside its own plan.
	 *
	 * The redraw is skipped when the batch's own deferred update already drew this state
	 * (`WriteGate.flushedLastBatch`) — the estimation view's `applyPlan`, and its reason:
	 * two full rebuilds of one screen for one write.
	 */
	async applyRelease(writes: ReleaseWrite[]): Promise<void> {
		// **The key was captured; the CONFIGURATION was not.** Every control here plans with
		// the key it was drawn with (the root guide's capture-before-the-await), and the gate
		// re-reads `releaseNoteProblems` off the settings as they are NOW — so a collision
		// present when a dialog opened and fixed while it was open lets a batch through
		// carrying the key that collision was about, which can be the type key (found by
		// review, PR #211). Asked of the batch rather than of the settings, because what is
		// wrong is the batch, and asked per ROLE rather than of the three keys together,
		// because two options SWAPPED leave every captured key still editable while each
		// names the other field: `reconfiguredKey` states it and its reasons.
		// **An empty batch is not a change, so it is not a redraw either.** `applySafely`
		// returns on `writes.length === 0` before it touches the lock — no undo slot, no
		// write — and `flushedLastBatch` therefore stays false, so the line below rebuilt the
		// model and the whole scope tree for a pick that wrote nothing (found by review, PR
		// #211). Two comments already promised otherwise and neither had a check under it:
		// `domain/releaseWritePlan.ts`'s header ("no refresh is triggered") and `save`'s in
		// `releaseEdits.ts`, whose refocus is a no-op precisely BECAUSE the element it looks
		// for was never detached.
		if (writes.length === 0) return;
		const foreign = reconfiguredKey(this.settings, writes);
		if (foreign !== null) {
			new Notice(t('gate.releaseReconfigured', { property: foreign }));
			return;
		}
		await this.gate.applySafely(writes);
		if (!this.gate.flushedLastBatch) this.onDataUpdated();
	}

	/** What `opener` needs of this view — one object built here rather than at every call
	 *  site, so a scope row's click, its middle click and the keyboard's Enter cannot each
	 *  spell the same three fields slightly differently. */
	openContext(): OpenContext {
		return { app: this.app, viewEl: this.viewEl, settings: { openIn: this.settings.openIn } };
	}

	/**
	 * Picking a row, or the back control's null. Persists, then redraws.
	 *
	 * **Clears `activeRowFile`.** A pick is a change of SCREEN — the scroll restore
	 * already treats it as a reset (see `render`'s own comment) — and without this a
	 * context ancestor selected in release A stayed the keyboard's starting row in release
	 * B, whenever the same path happened to sit in B's scope too: `scopeKeys.ts`'s restore
	 * matches on path alone, with no idea which release picked it last. `onDataUpdated`
	 * (a redraw of the SAME scope — a Bases refresh, an external edit, a rename) never
	 * calls this, so the active row survives exactly the redraws it should.
	 */
	pick(path: string | null): void {
		this.pickedPath = path;
		this.activeRowFile = null;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) updateViewPrefs(this.app, id, { release: path ?? undefined });
		this.render();
	}

	/**
	 * Restore the pick from the store — and LEAVE THE FIELD ALONE when there is no identity
	 * to restore from.
	 *
	 * `resolveViewIdentity` returns null for an embedded Base on purpose, which means the
	 * pick is session-only there rather than absent. Assigning `null` in that branch would
	 * reset it on every `onDataUpdated`, so any Bases refresh would throw a reader who had
	 * opened a release straight back to the index. The estimation view's own session-only
	 * sort pick keeps the field for exactly this reason.
	 *
	 * **A rename is carried in one of those two cases and not the other, and the difference
	 * follows from that same identity.** Where the base is a `.base` file, the pick is a
	 * stored `prefs.release`, and both walks reach it: `renamePathPrefs`
	 * (`storage/viewStateStore.ts`, wired at the plugin in `main.ts`) migrates the persisted
	 * entry, and `renameScoped` (`view/viewState.ts`) the loaded BACKLOG view's in-memory
	 * copy, whose flush writes `prefs` back wholesale and would otherwise put the stale path
	 * straight back. THIS view keeps no such copy: {@link restorePick} re-reads the store on
	 * every data update, so the migrated value is what it finds.
	 * Where the base is EMBEDDED there is no persisted entry for either walk to migrate, so
	 * renaming the picked release — or any folder above it — leaves `pickedPath` naming a
	 * path the vault no longer has, and the next data update draws the index instead. That
	 * is the accepted cost of a value that is deliberately session-only: it is gone on
	 * reload either way, and the index is one press from every release. Nothing checks this
	 * behaviour; it is stated here because the code cannot show a walk that does not reach.
	 */
	private restorePick(): void {
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (!id) return;
		this.pickedPath = loadViewState(this.app, id).prefs.release ?? null;
	}

	/**
	 * Redraw, keeping the reader's place where the SAME screen is being drawn again.
	 *
	 * The capture is BEFORE the teardown, and that order is the whole of why it is read
	 * here rather than beside the restore: `empty()` detaches the scroller, a detached
	 * element has no layout box, and `scrollTop` on one answers 0 in a browser however far
	 * the reader had scrolled. `estimationView.render` states the same rule for the same
	 * reason, and jsdom cannot see the difference — it answers with whatever was last
	 * assigned, connected or not — so the ORDER is what a test can check here and the
	 * restored NUMBER is owed a live vault.
	 *
	 * **One saved offset, and it is keyed by the screen that produced it.** The two screens
	 * scroll different elements over different content — `.pbl-rel-list` on the index,
	 * `.pbl-tree` on one release — so a single value carried across a change of screen
	 * would drop a reader into the middle of a tree because they had scrolled the list,
	 * which is worse than the top. That makes the DATA UPDATE the event that restores (the
	 * same screen, redrawn under a Bases refresh, an external status edit, a rename) and the
	 * PICK the event that does not: `pick` changes the key, so it starts at the top, in both
	 * directions. `restoreBox` (`view/render/projections.ts`) keys its bands the same way and
	 * for the same reason.
	 *
	 * Going back to the index therefore starts at the top too, because the scope's own
	 * render overwrote the one slot. That is today's behaviour rather than a regression, and
	 * a map keyed per screen is what would change it — not built, because nothing asks for
	 * it.
	 */
	render(): void {
		const previousEl = this.scrollerEl();
		const previousTop = previousEl?.scrollTop ?? 0;
		const previousKey = this.drawnKey;
		// Captured before `empty()` for `previousTop`'s own reason: a detached element
		// answers nothing. `previousEl` already narrows to `.pbl-tree` or `.pbl-rel-list`,
		// so this only has to ask whether it was THIS render's tree specifically.
		//
		// `contains`, not `===`: a MOUSE press on a per-row control inside the tree (the
		// disclosure) focuses that button, and the redraw this render is performing is
		// about to detach it. Focus was inside the composite widget, so it belongs back on
		// the composite widget — `wireScopeKeys` puts it on the row `activeRowFile`
		// names. An element contains itself, so the keyboard case (focus ON the tree) is
		// unchanged.
		this.treeHadFocus = previousEl !== null && previousEl.classList.contains('pbl-tree') && previousEl.contains(document.activeElement);
		// Read for the identical reason, one line up: which control (if any) held focus,
		// named by the one class in `FOCUS_HANDLE_CLASSES` it carries — and, where the
		// control says which note it is about, that path beside it.
		const focusHandle = this.focusedHandle();
		this.viewEl.empty();
		this.drawnKey = this.draw();
		const el = this.scrollerEl();
		// Clamped to the FRESH `scrollHeight` so a redraw with fewer rows — a note that left
		// the base's results, a release whose members shrank — cannot park the pane below its
		// own last row. `renderTable.ts` clamps its own restore for the same case.
		if (el !== null && this.drawnKey === previousKey) el.scrollTop = Math.min(previousTop, el.scrollHeight);
		// Re-queried rather than kept as an element reference: `empty()` already detached the
		// original. The exact handle comes back first — a reader who pressed a control should
		// land on that same control again, not near it — but a screen that replaced it (binding
		// `membershipProperty` on the `noMembership` state draws the scope instead, with no
		// `.pbl-rel-init` of its own) has no honest exact match, and the press that did that was
		// a SUCCESS: it removed its own control on purpose. Stopping there would strand a
		// keyboard user on `document.body` to pay for a press that worked, so the fallback is the
		// redrawn screen's own first focusable control — `New release`, Back, the tree — over
		// inventing one that means nothing.
		if (focusHandle !== null) {
			// Every OTHER handle class names one element on its screen; `pbl-rel-band` names
			// one per release, so a bare `querySelector` handed focus to the FIRST band
			// whichever one the reader was on — a routine metadata refresh silently moved
			// them to the top of the list. Matched on `data-path` where the control carries
			// one, which is the same "identify the thing, not its position" the roving row
			// restore makes one file over. Falls back to the first match for a screen that
			// redrew without the note (a release whose row left the results), since landing
			// on a band is closer than landing on the body.
			const all = Array.from(this.viewEl.querySelectorAll<HTMLElement>(`.${focusHandle.cls}`));
			const named = focusHandle.path === null ? undefined : all.find((el) => el.dataset.path === focusHandle.path);
			(named ?? all[0] ?? this.viewEl.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
		}
	}

	/** The one class in {@link FOCUS_HANDLE_CLASSES} the currently focused element carries —
	 *  with its `data-path` where it has one, since a class alone does not identify a
	 *  control there is one of per release — or null when focus is outside this view or on
	 *  something the redraw does not track —
	 *  a per-row control, say. `treeHadFocus` (above) is what covers that case now: a
	 *  MOUSE press on a per-row control inside the tree, `.pbl-twisty`, focuses the twisty
	 *  itself, this method returns null for it (twisty is not in `FOCUS_HANDLE_CLASSES`),
	 *  and `treeHadFocus`'s `contains` check catches it instead — the tree is the focus
	 *  TARGET a composite widget hands focus back to, never the button, which is exactly
	 *  why the twisty is deliberately not added to `FOCUS_HANDLE_CLASSES` here. */
	private focusedHandle(): { cls: string; path: string | null } | null {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || !this.viewEl.contains(active)) return null;
		const cls = FOCUS_HANDLE_CLASSES.find((name) => active.classList.contains(name));
		return cls === undefined ? null : { cls, path: active.dataset.path ?? null };
	}

	/**
	 * The element that scrolls on whichever screen is drawn, or null for an empty state,
	 * which has none.
	 *
	 * A query rather than a field the two render modules assign: it runs once per render
	 * over the two candidates, both of them within a couple of nodes of `viewEl`, so it is
	 * nothing like the per-row `treeEl` scan the cost rule bans — and the alternative is a
	 * public field written from two other files for one caller's benefit.
	 */
	private scrollerEl(): HTMLElement | null {
		return this.viewEl.querySelector<HTMLElement>('.pbl-rel-list, .pbl-tree');
	}

	/**
	 * Draw whichever screen the state asks for, and answer WHICH one that was — the open
	 * release's path, or null for the index and for every empty state.
	 *
	 * Not `pickedPath`: by the time `pick` re-renders, that field already holds the screen
	 * being drawn rather than the one being left, so comparing it would restore across
	 * exactly the change of screen this exists to refuse. A remembered release that has gone
	 * is the second reason — it draws the index while `pickedPath` still names the note.
	 */
	private draw(): string | null {
		// The three model mappings are this view's own (`releaseOptions.ts`). Without a type
		// key nothing can be recognised as a release at all, so this is a configuration to
		// fix — a different answer from a base that simply holds no release yet.
		if (!this.settings.typeKey) {
			guidanceShell(this.viewEl, 'settings-2', t('release.empty.noType.title'), t('release.empty.noType.hint'));
			return null;
		}
		// The model is built with THIS view's three mappings, not the backlog resolver's.
		// `resolveSettings` reads them through `propKey`, which cannot tell a cleared option
		// from an unset one — so a parent property this view reports as unbound would come
		// back as `parent` here, and the scope would go on nesting rows by a mapping the
		// options screen says is off. Two resolvers disagreeing at the model boundary is
		// the same defect as one view reading another's configuration.
		const backlogSettings = {
			...resolveSettings(this.config),
			typeKey: this.settings.typeKey,
			parentKey: this.settings.parentKey,
			orderKey: this.settings.orderKey,
			// A FOURTH mapping, and the only one nothing on this screen READS: the scope
			// tree's `New <child>` seeds the new note's membership, and the key it seeds is
			// this view's own `membershipKey` rather than whatever the backlog resolver
			// makes of this config. [[Putting work in a release]] states that rule — the
			// offering view names the membership key it writes, and the two views may
			// legitimately be pointed at different properties.
			releaseKey: this.settings.membershipKey,
		};
		this.model = buildModel(this.app, this.data.data, backlogSettings);
		// Derived BEFORE the no-releases branch, and that order is the whole of the fix for a
		// silent drop this view shipped with. A base with work items naming releases it does not
		// hold is the case where EVERY membership value is unresolved — there is nothing for any
		// of them to resolve to — so returning first reported the maximum-information state as
		// "no releases" and hid all of it. [[The scope of a release as a tree]] 1b is what rules
		// on that: such an item is reported among the unresolved "rather than silently dropped".
		const index = releaseIndex(this.app, this.model, this.settings, {
			stateKey: backlogSettings.stateKey,
			deliverableStateKey: backlogSettings.deliverableStateKey,
			today: todayCivil(),
		});
		if (this.model.releases.length === 0) {
			// The SECOND entry point onto `renderNewRelease`'s one creation function — this
			// branch returns before `renderIndex` ever runs, so the index's own control never
			// reaches the screen a first release would be made from. It is offered here and
			// not on the `noType` state above for the reason that state exists: `createRelease`
			// refuses without a type key, and `runReleaseInit` deliberately binds no type
			// property, so a press there could only ever fail.
			const empty = guidanceShell(
				this.viewEl,
				'package',
				t('release.empty.noReleases.title'),
				t('release.empty.noReleases.hint'),
			);
			// The bar's own ✨ never reaches this screen either, for the identical reason: it is
			// `renderIndex` that draws it, and this branch returns before that runs. A base with
			// zero releases is the FIRST-USE case that most needs every binding, so `fixes`
			// is every option BOTH `RELEASE_SUGGESTED_KEYS` and `RELEASE_SUGGESTED_VALUES` name
			// (the seven properties and, since 2026-08-30, the folder, the vocabulary and the
			// transition) rather than the one name the `noMembership` screen passes
			// (`renderScope.ts`) — that screen is about ONE property and narrows on purpose;
			// this one has nothing bound yet and nothing to narrow to. Derived rather than
			// copied, so a further candidate is covered by being declared there and not by a
			// second list here going stale beside it — which is why this says "further" and not
			// the ordinal it said until 2026-08-29.
			renderReleaseInit(this, empty, 'empty', [
				...RELEASE_SUGGESTED_KEYS.map((candidate) => candidate.option),
				...RELEASE_SUGGESTED_VALUES.map((candidate) => candidate.option),
			]);
			renderNewRelease(this, empty);
			drawUnresolved(this.viewEl, index, membershipCollision(this.settings, backlogSettings));
			return null;
		}
		const scope = this.pickedPath === null ? null : releaseScope(this.app, this.model, this.settings, index, this.pickedPath);
		// A remembered release that no longer exists returns the INDEX, silently. A working
		// position that has gone is not a failure and must not raise one.
		if (scope === null || scope.release === null) {
			renderIndex(this, index, backlogSettings);
			return null;
		}
		// The release is passed alongside the scope it came from: the check above is what
		// rules on it, and `renderScope` repeating it would be an unreachable branch.
		// `backlogSettings` rides along too, for the summary strip's provenance tooltip
		// (`renderScope.ts`'s own comment on why it takes this rather than re-resolving).
		renderScope(this, scope, scope.release, backlogSettings, index);
		return scope.release.path;
	}
}
