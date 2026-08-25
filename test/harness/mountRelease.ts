/**
 * Mount the REAL release view outside Obsidian — `mountEstimation.ts`'s own purpose and
 * shape, narrowed to `ReleaseView`: nothing here depends on vitest, so the same view
 * bundles into a page (`npm run harness -- test/harness/release.ts`) and opens in a
 * browser. It draws; it checks nothing (ADR 0020).
 *
 * **This is the entry the branch went without, and its absence is why a `display:
 * contents` defect that made the whole index unreachable by keyboard survived eight
 * tests, two reviews and a fix round.** jsdom computes no layout and no styles, so
 * appearance, focusability and geometry are exactly the questions its tests cannot
 * answer; this is where they can be looked at. What it still does NOT answer is a themed
 * vault's colours, its accent, and anything Bases hands the view — the live-vault check
 * is owed either way.
 *
 * No `WriteLock` and no `vault.afterWrite` wiring, unlike both existing mounts: this view
 * creates notes and its own config but plans no batch, so there is nothing to serialize
 * and no refresh to drive. A lock parameter here would suggest otherwise.
 */
import { ReleaseView } from '../../src/view/release/releaseView';
import { drawChrome } from './chrome';
import { drawIcons } from './icons';
import { installObsidianDom } from '../helpers/dom';
import { RELEASE_CONFIG } from '../helpers/release';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { FileView } from '../helpers/obsidian-mock';

/**
 * `?config=` on the page (`release.ts`): `empty` mounts a base holding no release at all
 * (the empty state, plus the unresolved memberships it must still report), `notype`
 * with the type property unbound (the configuration state), `nomembership` with the
 * membership property unbound — the index's absent-column note, and, with `?pick=`, the
 * scope screen's own unconfigured state. Anything else binds all seven keys.
 */
export type ReleaseConfigVariant = 'full' | 'empty' | 'notype' | 'nomembership';

function configValues(variant: ReleaseConfigVariant): Record<string, unknown> {
	if (variant === 'notype') return { ...RELEASE_CONFIG, typeProperty: '' };
	if (variant === 'nomembership') return { ...RELEASE_CONFIG, membershipProperty: '' };
	return RELEASE_CONFIG;
}

/**
 * A release programme rather than the suite's own three-note fixtures: four releases so
 * the index has an order to show, members under an Epic that is NOT a member so the scope
 * screen draws a context row, and both kinds of unresolved membership so the note under
 * the list has something to count.
 *
 * The longest version and the longest status are deliberate. Fixed column widths were the
 * price of dropping the shared grid (`renderIndex.ts`'s `columnWidthVar`), so where a
 * figure now ellipsises is a visible change nobody has looked at — and this is the only
 * place it can be looked at.
 */
function releaseHarnessVault(variant: ReleaseConfigVariant): FakeVault {
	const vault = new FakeVault();
	if (variant !== 'empty') {
		const release = (path: string, frontmatter: Record<string, unknown>): void => {
			vault.addFile(path, { frontmatter: { type: 'Release', ...frontmatter } });
		};
		release('Releases/0.8.md', { version: '0.8.0', 'target-date': '2026-09-12', status: 'In progress', order: 1 });
		release('Releases/0.9.md', { version: '0.9.0', 'target-date': '2026-10-24', status: 'Planned', order: 2 });
		release('Releases/1.0.md', {
			version: '1.0.0-rc.4+2026.08.23',
			'target-date': '2026-12-05',
			status: 'Waiting on the platform team',
			order: 3,
		});
		// No version and no target date: the row [[Every release in one list]] 3a sorts after
		// every dated one, and the only one whose target cell says so rather than sitting blank.
		release('Releases/Someday.md', { status: 'Idea' });
	}

	vault.addFile('Sign-up flow.md', { frontmatter: { type: 'Epic', order: 1 } });
	vault.addFile('Passwordless sign-in.md', {
		frontmatter: { type: 'Feature', parent: '[[Sign-up flow]]', order: 1, release: '[[0.8]]' },
	});
	vault.addFile('Send the magic link.md', {
		frontmatter: { type: 'PBI', parent: '[[Passwordless sign-in]]', order: 1, release: '[[0.8]]', status: 'Done' },
	});
	vault.addFile('Expire the link.md', {
		frontmatter: { type: 'PBI', parent: '[[Passwordless sign-in]]', order: 2, release: '[[0.8]]', status: 'Ready' },
	});
	vault.addFile('Session handling.md', {
		frontmatter: { type: 'Feature', parent: '[[Sign-up flow]]', order: 2, release: '[[0.9]]' },
	});
	vault.addFile('Billing.md', { frontmatter: { type: 'Epic', order: 2 } });
	vault.addFile('Invoices.md', { frontmatter: { type: 'Feature', parent: '[[Billing]]', order: 1, release: '[[1.0]]' } });
	// The two shapes the note under the list counts: a value naming no note at all, and a
	// row the plan does not hold carrying the property by hand.
	vault.addFile('Rotate the signing key.md', { frontmatter: { type: 'PBI', order: 3, release: '[[Gone]]' } });
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 1, release: '[[0.8]]' } });
	return vault;
}

export interface MountedReleaseHarness {
	view: ReleaseView;
	vault: FakeVault;
	containerEl: HTMLElement;
}

/**
 * Build the view into `root`. The Bases leaf is real nesting, `mountHarness`'s own
 * reason: the view-state store — this view's picked release — has no identity to key on
 * without it, so without the leaf every pick would be forgotten on the next data update.
 */
export function mountReleaseHarness(root: HTMLElement, variant: ReleaseConfigVariant = 'full'): MountedReleaseHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const vault = releaseHarnessVault(variant);
	const leafEl = root.createDiv('pbl-harness-leaf');
	const containerEl = leafEl.createDiv();
	vault.addLeaf(new FileView(vault.addFile('Releases demo.base'), leafEl));

	const view = new ReleaseView({} as never, containerEl);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	const config = new FakeViewConfig(configValues(variant));
	config.name = 'Releases';
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();

	return { view, vault, containerEl };
}
