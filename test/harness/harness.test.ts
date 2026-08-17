// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountHarness } from './mount';
import { mountEstimationHarness, EstimationConfigVariant } from './mountEstimation';
import { applyPlatform } from './theme';
import { applyWantedFilter, applyWantedEstimationSelection, openWantedDialog } from './knobs';
import { Modal } from '../helpers/obsidian-mock';
import { installObsidianDom } from '../helpers/dom';
import { ExtraButtonComponent } from '../helpers/obsidian-mock';
import { clickExpandAll, projectionButton, submitPrompt } from '../helpers/view';
import { barFor, gripNames } from '../helpers/roadmap';
import { demoVault } from '../helpers/fixtures';

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
 * tries to look at something, and one holds the icon set to the names the view actually
 * asks for. Whether the two linked sheets between them RESOLVE every variable the
 * partials read is its own subject, in `themeStub.test.ts`.
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

	it('draws the resources axis, with an empty declared row and a row an absence minted', () => {
		// The axis and its absences reached the fixture late (2026-08-14): until then the one
		// tool for "what does this look like" could not show the feature at all, which is
		// how a row whose lead and track stacked as blocks — the stripe drawing on the line
		// below the name it belongs to — got as far as a vault before anyone saw it.
		const { view, containerEl } = mount();

		view.setProjection('roadmap');
		view.setAxisPick('resources');

		const rows = Array.from(containerEl.querySelectorAll('.pbl-lane-head .pbl-lane-name')).map((n) => n.textContent);
		// Declared and empty, and a row nothing but an absence puts on screen.
		expect(rows).toEqual(expect.arrayContaining(['Dana', 'Kim', 'Priya', 'Sam']));
		// Four stretches: one running, one ahead for the row it mints, one that has ENDED —
		// the case the band header's readout must count as nothing — and a fourth overlapping
		// the running one, so Dana's header packs into two sub-lanes. Marks inside the
		// header's own track now, not rows of their own — the rows became header marks on
		// 2026-08-14.
		expect(containerEl.querySelectorAll('.pbl-lane-head .pbl-absence')).toHaveLength(4);
	});

	it('draws the test catalog, with both ladders in one fixture and neither in the other', () => {
		// The fixture rule, applied: a change that visibly alters the view puts its cases in
		// the fixture, and this is what asserts they are still there — a deleted note or a
		// renamed class fails here rather than leaving the harness quietly showing less.
		const { view, containerEl } = mount();

		view.setProjection('catalog');
		clickExpandAll(containerEl);
		const titles = Array.from(containerEl.querySelectorAll('.pbl-title')).map((n) => n.textContent);
		// A suite with two cases (the move section needs a neighbour), the `Task` that
		// belongs here by what it hangs from, the implied case where the test axis and
		// `.pbl-implied` have to compose, and the promoted root the mis-drag produces.
		expect(titles).toEqual(
			expect.arrayContaining([
				'Sign-up smoke tests',
				'Register with a provider',
				'Fix the provider redirect',
				'Resume an abandoned sign-up',
				'Verify the rate limit',
			]),
		);
		// The badge is drawn against the real stylesheet, which is what the harness is for:
		// the axis is a class here and a border there.
		expect(containerEl.querySelector('.pbl-badge.pbl-lvl-test-suite')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-badge.pbl-lvl-test-case.pbl-implied')).not.toBeNull();
		// And the plan draws none of it, which is the other half of the same bargain.
		view.setProjection('tree');
		clickExpandAll(containerEl);
		const plan = Array.from(containerEl.querySelectorAll('.pbl-title')).map((n) => n.textContent);
		expect(plan).not.toContain('Sign-up smoke tests');
		expect(plan).toContain('Single sign-on');
	});

	it('switches projection through the real toolbar, which is the control being exercised', () => {
		const { containerEl } = mount();

		projectionButton(containerEl, 'Show as kanban boards').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-board-cols')).not.toBeNull();
	});
});

/** The estimation table's own row/title accessor — `rowFor` above reads `.pbl-row`,
 *  the tree's class, which this view never draws. */
function estRowFor(containerEl: HTMLElement, title: string): HTMLElement {
	const row = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-est-row')).find(
		(r) => r.querySelector('.pbl-est-title')?.textContent === title,
	);
	if (!row) throw new Error(`estimation row not found: ${title}`);
	return row;
}

/**
 * The estimation entry's own guarantees, `describe('the browser harness mounts', ...)`'s
 * shape for the second view: it still mounts, the fixture still draws the cases it
 * exists for, and the URL knobs still make their state.
 */
describe('the estimation harness mounts', () => {
	function mount(variant?: EstimationConfigVariant) {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountEstimationHarness(root, variant);
	}

	it('draws a table row for every fixture note, and the widened dimension bound to it', () => {
		const { view, containerEl } = mount();

		expect(containerEl.querySelectorAll('.pbl-est-row').length).toBe(11);
		expect(view.settings.model.dimensions.find((d) => d.id === 'enablement')?.max).toBe(12);
	});

	it('draws the currency vocabulary end to end — current, stale, foreign, handwritten, orphan, none', () => {
		const { containerEl } = mount();
		const currency = (title: string) => estRowFor(containerEl, title).querySelector('.pbl-est-currency')?.textContent;

		expect(currency('Full profile')).toBe('Current');
		expect(currency('Stale total')).toBe('Needs re-estimation');
		expect(currency('Foreign stamp')).toBe('Another model');
		expect(currency('Hand-written total')).toBe('Hand-written');
		expect(currency('Orphan total')).toBe('Inputs gone');
		expect(currency('Nothing answered')).toBe('');
	});

	it('draws the clamp note and the between-points note the panel exists to show', () => {
		const { containerEl } = mount();

		estRowFor(containerEl, 'Out-of-range answer').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-est-panel')?.textContent).toContain('Out of range');

		estRowFor(containerEl, 'Fractional score').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-est-panel')?.textContent).toContain('Between points');
	});

	it('omits the value-to-effort line for a zero and a negative effort', () => {
		const { containerEl } = mount();

		for (const title of ['Zero effort', 'Negative effort']) {
			estRowFor(containerEl, title).dispatchEvent(new MouseEvent('click', { bubbles: true }));
			const derived = containerEl.querySelector('.pbl-est-derived')?.textContent ?? '';
			expect(derived).toContain('Confidence-adjusted value');
			expect(derived).not.toContain('Value to effort');
		}
	});

	it('selects a row through the ?select= knob, the same panel a click draws', () => {
		const { view, containerEl } = mount();

		applyWantedEstimationSelection(view, '?select=Full profile');

		expect(estRowFor(containerEl, 'Full profile').classList.contains('pbl-selected')).toBe(true);
		expect(containerEl.querySelector('.pbl-est-panel')).not.toBeNull();
	});

	it('draws the guided empty state for ?config=empty, with the shared shell’s own title class', () => {
		const { containerEl } = mount('empty');

		expect(containerEl.querySelector('.pbl-est-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe(
			'No estimation model is configured for this view.',
		);
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
	});

	it('draws the config-warning block for ?config=problems, naming the missing stamp', () => {
		const { containerEl } = mount('problems');

		const warning = containerEl.querySelector('.pbl-est-problems');
		expect(warning).not.toBeNull();
		expect(warning?.textContent).toMatch(/stamp/i);
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
	});

	it('resolves every icon it asks for, across the unconfigured, configured and selected states', () => {
		const missing = new Set<string>();
		const collect = (containerEl: HTMLElement) => {
			for (const el of containerEl.querySelectorAll<HTMLElement>('[data-icon-missing]')) missing.add(el.dataset.iconMissing ?? '');
		};

		collect(mount('empty').containerEl); // the guided empty state's icon
		const { containerEl } = mount();
		estRowFor(containerEl, 'Full profile').dispatchEvent(new MouseEvent('click', { bubbles: true })); // the clear buttons' icon
		collect(containerEl);

		expect([...missing]).toEqual([]);
	});
});

/**
 * One rule's own declarations, matched by an EXACT selector — anchored on the rule
 * boundary (`}` or the start of the file) rather than a bare substring search, because
 * `.pbl-est-title` is also the tail of `.pbl-est-panel > .pbl-est-title`'s selector, and
 * an unanchored search would read that rule's declarations instead of the one asked for.
 * Comments are stripped first (`test/helpers/cssVars.ts`'s own `eachBlock` does the same)
 * so a rule documented right above its selector cannot break the anchor.
 */
function ruleBody(css: string, selector: string): string {
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const escaped = selector.replace(/[.#]/g, '\\$&');
	const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(stripped);
	if (!match) throw new Error(`no rule for ${selector}`);
	return match[1];
}

/**
 * Two layout defects Chromium showed and jsdom cannot: it lays out nothing, so neither a
 * grid item stretching to fill a row it has no sibling in nor a flex row's title column
 * shrinking to zero width is a state any DOM query here can see. What is checkable is
 * pinned instead — the declaration each fix added — narrower than the visual claim, and
 * said so rather than left implying more than a `toMatch` on a stylesheet can back up.
 */
describe('two layout fixes found in the browser, pinned as declarations jsdom can read', () => {
	const estimationCss = readFileSync('styles/estimation.css', 'utf8');

	it('does not stretch the config-warning block to the grid row’s full height', () => {
		expect(ruleBody(estimationCss, '.pbl-est-problems')).toMatch(/align-self:\s*start/);
	});

	it('keeps a floor under the title column so it cannot shrink to nothing', () => {
		expect(ruleBody(estimationCss, '.pbl-est-title')).toMatch(/min-width:\s*96px/);
	});
});

/**
 * The size knob (`?notes=800`), which exists so the page can be asked what the view costs
 * at a size no curated fixture reaches.
 *
 * What is checked is that the knob DELIVERS the size, in both layouts — nothing here
 * times anything, and nothing here may: a timing assertion is refused by
 * [[The render path states its costs as checks]] and by ADR 0020's fourth refusal. But an
 * instrument has to be honest about its own sample, and a knob that quietly produced a
 * forty-row page while the panel reported confidently on eight hundred would be exactly
 * the failure this whole feature exists to avoid.
 */
describe('the size knob grows the fixture it says it grows', () => {
	function mount(fixture: 'demo' | 'folders', extra: number) {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root, fixture, extra);
	}

	it.each(['demo', 'folders'] as const)('adds exactly the notes asked for, in the %s layout', (fixture) => {
		const plain = mount(fixture, 0).vault.files.size;

		const { vault, containerEl } = mount(fixture, 50);

		expect(vault.files.size).toBe(plain + 50);
		// Filed, not merely created: an epic per 25 means two of them, and in the folder
		// layout each is the note of its own folder — the placement the whole layout rests
		// on, and the one a generator can get wrong without the count noticing.
		clickExpandAll(containerEl);
		expect(titlesIn(containerEl)).toEqual(expect.arrayContaining(['Bulk epic 1', 'Bulk epic 26']));
		expect(vault.files.has(fixture === 'folders' ? 'Bulk epic 1/Bulk epic 1.md' : 'Bulk epic 1.md')).toBe(true);
	});

	it('gives every generated note a target after its own start', () => {
		// A span folded into the day index wrapped the fixture's 120-day window, so one
		// generated note in six stated a target before its start, read as unplaceable, and
		// went to the shelf — a sixth of the roadmap sample measuring the shelf instead of
		// the bars it exists to draw. Asserted over ALL of them rather than at the wrap,
		// because the next arithmetic slip will not be at the same index. (Codex, PR #128.)
		const generated = [...mount('demo', 400).vault.frontmatter].filter(([path]) => path.startsWith('Bulk '));
		expect(generated.length).toBe(400);
		const reversed = generated.filter(([, fm]) => String(fm['due']) < String(fm['start'])).map(([path]) => path);
		expect(reversed).toEqual([]);
	});

	it('puts no generated note within reach of a fixture nobody asked to grow', () => {
		// The claim that keeps every other caller — the whole suite and the plain harness
		// URL — on the fixture they had before the knob existed. Stated as the PREFIX
		// rather than as a count, because a count here would also be counting the harness's
		// own `.base` file, and because the prefix is what a title assertion could collide
		// with: a curated note renamed into it would fail this too, correctly.
		const titles = titlesIn(mount('demo', 0).containerEl);
		expect(titles.filter((t) => t?.startsWith('Bulk '))).toEqual([]);
		expect(demoVault().files.size).toBe(demoVault('flat', 0).files.size);
	});
});

/**
 * The folder fixture is the same backlog filed the way a folder-note vault files it, so
 * what is worth checking is exactly that: the tree comes out the same, and it comes out
 * of the PATHS — no note in it carries a `parent` key to fall back on.
 */
describe('the folder-structured fixture draws the same tree from its paths', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root, 'folders');
	}

	it('nests rows by folder note, walking through a container folder with no note', () => {
		const { containerEl } = mount();
		clickExpandAll(containerEl);

		// Depth is what inference produced: `Onboarding/Onboarding.md`, its Feature's folder
		// note below that, and the PBI inside `Use cases`, whose noteless folder the walk
		// passes straight through rather than counting as a rung.
		expect(rowFor(containerEl, 'Onboarding').getAttribute('aria-level')).toBe('1');
		expect(rowFor(containerEl, 'Sign-up flow').getAttribute('aria-level')).toBe('2');
		expect(rowFor(containerEl, 'Email and password').getAttribute('aria-level')).toBe('3');
		expect(rowFor(containerEl, 'Validate the address').getAttribute('aria-level')).toBe('4');
	});

	it('places every row without a parent key, and still loads the folder note the Base left out', () => {
		const { containerEl, vault } = mount();

		// The category invariant, asked of the vault rather than of the rows that happened
		// to be checked above: a single `parent` key anywhere would mean some part of this
		// tree was placed by a link and the fixture was proving less than it looks like.
		const linked = [...vault.frontmatter].filter(([, fm]) => 'parent' in fm).map(([path]) => path);
		expect(linked).toEqual([]);
		expect(vault.files.has('Onboarding/Sign-up flow/Use cases/Email and password/Email and password.md')).toBe(true);

		// Extension 3a: the folder note above `Legacy importer` is not a result, so it is
		// loaded from the vault as context — the same row the flat fixture gets from a link.
		expect(rowFor(containerEl, 'Retired platform').classList.contains('pbl-outside')).toBe(true);
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

	// The other half of the same fixture, and the reason it carries 133 generated notes:
	// rollup labels of three different WIDTHS on sibling rows, which is what a vault of
	// 800-odd PBIs has and no `?notes=` size produces — `addBulk` nests one Epic per 25,
	// so its widest label is two digits over two. Nothing here asserts alignment; it
	// asserts the CASE is on screen, so the thing to look at is still there to look at.
	it('draws rollup labels of three widths, the case bar alignment is looked at with', () => {
		const root = document.createElement('div');
		document.body.appendChild(root);
		const { containerEl } = mountHarness(root, 'edges');
		clickExpandAll(containerEl);

		const label = (title: string) => rowFor(containerEl, title).querySelector('.pbl-progress-label')?.textContent;
		expect(label('Three deep')).toBe('1/3');
		expect(label('Ten deep')).toBe('3/10');
		expect(label('A hundred and twenty deep')).toBe('40/120');
		// And the reservation the three of them produce, which is what holds their bars in
		// one column — the widest of the labels this tree draws, not this row's own.
		expect(containerEl.querySelector<HTMLElement>('.pbl-tree')?.style.getPropertyValue('--pbl-rollup-label')).toBe('6ch');
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

	// The box the dialog draws in used to be `.pbl-harness-modal-box`, hand-written, while
	// app.css's `.modal` sat in the vendored sheet resolving correctly and matching
	// nothing — the same shape as the disclosure that shipped looking right here and wrong
	// in a vault. What this holds is that the frame on the page IS the modal's own
	// element, so the plugin's classes on it (`mod-settings`, `mod-sidebar-layout`) and
	// Obsidian's rules for it are what paint the dialog.
	it('draws the dialog in the modal’s own element, not a box of the harness’s', () => {
		const { containerEl } = mount();
		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const frame = document.querySelector<HTMLElement>('.pbl-harness-modal > .modal');
		expect(frame).toBe(Modal.lastOpened?.modalEl);
		// Obsidian's own class on the overlay too, which is what the `.is-phone
		// .modal-container` rules in the vendored sheet need to match under `?phone`.
		expect(document.querySelector('.pbl-harness-modal')?.hasClass('modal-container')).toBe(true);
		expect(frame?.querySelector('.modal-content')).toBe(Modal.lastOpened?.contentEl);
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
 * The knobs exist because a dialog and a running filter are states no fixture produces
 * and no URL could reach — measured, not guessed: 98 of the classes the stylesheet writes
 * were rendered by no fixture in any projection, and about twenty of them are a dialog's.
 * What is asserted is that each knob still MAKES its state, since a knob that silently
 * stopped is a page that looks fine and answers nothing.
 */
describe('the page can open a dialog and run a filter by URL', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root);
	}

	it('opens each dialog the knob names, and nothing without one', () => {
		const { view, containerEl } = mount();
		// The mock records the last modal on a static, and the suites above this one open
		// several — so "nothing was opened" has to start from a cleared slot rather than
		// from whatever ran before it.
		Modal.lastOpened = null;

		openWantedDialog(view, containerEl, '?view=board');
		expect(Modal.lastOpened).toBeNull();

		openWantedDialog(view, containerEl, '?dialog=manual');
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent).toBe('Item types');

		openWantedDialog(view, containerEl, '?dialog=colors');
		// The class is on `contentEl` itself, not on a child of it.
		expect(Modal.lastOpened?.contentEl.hasClass('pbl-state-colors')).toBe(true);

		openWantedDialog(view, containerEl, '?dialog=new');
		expect(Modal.lastOpened?.titleEl.textContent).toContain('New');
	});

	it('runs the quick filter, and draws its empty state when nothing matches', () => {
		const { view, containerEl } = mount();

		applyWantedFilter(view, '?filter=Onboarding');
		expect(containerEl.querySelector('.pbl-match')).not.toBeNull();

		applyWantedFilter(view, '?filter=zzzznothing');
		expect(containerEl.querySelector('.pbl-empty-filter')).not.toBeNull();
	});
});

/**
 * `?phone` is a body class and nothing else, so what is checkable here is the class —
 * which rule then matches is the browser's answer and jsdom computes no linked
 * stylesheet. Worth checking anyway: the knob is spelled once, and a page that quietly
 * set neither class would look exactly like a page whose phone rules had all stopped
 * matching. Both classes, because Obsidian's shell sets both and the vendored sheet's
 * variable block is keyed on the one the plugin's own partials never name.
 */
describe('the page can say it is a phone', () => {
	it('sets both of Obsidian’s phone classes, and takes them off again', () => {
		applyPlatform('?phone');
		expect(document.body.hasClass('is-phone')).toBe(true);
		expect(document.body.hasClass('is-mobile')).toBe(true);

		applyPlatform('?view=board');
		expect(document.body.hasClass('is-phone')).toBe(false);
		expect(document.body.hasClass('is-mobile')).toBe(false);
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
	 * Walk all five projections and both roadmap axes, collecting what `setIcon` was
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
		for (const projection of ['tree', 'board', 'roadmap', 'deliverables', 'catalog'] as const) {
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

	it('draws through the COMPONENT wrappers too, not only the free setIcon', () => {
		// Checked at the component rather than by sweeping the surfaces that use one,
		// because the surfaces are exactly what the sweep above cannot reach: an
		// `ExtraButtonComponent` lives in a Modal, which the mock appends outside
		// `containerEl`. `ExtraButtonComponent.setIcon` set `data-icon` and stopped, so
		// the suite — which installs no renderer and asserts that attribute — was green
		// while every extra-setting button on the page drew as an empty square. Found by
		// looking at the schedule entry's two clear buttons in Chromium, which the
		// acceptance criteria require to be pressable in one press.
		mountHarness(document.body.createDiv());
		const host = document.body.createDiv();
		new ExtraButtonComponent(host).setIcon('x');

		const drawn = host.querySelector('button.extra-setting-button');
		expect(drawn?.getAttribute('data-icon')).toBe('x');
		expect(drawn?.querySelector('svg.svg-icon')).not.toBeNull();
		expect(drawn?.getAttribute('data-icon-missing')).toBeNull();
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
