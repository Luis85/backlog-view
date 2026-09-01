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
 * lays out a box, so nothing here can show the state column actually vanishing at 260px.
 * What IS answerable from a test is that the rule exists at all, keyed on the right
 * container and the right class, and that it collapses the COLUMN rather than merely the
 * chip inside it — `.pbl-mw-statecol` reserves `inline-size: 92px` at every width
 * otherwise, so hiding only `.pbl-state-chip` would leave that reservation standing and
 * fix nothing (the confirmed finding this task exists to close).
 */
describe('the narrow-pane rule, read from the stylesheet source', () => {
	const css = readFileSync('styles/mywork.css', 'utf8');

	it('makes the panel a query container over its own inline size', () => {
		expect(css).toMatch(/\.pbl-mw-view\s*\{[^}]*container-type:\s*inline-size/);
	});

	it('collapses the state column itself under the container query, not only the chip', () => {
		const containerBlock = /@container\s*\(max-width:\s*260px\)\s*\{([\s\S]*?)\n\}/.exec(css);
		expect(containerBlock).not.toBeNull();
		const body = containerBlock?.[1] ?? '';
		expect(body).toMatch(/\.pbl-mw-view \.pbl-mw-statecol\s*\{[^}]*display:\s*none/);
	});

	it('wraps the toolbar rather than clipping it once the column gives way', () => {
		const containerBlock = /@container\s*\(max-width:\s*260px\)\s*\{([\s\S]*?)\n\}/.exec(css);
		const body = containerBlock?.[1] ?? '';
		expect(body).toMatch(/\.pbl-mw-view \.pbl-mw-toolbar\s*\{[^}]*flex-wrap:\s*wrap/);
	});
});
