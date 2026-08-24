import { ReleaseSettings } from '../../src/domain/releaseOptions';
import { ReleaseView } from '../../src/view/release/releaseView';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf } from './vault';

installObsidianDom();

export interface ReleaseHarness {
	view: ReleaseView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * `makeEstimationView`'s shape minus the `WriteLock`: this view writes nothing, so there
 * is nothing to serialize and no undo slot to share. A lock parameter here would suggest
 * otherwise.
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
 * A `ReleaseSettings` object built directly, every optional key off by default — for
 * tests over `createRelease` and anything else that takes the resolved settings shape
 * rather than a `BasesViewConfig` to resolve it from (`resolveReleaseSettings` only
 * builds one FROM a config, and a creator test wants the shape itself). An override per
 * field, so a test binding one key asserts about that key alone.
 */
export function releaseSettingsWith(overrides: Partial<ReleaseSettings> = {}): ReleaseSettings {
	return {
		parentKey: '',
		orderKey: '',
		typeKey: 'type',
		membershipKey: '',
		versionKey: '',
		targetDateKey: '',
		statusKey: '',
		folder: '',
		...overrides,
	};
}

/** Every key bound — what a fully configured vault looks like. */
export const RELEASE_CONFIG = {
	typeProperty: 'note.type',
	parentProperty: 'note.parent',
	orderProperty: 'note.order',
	membershipProperty: 'note.release',
	versionProperty: 'note.version',
	targetDateProperty: 'note.target-date',
	releaseStatusProperty: 'note.status',
};

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
