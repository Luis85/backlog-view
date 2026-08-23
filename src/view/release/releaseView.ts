import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogModel, buildModel } from '../../domain/model';
import { ReleaseSettings, resolveReleaseSettings } from '../../domain/releaseOptions';
import { releaseIndex, releaseScope } from '../../domain/releases';
import { resolveSettings } from '../../domain/settingsResolve';
import { loadViewState, saveViewState } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';
import { guidanceShell } from '../render/emptyStates';
import { drawUnresolved, renderIndex } from './renderIndex';
import { renderScope } from './renderScope';

export const RELEASE_VIEW_TYPE = 'product-release';

/**
 * The release view: the plugin's third Bases view, and the first that WRITES NOTHING.
 *
 * There is no `WriteGate` and no `WriteLock` here, and their absence is the design rather
 * than an omission. The lock exists to serialize writers (ADR 0030); a view with no writer
 * has nothing to serialize, and holding one would suggest otherwise. Every write rule the
 * register states — the `configProblems` gate, the context-row refusal, capture before the
 * await — is about a batch this view never plans.
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

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-rel-view' });
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
	 */
	private restorePick(): void {
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (!id) return;
		this.pickedPath = loadViewState(this.app, id).prefs.release ?? null;
	}

	render(): void {
		this.viewEl.empty();
		// The three model mappings are this view's own (`releaseOptions.ts`). Without a type
		// key nothing can be recognised as a release at all, so this is a configuration to
		// fix — a different answer from a base that simply holds no release yet.
		if (!this.settings.typeKey) {
			guidanceShell(this.viewEl, 'settings-2', t('release.empty.noType.title'), t('release.empty.noType.hint'));
			return;
		}
		// The model is built with THIS view's three mappings, not the backlog resolver's.
		// `resolveSettings` reads them through `propKey`, which cannot tell a cleared option
		// from an unset one — so a parent property this view reports as unbound would come
		// back as `parent` here, and the scope would go on nesting rows by a mapping the
		// options screen says is off. Two resolvers disagreeing at the model boundary is
		// the same defect as one view reading another's configuration.
		this.model = buildModel(this.app, this.data.data, {
			...resolveSettings(this.config),
			typeKey: this.settings.typeKey,
			parentKey: this.settings.parentKey,
			orderKey: this.settings.orderKey,
		});
		// Derived BEFORE the no-releases branch, and that order is the whole of the fix for a
		// silent drop this view shipped with. A base with work items naming releases it does not
		// hold is the case where EVERY membership value is unresolved — there is nothing for any
		// of them to resolve to — so returning first reported the maximum-information state as
		// "no releases" and hid all of it. [[Setting an item's release]] 1f is what rules on
		// that: an unresolvable membership is reported, never dropped in silence.
		const index = releaseIndex(this.app, this.model, this.settings);
		if (this.model.releases.length === 0) {
			// No create button ON THIS VIEW: no use case in this epic specifies creating a
			// release, and an empty state must not promise a write nothing defines. The
			// backlog toolbar's New menu does offer `New Release` — deliberately, the way it
			// offers `New Milestone` — and that is a different view's existing writer.
			guidanceShell(this.viewEl, 'package', t('release.empty.noReleases.title'), t('release.empty.noReleases.hint'));
			drawUnresolved(this.viewEl, index);
			return;
		}
		const scope = this.pickedPath === null ? null : releaseScope(this.app, this.model, this.settings, this.pickedPath);
		// A remembered release that no longer exists returns the INDEX, silently. A working
		// position that has gone is not a failure and must not raise one.
		if (scope === null || scope.release === null) {
			renderIndex(this, index);
			return;
		}
		// The release is passed alongside the scope it came from: the check above is what
		// rules on it, and `renderScope` repeating it would be an unreachable branch.
		renderScope(this, scope, scope.release);
	}
}
