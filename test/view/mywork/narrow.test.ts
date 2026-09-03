// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeMyWorkView, myWorkVault } from '../../helpers/mywork';

/**
 * `styles/mywork.css` — Task 10 of [[Assigned work in the sidebar]].
 *
 * jsdom lays nothing out (`test/CLAUDE.md`'s own rule), so what is checked here is what
 * the markup PROMISES a container query — the class the rule keys on, and no fixed-width
 * property column to begin with — never a measured pixel. Whether the rule actually
 * narrows anything is answered in the browser harness (`test/harness/mywork.ts`), at
 * three widths, and reported in `task-10-report.md` rather than pretended here.
 */
describe('the my-work panel carries the markup its narrow rules key on', () => {
	it('gives the panel a container the narrow rules can key on', () => {
		const { view } = makeMyWorkView(myWorkVault());
		expect(view.viewEl.classList.contains('pbl-mw-view')).toBe(true);
	});

	it('draws no fixed-width property column', () => {
		const { view } = makeMyWorkView(myWorkVault());
		expect(view.viewEl.querySelector('.pbl-col')).toBeNull();
	});

	it('keeps the person picker in every state that has a roster', () => {
		// It is the one control the panel cannot do without: the way out of "nobody picked".
		const { view } = makeMyWorkView(myWorkVault());
		expect(view.viewEl.querySelector('.pbl-mw-person')).not.toBeNull();
	});
});

/**
 * The one thing jsdom CANNOT answer about a container query is its effect — nothing here
 * lays out a box, so nothing here can show the chip actually narrowing at 260px. What IS
 * answerable from a test is that the rule exists at all, keyed on the right container and
 * the right class, and what it takes and keeps.
 *
 * **What it takes changed on 2026-09-01**, and the reason the earlier rule dropped the
 * whole column went with it: `.pbl-mw-statecol` reserved `inline-size: 92px` at every
 * width, so hiding only the chip left that reservation standing and fixed nothing. The
 * column is content-sized now (the tests above), so the narrow answer is the chip's own
 * TEXT rather than the column: an icon-only chip costs about a fifth of what the reserved
 * column did and still says whether the row is finished, which dropping the column
 * altogether did not.
 */
describe('the narrow-pane rule, read from the stylesheet source', () => {
	// Comments STRIPPED, and that is the instrument rather than tidiness: this file's rules
	// are written beside paragraphs that quote the declaration they replaced, so a
	// `not.toMatch(/display: none/)` read the prose saying why it is not `display: none`
	// and failed on the rule it was checking (caught the moment it was written).
	const css = readFileSync('styles/mywork.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

	it('makes the panel a query container over its own inline size', () => {
		expect(css).toMatch(/\.pbl-mw-view\s*\{[^}]*container-type:\s*inline-size/);
	});

	it('narrows the chip to its icon rather than reserving a column for its text', () => {
		const containerBlock = /@container\s*\(max-width:\s*260px\)\s*\{([\s\S]*?)\n\}/.exec(css);
		expect(containerBlock).not.toBeNull();
		const body = containerBlock?.[1] ?? '';
		// Hidden the `.pbl-sr-only` way — the row's accessible name is derived from its
		// content, so `display: none` here would make the pane's width decide whether a
		// screen reader is told the state at all.
		expect(body).toMatch(/\.pbl-mw-view \.pbl-state-text\s*\{[^}]*clip-path:\s*inset\(50%\)/);
		expect(body).not.toMatch(/\.pbl-state-text\s*\{[^}]*display:\s*none/);
		// Never the column, and never the chip: the icon is what says a row is finished, and
		// a pane that dropped it could only answer that by turning hide-done on.
		expect(body).not.toMatch(/\.pbl-mw-statecol\s*\{[^}]*display:\s*none/);
	});

	/**
	 * Indent is the only term on the row that grows with depth, so halving it moves the
	 * width at which a row runs out of pane rather than closing it — measured at 200px
	 * before the cap: a depth-3 row carrying the Next marker sat 11px past the tree's
	 * edge, and an unmarked depth-5 row within 5px of it.
	 *
	 * Asserted as a CAP RELATIVE TO THE STEP, never as a pixel value: the point of
	 * `2 * var(--pbl-indent)` is that it cannot drift from the step declared above it, and
	 * a test naming a number here would have to be edited every time the step is, which is
	 * how the two would come apart.
	 */
	it('caps the indent so depth cannot push a row out of the pane', () => {
		const containerBlock = /@container\s*\(max-width:\s*260px\)\s*\{([\s\S]*?)\n\}/.exec(css);
		const body = containerBlock?.[1] ?? '';
		expect(body).toMatch(/--pbl-indent:\s*\d+px/);
		expect(body).toMatch(
			/\.pbl-mw-view \.pbl-row\s*\{[^}]*min\([\s\S]*?--pbl-depth[\s\S]*?2 \* var\(--pbl-indent/,
		);
	});

	it('wraps the toolbar rather than clipping it once the column gives way', () => {
		const containerBlock = /@container\s*\(max-width:\s*260px\)\s*\{([\s\S]*?)\n\}/.exec(css);
		const body = containerBlock?.[1] ?? '';
		expect(body).toMatch(/\.pbl-mw-view \.pbl-mw-toolbar\s*\{[^}]*flex-wrap:\s*wrap/);
	});
});

/**
 * Two rules the panel needs at EVERY width, so neither belongs in the container query
 * above — the polish pass of 2026-09-01.
 *
 * The column was a fixed `inline-size: 92px`, which is narrower than the chip's own
 * 140px cap: a state value long enough to matter (`In progress`) was truncated to
 * `In progr…` in a 1000px pane, where there was nothing to save room for. Content-sized
 * and shrinkable, it shows the value in full where there is room and ellipsises where
 * there is not, instead of clipping against the pane's edge.
 *
 * `user-select` is `releaseScope.css`'s own correction, owed here for the identical
 * reason: `.pbl-row` earns its `none` in the backlog tree by DRAGGING its rows, and
 * neither scope tree drags anything. Left unstated the tree's `none` still won the
 * cascade, so a reader could not select a title to copy it — and `renderTree.ts`'s own
 * drag-select guard on the row click (`getSelection()?.isCollapsed === false`) could
 * never be true, which is a guard that reads as protection and is not.
 */
describe('the rules that hold at every width', () => {
	// Comments STRIPPED, and that is the instrument rather than tidiness: this file's rules
	// are written beside paragraphs that quote the declaration they replaced, so a
	// `not.toMatch(/display: none/)` read the prose saying why it is not `display: none`
	// and failed on the rule it was checking (caught the moment it was written).
	const css = readFileSync('styles/mywork.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

	it('sizes the state column to its content rather than reserving a fixed width', () => {
		const block = /\.pbl-mw-statecol\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
		expect(block).toMatch(/flex:\s*0 1 auto/);
		expect(block).not.toMatch(/[^-]inline-size:\s*\d/);
	});

	it('lets a reader select a title, on a tree that drags nothing', () => {
		expect(css).toMatch(/\.pbl-mw-view \.pbl-row\s*\{[^}]*user-select:\s*auto/);
	});

	/**
	 * The floor and the `:empty` exemption are one rule in two halves and neither works
	 * alone: without the floor the column shrinks past the chip inside it and clips the icon
	 * to a sliver (8px of chip at 280px of pane, measured), and without the exemption every
	 * stateless row reserves the floor — the fixed reservation this pass removed, smaller.
	 */
	it('floors the column at the chip’s icon, and only where the row has a chip', () => {
		expect(css).toMatch(/\.pbl-mw-statecol\s*\{[^}]*min-inline-size:\s*22px/);
		expect(css).toMatch(/\.pbl-mw-statecol:empty\s*\{[^}]*min-inline-size:\s*0/);
	});

	it('drops the shared title floor for this pane, at every width', () => {
		// Outside the container query: the deficit it absorbs is largest below 260px and is
		// not zero above it, and the title is the term that costs least either way.
		const query = css.indexOf('@container');
		const rule = css.search(/\.pbl-mw-view \.pbl-title\s*\{[^}]*min-width:\s*0/);
		expect(rule).toBeGreaterThan(-1);
		expect(rule).toBeLessThan(query);
	});

	it('reveals the row menu button on hover, on selection, and always without hover', () => {
		expect(css).toMatch(/\.pbl-row:hover button\.pbl-mw-menu/);
		expect(css).toMatch(/\.pbl-row\.pbl-selected button\.pbl-mw-menu/);
		// The touch rule, and its POSITION: a media query adds no specificity, so it has
		// to come after the `opacity: 0` it undoes.
		expect(css.indexOf('@media (hover: none)')).toBeGreaterThan(css.indexOf('button.pbl-mw-menu {'));
	});
});
