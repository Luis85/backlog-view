import { ReleaseView } from '../../src/view/release/releaseView';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf } from './vault';

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
