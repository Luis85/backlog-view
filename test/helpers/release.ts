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
