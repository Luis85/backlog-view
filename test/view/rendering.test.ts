// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a build script, deliberately outside tsconfig's `src/**` include.
import { assembleStyles } from '../../scripts/styles-assemble.mjs';
import { FakeVault } from '../helpers/vault';
import { ALL_TYPES, EXTRA_TYPES, MARKER_TYPES } from '../../src/domain/typeVocabulary';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { clickExpandAll, drag, fixture, flush, key, makeView, rowByTitle, rows, titlesOf, treeOf, useViewHarness } from '../helpers/view';
import { inCatalog, ladderFor } from '../../src/domain/itemTypes';

useViewHarness();

/**
 * The stylesheet as shipped. Appearance cannot be tested here, but a rule that was
 * deliberately REMOVED can be kept out — otherwise it comes back unnoticed.
 *
 * Assembled rather than read from disk: the root `styles.css` is a build artifact now
 * (see `styles-assemble.mjs`), so reading the file would test whichever build last ran
 * — or nothing at all on a fresh clone. This runs the same assembler the build does.
 */
const styles: string = assembleStyles();

/**
 * Where the last rule naming `selector` and declaring `decl` starts, or -1. Grouped
 * selector lists count, so the answer is about the CASCADE rather than about how the
 * rule happens to be written — which is the one thing about appearance that is
 * decidable here, with no browser to ask.
 */
function ruleAt(selector: string, decl: string, inMedia?: string): number {
	// Every existing caller starts `selector` with `.`, so a single leading backslash
	// happened to escape the one metacharacter that mattered. `button.pbl-x` does not:
	// an unescaped `\b` in the pattern below is a word-boundary token, not a literal
	// "b", and silently eats the control's element qualifier. Escaping the whole
	// selector is the general fix — a no-op for every prior caller (a `.` escaped twice
	// over matches exactly what an unescaped `.` wildcard already matched).
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`^[\\t]*${escaped}[,\\s][^{]*\\{[^}]*${decl}`, 'gm');
	let found = -1;
	for (const match of styles.matchAll(pattern)) {
		const at = match.index;
		// A nested rule belongs to the nearest @media opened before it.
		const media = styles.lastIndexOf('@media', at);
		const enclosing = media === -1 ? '' : styles.slice(media, styles.indexOf('{', media));
		if (inMedia === undefined || (enclosing.includes(inMedia) && styles.lastIndexOf('\n}', at) < media)) found = at;
	}
	return found;
}

describe('rendering', () => {
	it('styles every declared type — none falls through to bare text', () => {
		// `renderBadge` has no fallback for a declared type, because the vocabulary is
		// fixed and its one table plus the plan's rung icons cover all of it. This is what
		// keeps that true across the table and the stylesheet: add a type without an icon,
		// or a colour class with no CSS rule, and this fails.
		//
		// It is also what catches the KEY, which no colour assertion would report: the
		// lookup lowercases the type name and then requires an exact match, so a style
		// filed under `testSuite` rather than `test suite` is simply never found and the
		// badge renders with no icon and no colour rather than raising anything.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task' }, parentLink: 'PBI' });
		for (const type of [...EXTRA_TYPES, ...MARKER_TYPES]) {
			vault.addFile(`${type}.md`, { frontmatter: { type }, parentLink: 'Epic' });
		}
		// The test types are drawn by the CATALOG and by nothing else, so the badge for
		// each has to be found in the projection that draws it — asking one screen for all
		// eleven is what a plain `ALL_TYPES` loop does, and it fails on the two that are
		// deliberately not in the plan.
		vault.addFile('Test suite.md', { frontmatter: { type: 'Test suite' } });
		vault.addFile('Test case.md', { frontmatter: { type: 'Test case' }, parentLink: 'Test suite' });
		const { containerEl, view } = makeView(vault);

		const seen = new Set<string>();
		for (const type of ALL_TYPES) {
			view.setProjection(inCatalog({ ladder: ladderFor(type, null) }) ? 'catalog' : 'tree');
			clickExpandAll(containerEl);
			const badge = rowByTitle(containerEl, type).querySelector<HTMLElement>('.pbl-badge');
			expect(badge?.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBeTruthy();
			const colour = [...(badge?.classList ?? [])].find((c) => c.startsWith('pbl-lvl-'));
			expect(colour).toBeDefined();
			expect(colour).not.toBe('pbl-lvl-unknown');
			// The class has to be one the shipped stylesheet actually paints, and no two
			// types may share it — a colour is how a rung is told apart at a glance.
			expect(styles).toContain(`.${colour} {`);
			expect(seen.has(colour ?? '')).toBe(false);
			seen.add(colour ?? '');
		}
	});

	it('gives each shipped extra type its own icon and badge colour', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('An issue.md', { frontmatter: { type: 'Issue' }, parentLink: 'Epic' });
		vault.addFile('A bug.md', { frontmatter: { type: 'Bug' }, parentLink: 'Epic' });
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone' } });
		// A type outside the vocabulary keeps its name and gets no icon at all — the
		// bare-text treatment for something this view knows nothing about.
		vault.addFile('A spike.md', { frontmatter: { type: 'Spike' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault);

		const badge = (title: string) => rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-badge');
		const icon = (title: string) =>
			rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon;

		expect(icon('An issue')).toBe('circle-alert');
		expect(icon('A bug')).toBe('bug');

		// Colours are their own rather than a slot after the ladder, and distinct from
		// each other and from every level (0-3).
		expect(badge('An issue')?.classList.contains('pbl-lvl-issue')).toBe(true);
		expect(badge('A bug')?.classList.contains('pbl-lvl-bug')).toBe(true);
		expect(badge('Ship 1.0')?.classList.contains('pbl-lvl-milestone')).toBe(true);
		expect(badge('A spike')?.classList.contains('pbl-lvl-unknown')).toBe(true);
	});

	it('renders a Deliverable with its own badge icon and colour', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const { containerEl } = makeView(vault);

		const badge = rowByTitle(containerEl, 'D').querySelector('.pbl-badge');
		expect(badge?.classList.contains('pbl-lvl-deliverable')).toBe(true);
		expect(badge?.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBe('package');
	});

	it('withholds every create affordance on a row that can hold nothing', () => {
		// Absent, not empty. `addLabel` builds its text from `childTypes[0]`, so an empty
		// list renders "New undefined" and opens a modal with no type to pick — the same
		// answer the context-row rule gives: remove the control rather than let it fail at
		// the end.
		const vault = new FakeVault();
		vault.addFile('An epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone' } });
		const { containerEl } = makeView(vault);

		const row = rowByTitle(containerEl, 'Ship 1.0');
		expect(row.querySelector('.pbl-add')).toBeNull();
		expect(rowByTitle(containerEl, 'An epic').querySelector('.pbl-add')).not.toBeNull();

		row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.filter((t) => t.startsWith('New '))).toEqual([]);
		expect(titles.some((t) => t.includes('undefined'))).toBe(false);
	});

	it("reserves the add button's width on a row that can hold nothing", () => {
		// Everything after `.pbl-row-spacer` is anchored to the row's END, so an element
		// missing from a row's trailing strip does not leave a gap where it was — it shifts
		// every column on that row right by its own width. A marker holds nothing and so
		// renders no add button, which is what displaced a milestone's whole set of columns
		// from the rows above it.
		const vault = new FakeVault();
		vault.addFile('An epic.md', { frontmatter: { type: 'Epic', status: 'Todo' } });
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', status: 'Todo' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const trailing = (title: string): string[] => {
			const kids = [...rowByTitle(containerEl, title).children];
			return kids.slice(kids.findIndex((el) => el.classList.contains('pbl-row-spacer'))).map(() => 'box');
		};
		expect(trailing('Ship 1.0')).toEqual(trailing('An epic'));

		// Reserved, never shown — `visibility`, because the row hover reveals anything
		// that is merely transparent.
		expect(rowByTitle(containerEl, 'Ship 1.0').lastElementChild?.className).toContain('pbl-add-spacer');
		expect(ruleAt('.pbl-add-spacer', 'visibility: hidden;')).toBeGreaterThan(-1);
	});

	it('mutes a done row without striking its title through', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		// Muting is the whole signal; the strike-through said it twice and made a
		// finished item harder to read.
		expect(rowByTitle(containerEl, 'Epic').classList.contains('pbl-done')).toBe(true);
		expect(styles).not.toContain('line-through');
	});

	it('opens the note from the row itself and from none of the controls inside it', () => {
		// The category this replaced ten `stopPropagation` calls to hold. Every one of
		// them was a control remembering to opt out of the row's activation, and two
		// controls forgot — the dependency connector and the bar grips both shipped
		// opening the note when clicked. `fromRowControl` moves the question to the
		// receiver, so a control that forgets is covered anyway.
		//
		// The enumeration is deliberately NOT `ROW_CONTROL`'s own selector, which would
		// only prove the filter agrees with itself: it adds `a` and `[tabindex="-1"]`,
		// the two independent marks of "this is a control" in this codebase — every
		// per-row control carries the latter by the view guide's own rule. What it cannot
		// see is a control that is neither, which is the same gap `ROW_CONTROL` has and
		// is why the guide requires new controls to be buttons.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing', tags: ['alpha'] } });
		vault.addFile('Child.md', { frontmatter: { type: 'Feature', order: 10, parent: 'Epic' } });
		const { containerEl } = makeView(
			vault,
			{ stateProperty: 'note.status', tagsProperty: 'note.tags' },
			{ order: ['note.status', 'note.tags'] },
		);
		const row = rowByTitle(containerEl, 'Epic');

		const controls = Array.from(row.querySelectorAll<HTMLElement>('button, a, [tabindex="-1"], .pbl-tag, .pbl-prop-value'));
		// A fixture that rendered no controls would pass this test having proved nothing.
		expect(controls.length).toBeGreaterThan(1);
		for (const control of controls) {
			control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			control.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
		}
		expect(vault.opened).toEqual([]);

		// The other half, and the one the filter could break: the row is still a link.
		row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic.md']);
	});

	it('reveals every hover-hidden control on a hoverless device, in cascade order', () => {
		// Every one of these is hidden until hover and carries `tabindex="-1"`, so on a
		// device with neither hover nor a tab stop the `hover: none` reveal is the ONLY
		// thing that makes them reachable. A media query adds no specificity, so that
		// reveal has to come after the `opacity: 0` it undoes — written above it, it
		// loses to a same-specificity rule and silently reveals nothing, which is how
		// the bucket button shipped unreachable on touch. The tag buttons switched from
		// display: none (which drops out of flow, growing the auto-width card cell around
		// it on reveal) to this same opacity trade for the same reason.
		//
		// The same four also need a `:focus-visible` reveal, checked here rather than
		// by cascade order: focus can only arrive programmatically (every one is
		// `tabindex="-1"`), and a control that is focused and invisible is worse than
		// one merely always shown. `:focus-visible` outranks the plain-class hide on
		// SPECIFICITY (an extra pseudo-class), so unlike the hover: none reveal it wins
		// regardless of where in the file it is written — the check is only that the
		// rule exists, which is exactly the gap the tag buttons shipped with.
		// The pair is addressed AS WRITTEN, element qualifier and all: `.pbl-bar-connector`
		// is a bare `<button>`, so both halves carry `button` to outrank Obsidian's
		// `button:not(.clickable-icon)` at (0,1,1) — and qualifying only the hide would
		// leave the reveal at (0,1,0), losing to it and hiding the control forever on the
		// devices this whole check exists for. The `:focus-visible` reveal needs no
		// qualifier (an extra pseudo-class already puts it at (0,2,0)), so it is asked of
		// the class alone.
		const focusOf = (selector: string): string => `${selector.replace(/^[a-z]+/, '')}:focus-visible`;
		for (const selector of [
			'.pbl-add',
			'.pbl-bucket-add',
			'.pbl-tag-remove',
			'.pbl-tag-add',
			'button.pbl-bar-connector',
		]) {
			const hides = ruleAt(selector, 'opacity: 0;');
			const reveals = ruleAt(selector, 'opacity: 1;', '(hover: none)');
			const focusReveals = ruleAt(focusOf(selector), 'opacity: 1;');
			expect(hides, `${selector} is expected to be hover-revealed`).toBeGreaterThan(-1);
			expect(reveals, `${selector} needs a hover: none reveal`).toBeGreaterThan(-1);
			expect(reveals, `${selector}'s reveal must come after the rule it overrides`).toBeGreaterThan(hides);
			expect(focusReveals, `${selector} needs a :focus-visible reveal`).toBeGreaterThan(-1);
		}
	});

	it('gives both resize grips a hoverless presentation, since neither is revealed any other way', () => {
		// A 6px strip that paints only on `:hover` is invisible on a phone, and invisible is
		// unusable for a control whose whole affordance is knowing where to press — the
		// tree's other hidden controls are all in a menu as well, and a boundary is not.
		// Both grips widen to a finger-sized target there; the property column's also draws
		// the boundary line the header otherwise has none of, while the timeline's lead
		// column already carries its own border.
		expect(ruleAt('.pbl-col-grip', 'width: 20px;', '(hover: none)')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-col-grip', 'border-inline-end: 2px solid', '(hover: none)')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-timeline-lead-grip', 'width: 20px;', '(hover: none)')).toBeGreaterThan(-1);
		// After the rule each overrides, the ordering `styles/touch.css` states and the
		// hazard that file records: a media query adds no specificity, so a block written
		// above what it changes loses the tie.
		expect(ruleAt('.pbl-col-grip', 'width: 20px;', '(hover: none)')).toBeGreaterThan(ruleAt('.pbl-col-grip', 'width: 6px;'));
		expect(ruleAt('.pbl-timeline-lead-grip', 'width: 20px;', '(hover: none)')).toBeGreaterThan(
			ruleAt('.pbl-timeline-lead-grip', 'width: 6px;'),
		);
	});

	it('reveals the connector on the keyboard-selected row, which is the only reveal that path gets', () => {
		// The three reveals above are a pointer's (`:hover`), a programmatic focus's
		// (`:focus-visible`) and the drag's own (`.is-active`) — and a keyboard user on
		// the dated axis triggers NONE of them. The pane is one tab stop with a roving
		// `aria-activedescendant`, so focus stays on the scroller and the connector,
		// `tabindex="-1"` like every per-row control, never takes it; nothing hovers.
		// Measured in the browser before this was written: arrow-key down twice, the row
		// carries `.pbl-selected` and its connector computes `opacity: 0`.
		//
		// Existence, not cascade order: three classes put this at (0,3,0), so it outranks
		// the (0,1,1) hide wherever it is written — unlike the `hover: none` pair above,
		// whose whole hazard is that they tie.
		expect(ruleAt('.pbl-timeline-row.pbl-selected .pbl-bar-connector', 'opacity: 1;')).toBeGreaterThan(-1);
	});

	it('gives the link drag’s source row a mark of its own, so the class is not decoration', () => {
		// `begin` marks the source row with `pbl-link-source` and EXCLUDES it from the
		// illegal dimming — deliberately, since the preview line comes out of that bar and
		// its connector is the drag's anchor. But the class had no rule anywhere in
		// `styles/`, so the one bar that refuses its own drop was the only refusal on the
		// grid that looked exactly like a legal target. Measured mid-drag in a browser:
		// source `opacity: 1, filter: none`, an illegal row `0.25` and `grayscale(1)`.
		//
		// The class is set by `src/` and asserted by `test/view/linkDrag.test.ts`, and
		// neither of those can see whether anything DRAWS it — which is the whole reason
		// this check is here and reads the stylesheet instead. What it cannot say is that
		// the mark is legible, or that it is distinguishable from `.pbl-drop-over`'s: that
		// is a look, and the two are told apart by dash and weight rather than by anything
		// assertable here.
		expect(ruleAt('.pbl-linking .pbl-link-source .pbl-bar', 'outline:')).toBeGreaterThan(-1);
	});

	it('beats the double-clipped gradient on specificity, not on source order', () => {
		// .pbl-bar-open-start.pbl-bar-open-end is a two-class compound selector —
		// specificity (0,2,0) — which outranks the single-class .pbl-bar-inferred
		// (0,1,0) no matter which rule is written later, unlike the equal-specificity
		// pairs the hover-reveal test above checks by order. jsdom does not compute a
		// cascade winner, so the only thing decidable here is that the override rule's
		// OWN selector matches all three classes — (0,3,0), which beats the two-class
		// gradient by construction rather than by position in the file.
		const override = ruleAt('.pbl-bar-open-start.pbl-bar-open-end.pbl-bar-inferred', 'background: none;');
		expect(override, 'a three-class rule is needed to beat the two-class gradient on specificity').toBeGreaterThan(
			-1,
		);
	});

	it('beats the pinned-band rule on specificity, so the dated axis really unpins them', () => {
		// `.pbl-roadmap .pbl-shelf` etc. (specificity (0,2,0)) pin the shelf, context strip
		// and advisory to the scrollport. On the dated axis that pin must NOT apply — the
		// frame no longer scrolls sideways under them — but `.pbl-roadmap-dates .pbl-shelf`
		// was ALSO (0,2,0), and equal specificity is decided by source order, where the
		// pinning block comes later and wins outright: `position: sticky` and `width:
		// 100cqw` shipped on the dated axis despite the comment beside them claiming
		// otherwise. `.pbl-view` raises the dated block to a three-selector compound —
		// (0,3,0) — which is what actually outranks the pin, by construction rather than
		// by position in the file (jsdom does not compute a cascade winner, so that
		// construction is the only thing decidable here).
		for (const bit of ['.pbl-shelf', '.pbl-roadmap-context', '.pbl-board-advisory']) {
			const unpinned = ruleAt(`.pbl-view.pbl-roadmap-dates ${bit}`, 'position: static;');
			expect(unpinned, `${bit} needs a higher-specificity rule to unpin it on the dated axis`).toBeGreaterThan(-1);
		}
	});

	it('qualifies every button-chrome-stripping control with the element, in ONE rule covering color, background and shadow', () => {
		// Obsidian's `button:not(.clickable-icon)` sets THREE properties — color,
		// background-color and box-shadow — at (0,1,1), which outranks a bare class
		// alone ((0,1,0)) regardless of source order. A control meaning to strip that
		// chrome has to be element-qualified (`button.pbl-x`) to tie and win on source
		// order — the `button.pbl-card-kids-toggle` precedent in cardChildren.css — and
		// that qualification has to sit in the SAME rule as its color/background/shadow,
		// not a second rule restating only the property someone happened to notice: that
		// second shape is exactly what let color slip through for all four of these in
		// review (2026-08-08, e5c63fb) — background-color and box-shadow were restated,
		// color was not, and three "muted" controls rendered at full text strength with
		// a dead no-op hover. This cannot see every control in the stylesheet this rule
		// applies to (that would mean parsing every selector against every
		// button-producing call site, which this regex instrument does not do) — only
		// that these four, the ones the closed issue named, are shaped that way.
		for (const selector of ['button.pbl-state-chip', 'button.pbl-horizon-chip', 'button.pbl-tag-remove', 'button.pbl-card-match']) {
			const color = ruleAt(selector, 'color:');
			const background = ruleAt(selector, 'background-color:');
			const shadow = ruleAt(selector, 'box-shadow:');
			expect(color, `${selector} needs its own color, not Obsidian's`).toBeGreaterThan(-1);
			expect(background, `${selector} needs its own background-color`).toBeGreaterThan(-1);
			expect(shadow, `${selector} needs its own box-shadow`).toBeGreaterThan(-1);
			expect(background, `${selector}'s background-color must live in the SAME rule as its color`).toBe(color);
			expect(shadow, `${selector}'s box-shadow must live in the SAME rule as its color`).toBe(color);
		}
	});

	it('lets pointer events through the milestone line, not through its label', () => {
		// A timeline row sets no `position`, so it paints in the non-positioned layers
		// while .pbl-milestone-line — absolute, with a z-index — paints above them.
		// Hit-testing follows paint order, so the line is the event target wherever it
		// crosses a row: a 2px dead strip per milestone through every row, swallowing
		// the row's activation and context menu. jsdom does no hit-testing, so the
		// decidable fact is that the declaration is there. The label must NOT have it —
		// it is the only thing carrying the milestone's name on hover.
		expect(ruleAt('.pbl-milestone-line', 'pointer-events: none;'), 'the line must not eat row clicks').toBeGreaterThan(
			-1,
		);
		expect(ruleAt('.pbl-milestone-label', 'pointer-events: none;'), 'the label must stay hoverable').toBe(-1);
	});

	it('leaves an inferred bar unclosed at an end it has no date for', () => {
		// The open-end cue is a background gradient, and `background: none` is what
		// makes an inferred bar an outline — same specificity, so the outline wins and
		// the fade is gone. An outline says "continues" by not closing that side, and
		// each rule needs both classes (0,2,0) to beat .pbl-bar-open-* on its own.
		// This is the ordinary case: a backlog stating targets and no starts infers
		// every parent's end and leaves every start open.
		for (const [side, edge] of [
			['start', 'border-left: none;'],
			['end', 'border-right: none;'],
		]) {
			const rule = ruleAt(`.pbl-bar-inferred.pbl-bar-open-${side}`, edge);
			expect(rule, `an inferred bar open at its ${side} must not close that side`).toBeGreaterThan(-1);
		}
	});

	it('renders the hierarchy with badges, depths and tree semantics', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(treeOf(containerEl).getAttribute('role')).toBe('tree');

		const epicRow = rowByTitle(containerEl, 'Epic A');
		expect(epicRow.getAttribute('aria-level')).toBe('1');
		expect(epicRow.getAttribute('aria-posinset')).toBe('1');
		expect(epicRow.getAttribute('aria-setsize')).toBe('2');
		expect(epicRow.style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(epicRow.querySelector('.pbl-badge')?.textContent).toBe('Epic');
		expect(epicRow.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBe('crown');
		// The grip is a pointer affordance only — the row itself is draggable
		expect(epicRow.querySelector('.pbl-grip')?.getAttribute('aria-hidden')).toBe('true');

		const featureRow = rowByTitle(containerEl, 'Feature B1');
		expect(featureRow.getAttribute('aria-level')).toBe('2');
		expect(featureRow.getAttribute('aria-posinset')).toBe('1');
		expect(featureRow.getAttribute('aria-setsize')).toBe('2');
		expect(featureRow.style.getPropertyValue('--pbl-depth')).toBe('1');
		expect(featureRow.querySelector('.pbl-badge')?.textContent).toBe('Feature');

		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('true');
	});

	it('shows the empty state with a create button when nothing matches', () => {
		const { containerEl } = makeView(new FakeVault());
		expect(containerEl.querySelector('.pbl-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-icon')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
		expect(containerEl.querySelector('.pbl-empty button')?.textContent).toContain('New Epic');
	});

	it('renders progress rollups and done styling when a state property is set', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 20, status: 'Open' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const epicRow = rowByTitle(containerEl, 'Epic');
		expect(epicRow.querySelector('.pbl-progress-label')?.textContent).toBe('1/2');
		expect(epicRow.querySelector<HTMLElement>('.pbl-progress-fill')?.style.getPropertyValue('--pbl-progress')).toBe('50%');
		expect(epicRow.querySelector('.pbl-progress')?.classList.contains('pbl-complete')).toBe(false);
		expect(rowByTitle(containerEl, 'F1').classList.contains('pbl-done')).toBe(true);
		expect(rowByTitle(containerEl, 'F2').classList.contains('pbl-done')).toBe(false);
	});

	it('marks a fully done rollup as complete', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const progress = rowByTitle(containerEl, 'Epic').querySelector('.pbl-progress');
		expect(progress?.classList.contains('pbl-complete')).toBe(true);
	});

	it('re-roots on the focus level and labels the New button accordingly', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { focus: 'Feature' });

		expect(titlesOf(containerEl)).toEqual(['Feature B1', 'Feature B2']);
		expect(rowByTitle(containerEl, 'Feature B1').style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(containerEl.querySelector('.pbl-new-btn')?.textContent).toContain('New Feature');
	});

	it('picks the focus level from the toolbar', () => {
		const { containerEl, config } = makeView(fixture());

		const btn = containerEl.querySelector<HTMLElement>('.pbl-focus-btn');
		expect(btn?.textContent).toContain('All types');
		// Nothing is focused, so there is nothing to clear
		expect(containerEl.querySelector('.pbl-focus-clear')).toBeNull();

		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// Read off the vocabulary rather than hand-listed, so a name added to it is a
		// failing test rather than an entry a saved view can hold and no user can pick —
		// minus the test types, which this picker must never offer: focusing one narrows
		// the PLAN to roots it excludes and leaves it empty, the same reason `Deliverable`
		// is withheld on the requirements board.
		const planTypes = ALL_TYPES.filter((t) => !inCatalog({ ladder: ladderFor(t, null) }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['All types', ...planTypes]);
		expect(Menu.lastShown?.item('All types')?.checked).toBe(true);
		Menu.lastShown?.item('Feature')?.click();
		// Working position, not configuration: the pick re-roots the tree itself, since
		// no Bases refresh follows a `.base` the view deliberately did not write to.
		expect(titlesOf(containerEl)).toEqual(['Feature B1', 'Feature B2']);
		expect(config.setCalls.some((c) => c.key === 'focusLevel')).toBe(false);
	});

	it('shows the active focus level with a one-click way back to all levels', () => {
		const { containerEl, config } = makeView(fixture(), {}, { focus: 'Feature' });

		const focusEl = containerEl.querySelector<HTMLElement>('.pbl-focus');
		expect(focusEl?.classList.contains('pbl-focus-active')).toBe(true);
		expect(focusEl?.querySelector('.pbl-focus-btn')?.textContent).toContain('Feature');
		containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.item('Feature')?.checked).toBe(true);

		containerEl
			.querySelector<HTMLElement>('.pbl-focus-clear')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toContain('Epic A');
		expect(containerEl.querySelector('.pbl-focus-btn')?.textContent).toContain('All types');
		expect(config.setCalls.some((c) => c.key === 'focusLevel')).toBe(false);
	});

	it('marks child groups with their parent depth for indent guides', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const group = rowByTitle(containerEl, 'Feature B1').parentElement;
		expect(group?.classList.contains('pbl-children')).toBe(true);
		expect(group?.style.getPropertyValue('--pbl-depth')).toBe('0');
	});

	it('warns about corrupt configuration and blocks writes', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });

		expect(containerEl.querySelector('.pbl-config-warning')).not.toBeNull();

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();
		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('blocks item creation while the configuration is corrupt', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });
		const fileCount = vault.files.size;

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
		expect(vault.files.size).toBe(fileCount);
		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('row columns', () => {
	function statedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('A very long feature title indeed.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Done' },
			parentLink: 'Epic',
		});
		vault.addFile('Short.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		return vault;
	}

	it('puts the state chip in a cell of the column strip, after the flexible spacer', () => {
		const { containerEl } = makeView(statedVault(), { stateProperty: 'note.status' }, { order: ['note.status'] });

		for (const row of rows(containerEl)) {
			const cell = row.querySelector('.pbl-prop-state');
			expect(cell).not.toBeNull();
			expect(cell?.querySelector('.pbl-state-chip')).not.toBeNull();
			// The spacer absorbs the free space, so the strip lands at a fixed offset
			expect(cell?.parentElement?.previousElementSibling?.classList.contains('pbl-row-spacer')).toBe(true);
		}
	});

	it('gives every row a rollup column, even leaves, so the columns line up', () => {
		const { containerEl } = makeView(statedVault(), { stateProperty: 'note.status' }, { order: ['note.status'] });

		const epic = rowByTitle(containerEl, 'Epic');
		const leaf = rowByTitle(containerEl, 'Short');
		expect(epic.querySelector('.pbl-meta-col .pbl-progress-label')?.textContent).toBe('1/2');
		expect(leaf.querySelector('.pbl-meta-col')).not.toBeNull();
		expect(leaf.querySelector('.pbl-progress')).toBeNull();
		// The rollup is pinned past the END of the column strip, wherever that ends.
		expect(epic.querySelector('.pbl-props')?.nextElementSibling).toBe(epic.querySelector('.pbl-meta-col'));
	});

	it('drops both when neither the property nor the counts are shown', () => {
		const { containerEl } = makeView(statedVault(), { showCounts: false });
		const epic = rowByTitle(containerEl, 'Epic');
		expect(epic.querySelector('.pbl-state-chip')).toBeNull();
		expect(epic.querySelector('.pbl-meta-col')).toBeNull();
	});
});

describe('targeted subtree rendering', () => {
	it('collapses and expands without rebuilding the rest of the tree', () => {
		const { containerEl } = makeView(fixture());
		const epicA = rowByTitle(containerEl, 'Epic A');
		const epicB = rowByTitle(containerEl, 'Epic B');
		const chevron = epicB.querySelector<HTMLElement>('.pbl-chevron');

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(epicB.getAttribute('aria-expanded')).toBe('false');
		expect(chevron?.classList.contains('pbl-expanded')).toBe(false);
		// Untouched rows keep their identity — the tree was not rebuilt
		expect(rowByTitle(containerEl, 'Epic A')).toBe(epicA);
		expect(rowByTitle(containerEl, 'Epic B')).toBe(epicB);

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(epicB.getAttribute('aria-expanded')).toBe('true');
		expect(rowByTitle(containerEl, 'Epic A')).toBe(epicA);
	});

	it('keeps re-expanded children fully interactive', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// A rebuilt child row must still open, drag and rank like any other
		const b2 = rowByTitle(containerEl, 'Feature B2');
		b2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B2.md']);

		drag(b2, rowByTitle(containerEl, 'Feature B1'), 'before');
		await flush();
		// Ranked ahead of Feature B1 (order 10), a full spacing below it
		expect(vault.fm('Feature B2.md').order).toBe(0);
	});

	it('drops the collapsed subtree from the selection index', () => {
		const { view, containerEl } = makeView(fixture());
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Feature B1.md') as never);
		expect(tree.getAttribute('aria-activedescendant')).not.toBeNull();

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The selected row is gone; nothing may point at a detached element
		expect(tree.getAttribute('aria-activedescendant')).toBeNull();
	});
});
