import { TFile } from './obsidian-mock';
import { WriteLock } from '../../src/view/writeLock';
import { ReleaseView } from '../../src/view/release/releaseView';
import { installObsidianDom } from './dom';
import { Modal } from './obsidian-mock';
import { FakeVault, FakeViewConfig, mountLeaf } from './vault';
import { flush } from './view';

/** `t.pbl-row[data-path="…"]` — the scope tree's own row, or null when `optional` says a
 *  missing one is the assertion rather than a broken fixture. Reads `view.viewEl` rather
 *  than a `containerEl` the caller would otherwise have to keep threading through: every
 *  scope-tree test already holds the view.
 *
 *  Overloaded rather than always nullable: without `optional` this throws on a miss, so
 *  the caller holds an element and should not have to say so again at every use. */
export function row(view: ReleaseView, path: string): HTMLElement;
export function row(view: ReleaseView, path: string, opts: { optional: true }): HTMLElement | null;
export function row(view: ReleaseView, path: string, opts: { optional?: boolean } = {}): HTMLElement | null {
	const el = view.viewEl.querySelector<HTMLElement>(`.pbl-row[data-path="${path}"]`);
	if (el === null && !opts.optional) throw new Error(`row not found: ${path}`);
	return el;
}

/** The disclosure button on one row — never optional, because every caller of this one
 *  already knows the row has children. */
export function twisty(view: ReleaseView, path: string): HTMLElement {
	const el = row(view, path)?.querySelector<HTMLElement>('.pbl-twisty');
	if (!el) throw new Error(`twisty not found: ${path}`);
	return el;
}

/**
 * Dispatches a keydown at the tree, `scopeKeys.test.ts`'s own way in. Re-queried every
 * call rather than captured once: `toggleReleaseFold` and the ArrowLeft/Right cases redraw the
 * tree, which detaches the element a stale reference would still be pointing at.
 */
export function press(view: ReleaseView, key: string): void {
	const treeEl = view.viewEl.querySelector<HTMLElement>('.pbl-tree');
	if (!treeEl) throw new Error('no scope tree mounted');
	treeEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** The row the roving selection currently marks, by path — or null before anything has
 *  set one, which `scopeKeys.ts`'s own `show()` is the only writer of. */
export function active(view: ReleaseView): string | null {
	return view.viewEl.querySelector<HTMLElement>('.pbl-row[aria-selected="true"]')?.getAttribute('data-path') ?? null;
}

/**
 * Jumps the roving selection to a path directly, without walking the arrow keys there —
 * `scopeKeys.test.ts`'s own setup step for a test whose SUBJECT is a later key, not the
 * walk. Goes through `activeScopeFile` and a render rather than reaching into the
 * controller's closure, which is exactly the restore path a real re-render already takes
 * (a fold, `onDataUpdated`), so this drives the same code a keyboard user's session would.
 *
 * Takes a PATH and resolves it against the vault, so the field holds the same `TFile`
 * object the rows do — the identity the restore matches on. A file made here instead
 * would match nothing and every caller would silently start on row 0.
 */
export function select(view: ReleaseView, path: string): void {
	view.activeScopeFile = view.app.vault.getAbstractFileByPath(path) as TFile;
	view.render();
}

// `releaseSettingsWith`, the `ReleaseSettings`-shaped fixture, lives in the leaf module
// `test/helpers/releaseSettings.ts` and not here: it touches no DOM, and this file calls
// `installObsidianDom()` below, so anything importing it needs jsdom. NOT re-exported
// from here either — an export nobody imports is dead code fallow's `analyze` gate
// refuses, and nothing in this file currently consumes it. Import it from the leaf
// module directly.

installObsidianDom();

export interface ReleaseHarness {
	view: ReleaseView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * `makeEstimationView`'s shape, lock included since 2026-08-29: this view edits the
 * release note it is showing ([[Editing a release from its own screen]]), so it has a gate
 * and a batch like every other writer. A FRESH lock per view, the estimation helper's own
 * choice and its reason — a test that does not care about sharing gets its own, and the
 * two suites that DO care about the shared slot build one and hand it to both views.
 */
export function makeReleaseView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ base, viewName, lock }: { base?: string; viewName?: string; lock?: WriteLock } = {},
): ReleaseHarness {
	const containerEl = mountLeaf(vault, base);
	const view = new ReleaseView({} as never, containerEl, lock ?? new WriteLock());
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	return { view, config, containerEl };
}

/**
 * Every key bound EXCEPT `releaseNotesFolder` — what a fully configured vault looks like,
 * with that one exception held out on purpose (2026-08-30): the folder-bind test
 * (`init.test.ts`'s `sees a folder bind that no property key reflects`) needs a view
 * where every PROPERTY and the other two closing options are bound but the folder is not,
 * so a press still has exactly one thing to do. A test whose own claim is "truly nothing
 * left to bind" spreads this object plus an explicit `releaseNotesFolder`
 * (`mountRelease`'s `notesFolder` override, or the literal inline) rather than reading
 * this fixture as complete on its own. `stateProperty` and `releasedDateProperty` joined
 * this on 2026-08-25, the band's own two options: without them `done` and `released` read
 * as unconfigured on every row, which made a shipped band and a real progress bar both
 * unreachable through this fixture (Task 7's Shipped heading among them). `stateProperty`
 * points at the SAME key `releaseStatusProperty` does — `note.status` — because it names
 * a different note's frontmatter: the release's own status chip reads a release note, and
 * this reads a MEMBER's own workflow state, and vault authors commonly spell both
 * `status`. `doneValues` is left unbound: the default list (`DEFAULT_DONE_VALUES`)
 * already includes `Done`, which is the only done value any fixture in this file writes.
 */
export const RELEASE_CONFIG = {
	typeProperty: 'note.type',
	parentProperty: 'note.parent',
	orderProperty: 'note.order',
	membershipProperty: 'note.release',
	versionProperty: 'note.version',
	targetDateProperty: 'note.target-date',
	releaseStatusProperty: 'note.status',
	stateProperty: 'note.status',
	releasedDateProperty: 'note.released',
	// The two the editing screen needs bound (2026-08-29): a description property to draw
	// and write, and the declared status vocabulary `Set status` unions with what the
	// releases carry. Both are in the FULLY configured fixture for the same reason the two
	// above are — a suite that wants the unbound case clears the key it is about.
	descriptionProperty: 'note.description',
	releaseStatusValues: 'Planned, In progress, Released',
	// The closing actions' own three (2026-08-29) — but only TWO of them here.
	// `releasedStatusValues` is what "is this release already out" is asked against;
	// `releasedTransitionValue` is the single value marking one WRITES, which a list
	// cannot answer; both are bound for the same reason every key above is, and a suite
	// that wants one of them unbound clears the one it is about. `releaseNotesFolder` is
	// the THIRD and is deliberately held OUT of this object — see this const's own
	// docblock above for why.
	releasedStatusValues: 'Released',
	releasedTransitionValue: 'Released',
};

/**
 * The ✨ control's own fixture (`test/view/release/initControl.test.ts`): what mount it
 * needs varies by whether the test wants the INDEX or the `noMembership` scope screen, so
 * this picks the vault rather than taking one — `releaseVault` for the former,
 * `scopeVault` (which carries a release to `pick`) for the latter.
 */
export interface MountReleaseOptions {
	/** Every candidate the ✨ could bind is already bound when true (`RELEASE_CONFIG`)
	 *  EXCEPT `releaseNotesFolder`, which that fixture holds out on purpose (see its own
	 *  docblock) so a `bindAll: true` press still has one thing to do; an untouched config
	 *  (nothing bound but the three model mappings, which resolve to their own defaults)
	 *  when false. */
	bindAll?: boolean;
	/** Overrides `membershipProperty` on top of `bindAll` — `''` CLEARS it, which
	 *  `adoptCandidates` reads as a decision rather than as untouched (see
	 *  `domain/optionalProperties.ts`), distinct from simply never binding it. */
	membership?: string;
	/** A path to `view.pick()` right after mount, landing the scope screen instead of the
	 *  index — the `noMembership` empty state this control's second position draws on only
	 *  exists with a release open. */
	pick?: string;
	/** Overrides `stateProperty` on top of `bindAll` — `''` clears the plan's own state key,
	 *  the scope toolbar's own gate for its hide-done control (`scopeToolbar.test.ts`). */
	stateKey?: string;
	/** Overrides `releaseNotesFolder` on top of `bindAll` — `RELEASE_CONFIG`'s own docblock
	 *  states why that fixture holds this one key out; a test whose claim is "truly
	 *  nothing left to bind" passes it explicitly rather than relying on `RELEASE_CONFIG`
	 *  alone. */
	notesFolder?: string;
}

/** Hand the view a fresh result set, the way Bases does after a vault change —
 *  `test/helpers/view.ts`'s own `refresh`, for the release view's own `data` shape. */
export function refreshRelease(view: ReleaseView, vault: FakeVault): void {
	(view as unknown as Record<string, unknown>).data = { data: vault.entries() };
	view.onDataUpdated();
}

export function mountRelease(opts: MountReleaseOptions = {}): ReleaseHarness & { vault: FakeVault } {
	const { bindAll = true, membership, pick, stateKey, notesFolder } = opts;
	const vault = pick === undefined ? releaseVault() : scopeVault();
	const configValues: Record<string, unknown> = bindAll ? { ...RELEASE_CONFIG } : {};
	if (membership !== undefined) configValues.membershipProperty = membership;
	if (stateKey !== undefined) configValues.stateProperty = stateKey;
	if (notesFolder !== undefined) configValues.releaseNotesFolder = notesFolder;
	const harness = makeReleaseView(vault, configValues);
	if (pick !== undefined) harness.view.pick(pick);
	return { ...harness, vault };
}

/**
 * A base with a type key and no release in it — the screen `releaseView.draw` returns at
 * before `renderIndex` ever runs, and therefore the second entry point onto both
 * `renderNewRelease`'s one creation function and, since 2026-08-28, the standalone ✨.
 * Shared between `newRelease.test.ts` and `initControl.test.ts` rather than a hand-written
 * copy in each — a fixture rewritten twice is the thing `RELEASE_CONFIG`'s own comment
 * warns a rename goes stale against.
 */
export function noReleaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	return vault;
}

/** Three releases: two dated, one not — the index's ordering fixture. */
export function releaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('0.8.md', {
		frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12', status: 'In progress' },
	});
	vault.addFile('0.9.md', {
		frontmatter: { type: 'Release', version: '0.9.0', 'target-date': '2026-10-24', status: 'Planned' },
	});
	vault.addFile('Someday.md', { frontmatter: { type: 'Release', status: 'Idea' } });
	return vault;
}

/**
 * One release, one CONTEXT ancestor and two members beneath it — the shape every depth,
 * level and sibling assertion on the scope screen needs.
 *
 * The Epic is in the base's results and is not a member: that is the only kind of context
 * row a release scope can draw, because `releaseScope` skips an `outsideFilter` ancestor
 * outright rather than keeping it. Two members rather than one so that a position among
 * SIBLINGS is distinguishable from an index in the flat row list — with one member the
 * two agree and the assertion says nothing.
 */
export function scopeVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', {
		frontmatter: { type: 'Release', version: '1.0.0', 'target-date': '2026-09-12', status: 'In progress' },
	});
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('F1.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]' } });
	vault.addFile('F2.md', { frontmatter: { type: 'Feature', parent: 'E', order: 2, release: '[[R]]' } });
	// `[[0.9]]`, and that is the point of them: `releaseScreen` adds `0.9.md` to whatever
	// vault it is given and PICKS it, so without these the default screen was a release with
	// no members — the empty scope `renderScope` returns early from — for every caller that
	// did not pass a vault of its own. Two, one of them done, so the default also has a real
	// rollup and a half-filled bar rather than a strip `drawSummary` withholds.
	//
	// The pair above stays on `[[R]]` rather than moving: `scopeVault()` is used two ways,
	// and the other one (`makeReleaseView` directly, as `releaseNeverEdits.test.ts` does)
	// never adds `0.9` at all — repointing them there leaves a vault whose members name a
	// release that does not exist, which is the one test that failed when this was tried
	// that way (2026-08-30). Each release keeps its own members.
	vault.addFile('M1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[0.9]]' } });
	vault.addFile('M2.md', { frontmatter: { type: 'PBI', order: 2, release: '[[0.9]]', status: 'Done' } });
	addToolbarReleases(vault);
	return vault;
}

/**
 * `scopeToolbar.test.ts`'s own three releases, sharing this vault rather than one apiece —
 * `mountRelease` builds ONE vault per call, so a test that picks a second release needs it
 * already here beside `R.md` above, which every other `scopeVault()` caller still reads
 * unchanged.
 *
 * `Releases/0.8.md` — an ordinary foldable scope: one root with one child, so collapse-all
 * has something to fold and expand-all something to reopen.
 *
 * `Releases/0.7.md` — entirely finished: `Card payments.md` (a member with its own member
 * child, so its row draws a rollup BEFORE hiding — `scopeToolbar.test.ts`'s own "before"
 * assertion needs one) plus eight more standalone done members, ten in total — the exact
 * count `scopeToolbar.test.ts` asserts the all-done state names.
 *
 * `Releases/0.5.md` — `Retention policy.md`, a member that is NOT itself done, holding two
 * children that both are: hide-done must drop the children and leave the parent standing
 * as a leaf, never drop the parent (its own `subtreeDone` is false) and never leave it an
 * expander over nothing.
 */
function addToolbarReleases(vault: FakeVault): void {
	vault.addFile('Releases/0.8.md', { frontmatter: { type: 'Release' } });
	vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', release: '[[Releases/0.8]]', status: 'Doing' } });
	vault.addFile('Task A1.md', {
		frontmatter: { type: 'Task', release: '[[Releases/0.8]]', status: 'Open' },
		parentLink: 'Feature A',
	});

	vault.addFile('Releases/0.7.md', { frontmatter: { type: 'Release' } });
	vault.addFile('Card payments.md', { frontmatter: { type: 'Feature', release: '[[Releases/0.7]]', status: 'Done' } });
	vault.addFile('Refund processing.md', {
		frontmatter: { type: 'Task', release: '[[Releases/0.7]]', status: 'Done' },
		parentLink: 'Card payments',
	});
	for (let i = 1; i <= 8; i++) {
		vault.addFile(`Extra ${i}.md`, { frontmatter: { type: 'Task', release: '[[Releases/0.7]]', status: 'Done' } });
	}

	vault.addFile('Releases/0.5.md', { frontmatter: { type: 'Release' } });
	vault.addFile('Retention policy.md', {
		frontmatter: { type: 'Feature', release: '[[Releases/0.5]]', status: 'Doing' },
	});
	vault.addFile('Policy review.md', {
		frontmatter: { type: 'Task', release: '[[Releases/0.5]]', status: 'Done' },
		parentLink: 'Retention policy',
	});
	vault.addFile('Policy audit.md', {
		frontmatter: { type: 'Task', release: '[[Releases/0.5]]', status: 'Done' },
		parentLink: 'Retention policy',
	});
}

/**
 * Two releases and two context Epics — `scopeTree.test.ts`'s own fixture, the fold set's
 * own shape rather than `scopeVault()`'s single-release one: one Epic (Passwordless
 * sign-in) holds two LEAVES in one release, for the disclosure and the leaf-placeholder
 * tests; the other (Sign-up flow) holds a different child PER release, so it is drawn as
 * context in BOTH — the one shape that can tell a fold scoped to its release apart from a
 * bare-path one.
 */
function foldVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Releases/0.8.md', {
		frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12', status: 'In progress' },
	});
	vault.addFile('Releases/0.9.md', { frontmatter: { type: 'Release', version: '0.9.0' } });
	// A MEMBER with member children — unlike `Sign-up flow` below, which stays context — so
	// its own row draws a rollup (`context: false`) over what is BELOW it rather than never
	// drawing one at all.
	vault.addFile('Passwordless sign-in.md', { frontmatter: { type: 'Epic', release: '[[Releases/0.8]]' } });
	// `parentLink`, not a bare `parent` string: these children need a REAL frontmatter
	// link so `vault.renameFile`'s own rewrite (test 2) carries them with their parent
	// rather than orphaning them — the fake's own documented distinction
	// (`test/CLAUDE.md`), and the one this fixture exists to exercise.
	vault.addFile('Send the magic link.md', {
		frontmatter: { type: 'Task', order: 1, release: '[[Releases/0.8]]' },
		parentLink: 'Passwordless sign-in',
	});
	vault.addFile('Expire the link.md', {
		frontmatter: { type: 'Task', order: 2, release: '[[Releases/0.8]]' },
		parentLink: 'Passwordless sign-in',
	});
	vault.addFile('Sign-up flow.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('Verify the email.md', {
		frontmatter: { type: 'Task', order: 1, release: '[[Releases/0.8]]' },
		parentLink: 'Sign-up flow',
	});
	vault.addFile('Choose a password.md', {
		frontmatter: { type: 'Task', order: 1, release: '[[Releases/0.9]]' },
		parentLink: 'Sign-up flow',
	});
	return vault;
}

/**
 * `foldVault()` mounted with an IDENTITY — a `.base` leaf, so `resolveViewIdentity`
 * resolves and a fold routes through `loadViewState`/`saveViewState` rather than the
 * session-only fallback — unless `embedded` says otherwise, `restorePick`'s own asymmetry
 * for the pick applied to the fold set instead.
 */
export function mountFoldScope(opts: { pick: string; embedded?: boolean }): ReleaseHarness & { vault: FakeVault } {
	const vault = foldVault();
	const harness = makeReleaseView(vault, RELEASE_CONFIG, opts.embedded ? {} : { base: 'Releases.base' });
	harness.view.pick(opts.pick);
	return { ...harness, vault };
}

/**
 * A mounted release SCOPE screen, with the release's own frontmatter and any config
 * overrides the test is about. The one entry point both closing suites use — and the
 * reason it takes the vault rather than building one is that what a closing action does
 * depends on who the MEMBERS are, which is the vault's question and not this release's.
 */
export function releaseScreen(
	release: Record<string, unknown>,
	vault: FakeVault = scopeVault(),
	over: Record<string, unknown> = {},
	{ embedded = false }: { embedded?: boolean } = {},
): ReleaseHarness & { vault: FakeVault; lock: WriteLock } {
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', version: '0.9.0', ...release } });
	const lock = new WriteLock();
	// A REAL `.base` leaf unless the test is about an embedded one. This defaulted to
	// embedded until 2026-08-29 and nothing noticed, because nothing asked
	// `resolveViewIdentity` anything — so every generation test was quietly running on the
	// one mount where the release notes now refuse to write at all.
	const harness = makeReleaseView(vault, { ...RELEASE_CONFIG, ...over }, {
		lock,
		...(embedded ? {} : { base: 'Releases.base' }),
	});
	harness.view.pick('0.9.md');
	return { ...harness, vault, lock };
}

/** One control by selector — never optional, because every caller already asserted it is
 *  there or is asserting that it is not. */
export function button(view: ReleaseView, selector: string): HTMLButtonElement {
	const el = view.viewEl.querySelector<HTMLButtonElement>(selector);
	if (!el) throw new Error(`control not found: ${selector}`);
	return el;
}


/**
 * A release whose members span TWO workflows — one ordinary PBI unfinished, one
 * `Deliverable` finished by its OWN workflow. The fixture that tells `ownWorkflowReading`
 * apart from `item.done`: a single-workflow vault passes against either.
 */
export function twoWorkflowVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Unfinished PBI.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', status: 'Doing' } });
	vault.addFile('Done design.md', { frontmatter: { type: 'Deliverable', release: '[[0.9]]', docStatus: 'Published' } });
	return vault;
}

/** A base with no members naming the release at all — the screen `renderScope` returns
 *  early from, and the ONLY place extension 1a can be exercised. */
export function emptyReleaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Elsewhere.md', { frontmatter: { type: 'PBI' } });
	return vault;
}

/** Press the confirm dialog's CTA and let the write settle. The dialog is mounted by the
 *  Modal mock rather than into the view, so it is reached through `Modal.lastOpened`
 *  rather than queried off `view.viewEl`. */
export async function confirmDialog(): Promise<void> {
	Modal.lastOpened?.contentEl.querySelector<HTMLElement>('.mod-cta')?.click();
	await flush();
}
