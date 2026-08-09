// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountHarness } from './mount';
import { installObsidianDom } from '../helpers/dom';
import { clickExpandAll, projectionButton, submitPrompt } from '../helpers/view';
import { barFor, gripNames } from '../helpers/roadmap';

/** The rendered row for a title — the tree accessors take a container, and so do these. */
function rowFor(containerEl: HTMLElement, title: string): HTMLElement {
	const row = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row')).find(
		(r) => r.querySelector('.pbl-title')?.textContent === title,
	);
	if (!row) throw new Error(`row not found: ${title}`);
	return row;
}

function titlesIn(containerEl: HTMLElement): (string | null)[] {
	return Array.from(containerEl.querySelectorAll('.pbl-row .pbl-title')).map((t) => t.textContent);
}

installObsidianDom();

/**
 * The harness is not a test — it draws, and nothing asserts what it draws (ADR 0020).
 * These are what stop it from rotting anyway, and none costs a new gate step: one mounts
 * it so a harness that no longer builds fails here rather than the next time someone
 * tries to look at something, one holds the theme stub to the stylesheet it stands in
 * for, and one holds the icon set to the names the view actually asks for.
 */
describe('the browser harness mounts', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root);
	}

	it('draws a tree with the fixture at depth, including its context row', () => {
		const { containerEl } = mount();

		expect(titlesIn(containerEl)).toContain('Onboarding');
		// The parent the Base does not return: on screen, marked, and not a write target.
		const context = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row')).find(
			(row) => row.querySelector('.pbl-title')?.textContent === 'Retired platform',
		);
		expect(context?.classList.contains('pbl-outside')).toBe(true);
	});

	it('draws the risk chip in each of the three faces the fixture exists to show', () => {
		const { containerEl } = mount();
		// The cases sit at depth, and the tree opens collapsed for a parent nobody has
		// ruled on — so this is the toolbar control a reader would press to see them.
		clickExpandAll(containerEl);
		const chipOn = (title: string) => rowFor(containerEl, title).querySelector('.pbl-risk-chip');

		// A declared level, a level the list does not name, and a row nobody has judged.
		expect(chipOn('Single sign-on')?.textContent).toBe('1 - High');
		expect(chipOn('Offline-first sync')?.textContent).toBe('Existential');
		expect(chipOn('Token refresh')?.classList.contains('pbl-risk-unset')).toBe(true);
		// And the context row's, which is shown but never a write target.
		expect(chipOn('Retired platform')?.tagName).toBe('DIV');
	});

	it('draws every board column the fixture configures, with cards in them', () => {
		const { view, containerEl } = mount();

		view.setProjection('board');

		const columns = Array.from(containerEl.querySelectorAll('.pbl-board-col .pbl-board-col-name')).map(
			(n) => n.textContent,
		);
		expect(columns).toEqual(expect.arrayContaining(['New', 'Ready', 'Active', 'Review', 'Done']));
		expect(containerEl.querySelectorAll('.pbl-board-cols .pbl-card').length).toBeGreaterThan(5);
	});

	it('draws the roadmap buckets and puts the untriaged items on the shelf', () => {
		const { view, containerEl } = mount();

		view.setProjection('roadmap');
		view.setShelfCollapsed(false);

		const buckets = Array.from(containerEl.querySelectorAll('.pbl-bucket .pbl-bucket-name')).map((n) => n.textContent);
		expect(buckets).toEqual(expect.arrayContaining(['Now', 'Next', 'Later']));
		expect(containerEl.querySelectorAll('.pbl-shelf .pbl-card').length).toBeGreaterThan(0);
	});

	it('switches projection through the real toolbar, which is the control being exercised', () => {
		const { containerEl } = mount();

		projectionButton(containerEl, 'Show as kanban board').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-board-cols')).not.toBeNull();
	});
});

/**
 * The mock RECORDS a menu and a dialog; the harness has to DRAW them or a right-click
 * produces nothing on a page that advertises menus as usable. These drive the drawing
 * through the same events a person would, and the creation one is why the fake vault
 * notifies on `create` as well as on a frontmatter write — without that the new note
 * existed and the screen kept showing the old result set.
 */
/**
 * The dependency connector shipped in Tasks 1–4 and drew nothing markup assertions had
 * been checking: it is a picture question — is the dot reachable on a bar too narrow for
 * its own grips, on a bar with no grips at all, on a bar clamped by the window — so these
 * mount the real grid and assert the cases render, rather than asserting shape on a
 * fixture nothing draws. See `edgeCaseVault` for why the clipped case needs its own vault.
 */
describe('the harness draws the cases the dependency connector has to survive', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root);
	}

	it('draws the cases the connector has to survive, in the everyday fixture', () => {
		const { view, containerEl } = mount();
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		containerEl.querySelector<HTMLButtonElement>('.pbl-collapse-ctl')?.click();

		// `Cut the release branch` is a one-day PBI — start and target the same date — so
		// its diamond comes from GEOMETRY, not from being a Milestone. Addressed by name:
		// `Ship 1.0` (an actual Milestone) already carries `.pbl-bar-milestone` on every
		// render of this fixture, so a bare class selector would pass whether or not this
		// note drew anything — extension 1d is that the bar keeps BOTH its resize grip and
		// its connector rather than trading one for the other, so both are asserted by name.
		const oneDay = barFor(containerEl, 'Cut the release branch');
		expect(oneDay.classList.contains('pbl-bar-milestone')).toBe(true);
		expect(gripNames(containerEl, 'Cut the release branch')).toContain('end');
		expect(oneDay.querySelector('.pbl-bar-connector')).not.toBeNull();

		// An inferred bar has no grip and still offers a connector. `Welcome tour` is the
		// one note in this fixture with no dates of its own whose span comes from a child —
		// addressed by name so a class rename or a deleted note fails here rather than on
		// whichever bar happens to inherit the class next.
		const inferred = barFor(containerEl, 'Welcome tour');
		expect(inferred.classList.contains('pbl-bar-inferred')).toBe(true);
		expect(gripNames(containerEl, 'Welcome tour')).toEqual([]);
		expect(inferred.querySelector('.pbl-bar-connector')).not.toBeNull();
	});

	it('draws a clipped bar in the edge-case fixture, where it distorts nothing', () => {
		const root = document.createElement('div');
		document.body.appendChild(root);
		const { view, containerEl } = mountHarness(root, 'edges');
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		// `Platform` opens collapsed, like any parent nobody has ruled on yet (see
		// `collapseNewParents` in `src/view/CLAUDE.md`). Without expanding it, `Platform`'s
		// own rollup bar is already clipped (inferred from `The long migration`'s span), so
		// the assertion below would pass on the wrong bar — expanding draws `The long
		// migration` itself, the note the fixture's own comment describes as clipped.
		containerEl.querySelector<HTMLButtonElement>('.pbl-collapse-ctl')?.click();

		// Addressed by name, and by name alone: `Platform`'s inferred rollup ALSO carries
		// `.pbl-bar-clipped-end` and sits earlier in DOM order, so a bare class selector
		// would keep passing even if `The long migration` itself stopped drawing one.
		const clipped = barFor(containerEl, 'The long migration');
		expect(clipped.classList.contains('pbl-bar-clipped-end'), 'the edge fixture exists to draw a clipped bar').toBe(
			true,
		);
		// The connector comes INSIDE the clamped edge; the class is what the stylesheet
		// keys that on, so its presence is the checkable half.
		expect(clipped.querySelector('.pbl-bar-connector')).not.toBeNull();
	});
});

describe('the chrome the mock only records', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root);
	}

	function contextMenuOn(el: HTMLElement): void {
		el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }));
	}

	it('draws a context menu where the pointer is, with the view’s own items in it', () => {
		const { containerEl } = mount();

		contextMenuOn(rowFor(containerEl, 'Onboarding'));

		const menu = document.querySelector<HTMLElement>('.pbl-harness-menu');
		expect(menu).not.toBeNull();
		const items = Array.from(menu?.querySelectorAll('.pbl-harness-menu-item') ?? []).map((i) => i.textContent);
		expect(items.length).toBeGreaterThan(3);
		expect(items.some((label) => label?.includes('Set type'))).toBe(true);
	});

	it('runs the item that is clicked, and takes the menu away', async () => {
		const { containerEl, vault } = mount();
		contextMenuOn(rowFor(containerEl, 'Onboarding'));
		const done = Array.from(document.querySelectorAll<HTMLElement>('.pbl-harness-menu-item')).find((i) =>
			i.textContent?.includes('Done'),
		);

		done?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.querySelector('.pbl-harness-menu')).toBeNull();
		expect(vault.fm('Onboarding.md').status).toBe('Done');
	});

	it('closes on Escape without running anything', () => {
		const { containerEl, vault } = mount();
		contextMenuOn(rowFor(containerEl, 'Onboarding'));

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(document.querySelector('.pbl-harness-menu')).toBeNull();
		expect(vault.fm('Onboarding.md').status).toBe('Active');
	});

	it('puts a dialog on the page, and re-renders once the note it creates lands', async () => {
		const { containerEl, vault } = mount();
		const newItem = containerEl.querySelector<HTMLElement>('.pbl-new-btn');
		newItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(document.querySelector('.pbl-harness-modal')).not.toBeNull();
		submitPrompt({ title: 'Drawn by the harness' });
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(document.querySelector('.pbl-harness-modal')).toBeNull();
		// Filed under the type's default folder, which is the shipped default layout.
		expect(vault.files.has('docs/requirements/Drawn by the harness.md')).toBe(true);
		// The re-render is the point: the fake vault notifies on create as well as on a
		// write, so the new row is on screen rather than waiting for an unrelated edit.
		expect(titlesIn(containerEl)).toContain('Drawn by the harness');
	});
});

/**
 * The stub going stale is the failure with teeth: add a `var(--text-selection)` to a
 * partial and the page draws it as nothing, silently, forever. So the set is MEASURED
 * off the partials rather than remembered — the instrument reads what the assembler
 * reads, and the rule is stated at the missing variable rather than as a list someone
 * maintains.
 */
describe('the harness draws every icon the view asks for', () => {
	/**
	 * Walk all four projections and both roadmap axes, collecting what `setIcon` was
	 * asked for. Driving the view rather than grepping `src/` on purpose: several icon
	 * names never appear as a literal beside a `setIcon` call — the type badges come
	 * from a table, the spinner and the filter's two states from branches — and a grep
	 * written to find them missed exactly those four. The instrument has to be able to
	 * see the whole set before its verdict is worth anything.
	 */
	function sweepIcons(): { asked: Set<string>; missing: Set<string>; drew: string[] } {
		const root = document.createElement('div');
		document.body.appendChild(root);
		const { view, containerEl } = mountHarness(root);
		const asked = new Set<string>();
		const missing = new Set<string>();
		const drew: string[] = [];
		const collect = () => {
			for (const el of containerEl.querySelectorAll<HTMLElement>('[data-icon]')) asked.add(el.dataset.icon ?? '');
			for (const el of containerEl.querySelectorAll<HTMLElement>('[data-icon-missing]')) {
				missing.add(el.dataset.iconMissing ?? '');
			}
			// What the render pass itself says it just drew: `renderProjectionContent`
			// names the scroller per projection. A witness the sweep cannot fake by
			// collecting more of the same icons, which is what let a dark leg pass.
			drew.push(containerEl.querySelector('.pbl-tree')?.getAttribute('aria-label') ?? '');
		};
		for (const projection of ['tree', 'board', 'roadmap', 'deliverables'] as const) {
			view.setProjection(projection);
			collect();
		}
		for (const axis of ['horizons', 'dates'] as const) {
			// Back onto the roadmap explicitly. This loop is about ITS axes, and leaving
			// that to whichever projection the loop above happened to end on is exactly how
			// appending a fourth projection silently stopped collecting the dated axis —
			// `setAxisPick` re-rendered the Deliverables board, and the sweep went on
			// passing because nothing named a control only that axis draws.
			view.setProjection('roadmap');
			view.setAxisPick(axis);
			view.setShelfCollapsed(false);
			collect();
		}
		return { asked, missing, drew };
	}

	it('resolves every name, aliases included', () => {
		// `data-icon-missing` is set by the harness renderer for a name lucide does not
		// carry. Obsidian bundles an older lucide, so some of its names are that
		// release's and are mapped in `icons.ts`; a rename lucide makes later lands
		// here rather than as a silently blank control on the page.
		expect([...sweepIcons().missing]).toEqual([]);
	});

	it('measures something — the instrument is checked before its verdict is trusted', () => {
		// A sweep that drove nothing, or a selector that matched nothing, would satisfy
		// the test above forever.
		const { asked, drew } = sweepIcons();
		expect(asked.size).toBeGreaterThan(20);
		expect(asked).toContain('inbox');
		// Every leg actually rendered its OWN projection, asked of the label the render
		// pass sets rather than of the icons it happened to draw. Two weaker forms of
		// this check have now failed to catch a dark leg: a size plus one common icon,
		// and then naming `package` — which the mode TOGGLE draws on every projection,
		// so that assertion could not fail whatever the sweep did. An icon is evidence
		// only if nothing else draws it; a projection's own name always is.
		expect(drew).toContain('Product backlog');
		expect(drew).toContain('Product backlog board');
		expect(drew).toContain('Deliverables board');
		expect(drew).toContain('Product backlog roadmap');
		// The two axis legs share the roadmap's label, so the dated one is witnessed by
		// the control only it draws.
		expect(asked).toContain('locate-fixed');
	});
});

describe('the theme stub covers the stylesheet', () => {
	/** Every `var(--x)` in a directory of CSS, minus the plugin's own, which code sets. */
	function variablesUsed(dir: string): Set<string> {
		const used = new Set<string>();
		for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
			for (const match of readFileSync(`${dir}/${file}`, 'utf8').matchAll(/var\(\s*(--[\w-]+)/g)) {
				if (!match[1].startsWith('--pbl')) used.add(match[1]);
			}
		}
		return used;
	}

	/**
	 * What the page actually resolves in one scheme: everything outside the two
	 * scheme blocks, plus that scheme's own. Asked per scheme rather than of the whole
	 * file, because the file having a name in it somewhere is not the question — a
	 * variable set only under `theme-dark` reads as nothing in light, and a search of
	 * the text would call that covered.
	 */
	function variablesDefined(scheme: 'dark' | 'light'): Set<string> {
		const theme = readFileSync('test/harness/theme.css', 'utf8');
		const blockOf = (name: string) => new RegExp(`body\\.theme-${name}\\s*\\{([^}]*)\\}`).exec(theme)?.[1] ?? '';
		const shared = theme.replace(/body\.theme-(dark|light)\s*\{[^}]*\}/g, '');
		const defined = new Set<string>();
		for (const source of [shared, blockOf(scheme)]) {
			for (const match of source.matchAll(/^\s*(--[\w-]+)\s*:/gm)) defined.add(match[1]);
		}
		return defined;
	}

	it.each(['dark', 'light'] as const)('defines every Obsidian variable the partials read, in %s', (scheme) => {
		const defined = variablesDefined(scheme);

		expect([...variablesUsed('styles')].filter((name) => !defined.has(name))).toEqual([]);
	});

	it('splits the schemes rather than defining one of them', () => {
		// The instrument again: a regex that failed to find either block would make the
		// test above a search of the whole file, which is the thing it exists not to be.
		const dark = variablesDefined('dark');
		const light = variablesDefined('light');
		expect(dark.has('--color-base-00')).toBe(true);
		expect(light.has('--color-base-00')).toBe(true);
		// Same set, different values — a name in one and not the other is the defect.
		expect([...dark].filter((name) => !light.has(name))).toEqual([]);
		expect([...light].filter((name) => !dark.has(name))).toEqual([]);
	});

	it('measures something — the instrument is checked before its verdict is trusted', () => {
		// A regex that silently matched nothing would pass the test above forever.
		expect(variablesUsed('styles').size).toBeGreaterThan(20);
		expect(variablesUsed('styles').has('--background-primary')).toBe(true);
		expect(variablesUsed('styles').has('--pbl-indent')).toBe(false);
	});
});
