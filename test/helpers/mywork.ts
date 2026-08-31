import { BasesEntry } from 'obsidian';
import { WriteLock } from '../../src/view/writeLock';
import { MyWorkView } from '../../src/view/mywork/myWorkView';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf } from './vault';

installObsidianDom();

export interface MyWorkHarness {
	view: MyWorkView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

export interface MyWorkVaultOptions {
	/** Whether the base returns any `Resource` notes at all — false is the "no roster"
	 *  empty state (`resolveMyWorkSettings`' own default assignee key still resolves; it is
	 *  the ROSTER that is missing, not the mapping). */
	resources?: boolean;
}

/**
 * Paths a `myWorkVault()` excludes from the base's own results — the fixture's own
 * `outsideFilter` context ancestor, read by {@link makeMyWorkView} when it assembles
 * `data.data`. The SAME shape `test/view/contextRowWrites.test.ts`'s own `mixedView()`
 * uses — filtering `vault.entries()` at the mount site — kept per vault here rather than
 * repeated at every call, since every later task's test reads this one fixture and would
 * otherwise have to restate the filter itself.
 */
const OUTSIDE_FILTER_PATHS = new WeakMap<FakeVault, string[]>();

function baseResults(vault: FakeVault): BasesEntry[] {
	const excluded = new Set(OUTSIDE_FILTER_PATHS.get(vault) ?? []);
	return vault.entries().filter((e) => !excluded.has(e.file.path));
}

/**
 * An Epic, a Feature, two PBIs assigned to two different people, a third assigned to
 * nobody, one `outsideFilter` context ancestor and two `Resource` notes — one of whom
 * carries nothing beyond its type.
 *
 * The context ancestor is `Hidden Feature.md`: excluded from the base's own results (see
 * {@link OUTSIDE_FILTER_PATHS}), sitting between `Epic.md` and `PBI Hidden.md` — the
 * shape `domain/assignedWork.test.ts`'s own "never makes an excluded item a member" case
 * uses, so a member below an excluded ancestor is still drawn with the next INCLUDED
 * ancestor as its context row (`domain/scopeRows.ts`'s skip-through rule).
 */
export function myWorkVault(opts: MyWorkVaultOptions = {}): FakeVault {
	const { resources = true } = opts;
	const vault = new FakeVault();
	if (resources) {
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		// Carries nothing beyond its type — the roster's own minimal case.
		vault.addFile('People/Bo.md', { frontmatter: { type: 'Resource' } });
	}
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 1 }, parentLink: 'Epic' });
	vault.addFile('PBI Ada.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada' }, parentLink: 'Feature' });
	vault.addFile('PBI Bo.md', { frontmatter: { type: 'PBI', order: 2, assignee: 'Bo' }, parentLink: 'Feature' });
	vault.addFile('PBI Nobody.md', { frontmatter: { type: 'PBI', order: 3 }, parentLink: 'Feature' });
	vault.addFile('Hidden Feature.md', { frontmatter: { type: 'Feature', order: 2 }, parentLink: 'Epic' });
	vault.addFile('PBI Hidden.md', {
		frontmatter: { type: 'PBI', order: 1, assignee: 'Ada' },
		parentLink: 'Hidden Feature',
	});
	OUTSIDE_FILTER_PATHS.set(vault, ['Hidden Feature.md']);
	return vault;
}

/**
 * Mounts the view through `mountLeaf` — `test/helpers/release.ts`'s `makeReleaseView`
 * shape exactly, lock included: this view plans writes and has a gate like every other
 * writer. `opts.embedded` mounts with no `.base` leaf, the shape `resolveViewIdentity`
 * reads as "no identity" on purpose.
 *
 * This file deliberately does NOT carry every accessor `test/helpers/release.ts` has —
 * `press`, `active`, `pickPerson`, `menuOn`, `choose`, `labels`, `treeEl` and a
 * re-exported `flush` were all drafted for Tasks 7 through 11 before this task's own
 * commit and every one of them was flagged dead by `npm run analyze` (`unused-exports`):
 * fallow's dead-code check counts a test file's import the same as production code's, so
 * a helper nothing yet imports is unreachable regardless of which future commit means to.
 * Add each one back in the task that first writes a test needing it, the way `release.ts`'s
 * own accessors arrived one at a time as the release feature's tasks landed — a helper
 * file grows with its callers rather than being drafted whole against a plan that has not
 * shipped yet. `mwRow`, `rowPaths`, `mwTwisty` and `refreshMyWork` are Task 6's own first
 * four, added below for `test/view/mywork/tree.test.ts` — `mwRow`/`mwTwisty` named apart
 * from `release.ts`'s identical `row`/`twisty` rather than sharing those names, which is
 * what a fallow duplicate-export finding asked for the moment a second file exported the
 * same bare names (`src/view/scopeFolds.ts`'s own header records the identical fix for
 * the fold trio); `refreshMyWork` joined in fix round 1, for the focus-restore test that
 * drives a real data update rather than a fresh pick.
 */
export function makeMyWorkView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	opts: { embedded?: boolean } = {},
): MyWorkHarness {
	const containerEl = mountLeaf(vault, opts.embedded ? undefined : 'MyWork.base');
	const view = new MyWorkView({} as never, containerEl, new WriteLock());
	const config = new FakeViewConfig(configValues);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: baseResults(vault) };
	view.onDataUpdated();
	return { view, config, containerEl };
}

/** Re-pulls the base's results from `vault` and re-runs `onDataUpdated` — the same
 *  mutate-then-refresh shape `test/helpers/release.ts`'s `refreshRelease` uses, over
 *  `baseResults` rather than a bare `vault.entries()` so a refresh still honours whatever
 *  `outsideFilter` exclusion the vault registered. */
export function refreshMyWork(view: MyWorkView, vault: FakeVault): void {
	(view as unknown as Record<string, unknown>).data = { data: baseResults(vault) };
	view.onDataUpdated();
}

/** A drawn row by path — never optional, because every caller of this one already
 *  expects it on screen. `{ optional: true }` is the exception, `test/helpers/release.ts`'s
 *  own overload shape, for a caller checking a row is ABSENT (a fold, a hide-done pass). */
export function mwRow(view: MyWorkView, path: string): HTMLElement;
export function mwRow(view: MyWorkView, path: string, opts: { optional: true }): HTMLElement | null;
export function mwRow(view: MyWorkView, path: string, opts: { optional?: boolean } = {}): HTMLElement | null {
	const el = view.viewEl.querySelector<HTMLElement>(`.pbl-row[data-path="${path}"]`);
	if (el === null && !opts.optional) throw new Error(`row not found: ${path}`);
	return el;
}

/** Every row's path, in the tree's own drawn order — `renderTree.ts`'s pre-order walk,
 *  never a second sort of our own. */
export function rowPaths(view: MyWorkView): string[] {
	return Array.from(view.viewEl.querySelectorAll<HTMLElement>('.pbl-row')).map(
		(el) => el.getAttribute('data-path') ?? '',
	);
}

/** The disclosure button on one row — never optional, because every caller of this one
 *  already knows the row has children. */
export function mwTwisty(view: MyWorkView, path: string): HTMLElement {
	const el = mwRow(view, path)?.querySelector<HTMLElement>('.pbl-twisty');
	if (!el) throw new Error(`twisty not found: ${path}`);
	return el;
}
