import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogModel, buildModel } from '../../domain/model';
import { ReleaseSettings, resolveReleaseSettings } from '../../domain/releaseOptions';
import { releaseIndex, releaseScope } from '../../domain/releases';
import { todayCivil } from '../../domain/noteFields';
import { resolveSettings } from '../../domain/settingsResolve';
import { loadViewState, saveViewState } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';
import { guidanceShell } from '../render/emptyStates';
import { OpenController } from '../openTarget';
import { RELEASE_SUGGESTED_KEYS } from './init';
import { renderReleaseInit } from './initControl';
import { renderNewRelease } from './newRelease';
import { drawUnresolved, renderIndex } from './renderIndex';
import { renderScope } from './renderScope';

export const RELEASE_VIEW_TYPE = 'product-release';

/**
 * The release view: the plugin's third Bases view, and the one that **creates notes and
 * its own config, and never edits a note that already exists.**
 *
 * Read that claim as narrowly as it is written — it was `WRITES NOTHING` until 2026-08-24,
 * and `New release` is what retired the wider sentence. What stays refused is the EDIT
 * path: `applyWrites`, `applyRestores` and `applyPropertyWrites` are never called from
 * `src/view/release/`, which `test/view/releaseNeverEdits.test.ts` asserts on the calls
 * themselves rather than by driving the screens somebody thought of.
 *
 * There is still no `WriteGate` and no `WriteLock` here, and their absence is the design
 * rather than an omission. The lock exists to serialize writers (ADR 0030) and a create is
 * not a batch: it plans nothing, captures no inverse, and so has neither an undo slot to
 * share nor anything to serialize against. Every write rule the register states — the
 * `configProblems` gate, the context-row refusal, capture before the await — is about a
 * batch this view never plans. The accepted cost is the one every `New` in this plugin
 * carries: a created note is not undoable.
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

	constructor(controller: QueryController, containerEl: HTMLElement) {
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
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		this.settings = resolveReleaseSettings(this.config);
		this.restorePick();
		this.render();
	}

	/** Picking a row, or the back control's null. Persists, then redraws. */
	pick(path: string | null): void {
		this.pickedPath = path;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) {
			const state = loadViewState(this.app, id);
			saveViewState(this.app, id, { ...state, prefs: { ...state.prefs, release: path ?? undefined } });
		}
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
		this.viewEl.empty();
		this.drawnKey = this.draw();
		const el = this.scrollerEl();
		// Clamped to the FRESH `scrollHeight` so a redraw with fewer rows — a note that left
		// the base's results, a release whose members shrank — cannot park the pane below its
		// own last row. `renderTable.ts` clamps its own restore for the same case.
		if (el !== null && this.drawnKey === previousKey) el.scrollTop = Math.min(previousTop, el.scrollHeight);
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
			// zero releases is the FIRST-USE case that most needs all four bindings, so `fixes`
			// is every option `RELEASE_SUGGESTED_KEYS` names rather than the one name the
			// `noMembership` screen passes (`renderScope.ts`) — that screen is about ONE property
			// and narrows on purpose; this one has nothing bound yet and nothing to narrow to.
			// Derived rather than copied, so a fifth candidate is covered by being declared there
			// and not by a second list here going stale beside it.
			renderReleaseInit(this, empty, 'empty', RELEASE_SUGGESTED_KEYS.map((candidate) => candidate.option));
			renderNewRelease(this, empty);
			drawUnresolved(this.viewEl, index);
			return null;
		}
		const scope = this.pickedPath === null ? null : releaseScope(this.app, this.model, this.settings, index, this.pickedPath);
		// A remembered release that no longer exists returns the INDEX, silently. A working
		// position that has gone is not a failure and must not raise one.
		if (scope === null || scope.release === null) {
			renderIndex(this, index);
			return null;
		}
		// The release is passed alongside the scope it came from: the check above is what
		// rules on it, and `renderScope` repeating it would be an unreachable branch.
		renderScope(this, scope, scope.release);
		return scope.release.path;
	}
}
