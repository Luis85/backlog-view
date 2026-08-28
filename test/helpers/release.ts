import { ReleaseView } from '../../src/view/release/releaseView';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf } from './vault';

/** `t.pbl-row[data-path="…"]` — the scope tree's own row, or null when `optional` says a
 *  missing one is the assertion rather than a broken fixture. Reads `view.viewEl` rather
 *  than a `containerEl` the caller would otherwise have to keep threading through: every
 *  scope-tree test already holds the view. */
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
 * call rather than captured once: `toggleFold` and the ArrowLeft/Right cases redraw the
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
 * walk. Goes through `activeScopePath` and a render rather than reaching into the
 * controller's closure, which is exactly the restore path a real re-render already takes
 * (a fold, `onDataUpdated`), so this drives the same code a keyboard user's session would.
 */
export function select(view: ReleaseView, path: string): void {
	view.activeScopePath = path;
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
 * `makeEstimationView`'s shape minus the `WriteLock`: this view creates notes and its own
 * config but plans no BATCH — see `registerReleaseView`'s own comment — so there is
 * nothing for a lock to serialize and no undo slot to share. A lock parameter here would
 * suggest otherwise.
 */
export function makeReleaseView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ base, viewName }: { base?: string; viewName?: string } = {},
): ReleaseHarness {
	const containerEl = mountLeaf(vault, base);
	const view = new ReleaseView({} as never, containerEl);
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
 * Every key bound — what a fully configured vault looks like. `stateProperty` and
 * `releasedDateProperty` joined this on 2026-08-25, the band's own two options: without
 * them `done` and `released` read as unconfigured on every row, which made a shipped band
 * and a real progress bar both unreachable through this fixture (Task 7's Shipped
 * heading among them). `stateProperty` points at the SAME key `releaseStatusProperty`
 * does — `note.status` — because it names a different note's frontmatter: the release's
 * own status chip reads a release note, and this reads a MEMBER's own workflow state, and
 * vault authors commonly spell both `status`. `doneValues` is left unbound: the default
 * list (`DEFAULT_DONE_VALUES`) already includes `Done`, which is the only done value any
 * fixture in this file writes.
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
};

/**
 * The ✨ control's own fixture (`test/view/release/initControl.test.ts`): what mount it
 * needs varies by whether the test wants the INDEX or the `noMembership` scope screen, so
 * this picks the vault rather than taking one — `releaseVault` for the former,
 * `scopeVault` (which carries a release to `pick`) for the latter.
 */
export interface MountReleaseOptions {
	/** Every candidate the ✨ could bind is already bound when true (`RELEASE_CONFIG`); an
	 *  untouched config (nothing bound but the three model mappings, which resolve to their
	 *  own defaults) when false. */
	bindAll?: boolean;
	/** Overrides `membershipProperty` on top of `bindAll` — `''` CLEARS it, which
	 *  `adoptCandidates` reads as a decision rather than as untouched (see
	 *  `domain/optionalProperties.ts`), distinct from simply never binding it. */
	membership?: string;
	/** A path to `view.pick()` right after mount, landing the scope screen instead of the
	 *  index — the `noMembership` empty state this control's second position draws on only
	 *  exists with a release open. */
	pick?: string;
}

/** Hand the view a fresh result set, the way Bases does after a vault change —
 *  `test/helpers/view.ts`'s own `refresh`, for the release view's own `data` shape. */
export function refreshRelease(view: ReleaseView, vault: FakeVault): void {
	(view as unknown as Record<string, unknown>).data = { data: vault.entries() };
	view.onDataUpdated();
}

export function mountRelease(opts: MountReleaseOptions = {}): ReleaseHarness & { vault: FakeVault } {
	const { bindAll = true, membership, pick } = opts;
	const vault = pick === undefined ? releaseVault() : scopeVault();
	const configValues: Record<string, unknown> = bindAll ? { ...RELEASE_CONFIG } : {};
	if (membership !== undefined) configValues.membershipProperty = membership;
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
	return vault;
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
