/**
 * Mount the REAL my-work view outside Obsidian — `mountRelease.ts`'s own purpose and
 * shape, narrowed to `MyWorkView`: nothing here depends on vitest, so the same view
 * bundles into a page (`npm run harness -- test/harness/mywork.ts`) and opens in a
 * browser. It draws; it checks nothing (ADR 0020).
 *
 * **This is the entry Task 10 exists to add**, and it is what turns "Obsidian cannot run
 * here" from a debt every earlier task in [[Assigned work in the sidebar]] reported
 * honestly into something a person can actually look at. What it still cannot answer is
 * a themed vault's colours, its accent, and anything Bases hands the view — the
 * live-vault check is owed either way; see `mountWidthPane` below for the one thing this
 * entry adds beyond every other view's harness pair.
 *
 * No `vault.afterWrite` wiring, unlike `mount.ts`'s — `mountEstimation.ts`'s own reason,
 * not `mountRelease.ts`'s: this view's one write (Task 9's Set state) already refreshes
 * itself once its own batch resolves (`MyWorkView`'s gate calls `this.refresh()` from its
 * own `flushDataUpdate`), and nothing else in this harness ever interleaves a Bases
 * update mid-batch.
 */
import { MyWorkView } from '../../src/view/mywork/myWorkView';
import { WriteLock } from '../../src/view/writeLock';
import { drawChrome } from './chrome';
import { drawIcons } from './icons';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { FileView } from '../helpers/obsidian-mock';

/**
 * A small work programme of its own, rather than `test/helpers/mywork.ts`'s shared
 * `myWorkVault()` — `mountRelease.ts`'s own choice over `test/helpers/release.ts`'s
 * fixture, for the identical reason: that fixture is deliberately minimal (four notes,
 * "on purpose" per its own header) and is off limits to edit for this task besides. It
 * also carries no state property on any note, so the state chip and the Next marker —
 * the two things the narrow rule exists to hide and to keep, respectively — would never
 * draw at all if this harness reused it.
 *
 * Ada's own two PBIs are the whole reason to look: one done, one not, so picking her
 * draws a finished chip, an open chip and the Next marker on the open one — under a
 * Feature named long enough (`Passwordless sign-in and account recovery`) to show
 * whether the title gives way before the reserved state column does. `Hidden Feature` is
 * `myWorkVault()`'s own `outsideFilter` shape, kept for the identical reason: `scopeRows`
 * walks THROUGH an `outsideFilter` ancestor rather than drawing it (`domain/scopeRows.ts`'s
 * own skip-through rule), so `Rotate the signing key` re-roots one level up, under
 * `Customer onboarding` directly, with no row for `Hidden Feature` at all.
 */
function myWorkHarnessVault(): { vault: FakeVault; hiddenPaths: string[] } {
	const vault = new FakeVault();
	vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('People/Bo.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Customer onboarding.md', { frontmatter: { type: 'Epic', order: 0 } });
	vault.addFile('Passwordless sign-in and account recovery.md', {
		frontmatter: { type: 'Feature', order: 1 },
		parentLink: 'Customer onboarding',
	});
	vault.addFile('Send the magic link.md', {
		frontmatter: { type: 'PBI', order: 1, assignee: 'Ada', status: 'In progress' },
		parentLink: 'Passwordless sign-in and account recovery',
	});
	vault.addFile('Expire the link after first use.md', {
		frontmatter: { type: 'PBI', order: 2, assignee: 'Ada', status: 'Done' },
		parentLink: 'Passwordless sign-in and account recovery',
	});
	vault.addFile('Session handling.md', {
		frontmatter: { type: 'PBI', order: 3, assignee: 'Bo', status: 'Ready' },
		parentLink: 'Passwordless sign-in and account recovery',
	});
	// The `outsideFilter` context shape: excluded from the base's own results below, so
	// its member re-roots one level up in Ada's tree while the ancestor itself still
	// renders, dimmed, to hold that member's place.
	vault.addFile('Hidden Feature.md', {
		frontmatter: { type: 'Feature', order: 2 },
		parentLink: 'Customer onboarding',
	});
	vault.addFile('Rotate the signing key.md', {
		frontmatter: { type: 'PBI', order: 1, assignee: 'Ada', status: 'Ready' },
		parentLink: 'Hidden Feature',
	});
	return { vault, hiddenPaths: ['Hidden Feature.md'] };
}

export interface MountedMyWorkHarness {
	view: MyWorkView;
	vault: FakeVault;
	containerEl: HTMLElement;
}

/**
 * The one thing this entry adds beyond every other view's harness pair: a `.base` tab
 * drags into a sidebar of a REAL width, and that width is the pane's, never the
 * viewport's — the whole reason Task 10 keys its narrow rule on a container query rather
 * than `@media`. Nothing else drawn here has ever needed to say so, because no other
 * view in this plugin gives way at a pane width at all. Constraining the LEAF (Obsidian's
 * own nesting, kept for view-state identity — see `mountLeaf`'s own comment) rather than
 * the view's own root is what makes the constraint a fact about the DOCK, matching how a
 * real sidebar bounds the leaf it holds.
 */
function mountWidthPane(root: HTMLElement, widthPx: number | undefined): HTMLElement {
	const leafEl = root.createDiv('pbl-harness-leaf');
	if (widthPx !== undefined) {
		leafEl.setCssProps({
			'max-inline-size': `${widthPx}px`,
			'border-inline-end': '1px dashed var(--background-modifier-border)',
		});
	}
	return leafEl;
}

/**
 * Build the view into `root`, at `widthPx` if given (undefined leaves the pane at the
 * window's own width). The Bases leaf is real nesting, every other mount's own reason:
 * the view-state store — this view's picked person — has no identity to key on without
 * it, so without the leaf a pick would be forgotten on the next data update.
 */
export function mountMyWorkHarness(root: HTMLElement, widthPx?: number): MountedMyWorkHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const { vault, hiddenPaths } = myWorkHarnessVault();
	const leafEl = mountWidthPane(root, widthPx);
	const containerEl = leafEl.createDiv();
	vault.addLeaf(new FileView(vault.addFile('My work demo.base'), leafEl));

	const view = new MyWorkView({} as never, containerEl, new WriteLock());
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	const config = new FakeViewConfig();
	config.name = 'My work';
	anyView.config = config;
	const hidden = new Set(hiddenPaths);
	anyView.data = { data: vault.entries().filter((e) => !hidden.has(e.file.path)) };
	view.onDataUpdated();

	return { view, vault, containerEl };
}
