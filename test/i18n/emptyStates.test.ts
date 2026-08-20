// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { en } from '../../src/i18n/en';
import { Catalog, setLocale } from '../../src/i18n/t';
import { boardVault } from '../helpers/board';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, noOptionalProperties, projectionButton, useViewHarness } from '../helpers/view';

installObsidianDom();
useViewHarness();

/**
 * What the view says when it has nothing to show, driven under a catalog that is not
 * English — `src/view/render/emptyStates.ts`, swept 2026-08-20.
 *
 * The same construction `test/i18n/sweptSurfaces.test.ts` uses and for the same reason:
 * against the shipped registry `t('emptyState.noItems')` and a literal `'No backlog
 * items'` render the same string, so every assertion elsewhere in the suite reads
 * identically whether the call site was swept or missed. Overriding the keys is what makes
 * the difference visible.
 *
 * It is the runtime half of a pair whose lint half is NARROWER here than in `ui/` and
 * `commands/`. This file spells no `setName` and no `new Notice`, so `UI_TEXT_LITERAL`
 * would have caught nothing in it; `UI_TEXT_PROPERTY` in `eslint.config.mjs` covers the
 * `text:`/`label:` properties it does use, and a prose literal handed to `guidanceShell`
 * as an argument is caught by neither. That third shape is this file's alone to hold.
 */

/**
 * Every key the module spells. The value is English behind a marker, so a parameter's own
 * text is untouched and `{name}` substitution still happens; what is asserted is the
 * marker, never the wording after it.
 *
 * `emptyState.loading` is overridden and read back through a hand-built view, because it
 * renders only in the gap between construction and the first result set — the one state
 * `makeView` cannot be in.
 */
const SWEPT = [
	'emptyState.loading',
	'emptyState.noItems',
	'emptyState.noTypeItems',
	'emptyState.newItem',
	'emptyState.whatShowsHere',
	'emptyState.focusedHint',
	'emptyState.filterHint',
	'emptyState.ignored',
	'emptyState.noTests',
	'emptyState.noTestsBody',
	'emptyState.whatIsSuite',
	'emptyState.noWorkflow',
	'emptyState.noWorkflowBody',
	'emptyState.noDeliverableWorkflow',
	'emptyState.noDeliverableWorkflowBody',
	'emptyState.excludedFocus',
	'emptyState.excludedFocusBody',
	'emptyState.showAllTypes',
	'emptyState.noDeliverables',
	'emptyState.noDeliverablesBody',
	'emptyState.noAxis',
	'emptyState.noAxisBody',
	'emptyState.addDefaults',
	'emptyState.allDone',
	'emptyState.showCompleted',
] as const;

const MARK = 'XX ';
const xx: Catalog = Object.fromEntries(
	SWEPT.map((key) => {
		const entry = en[key];
		return [key, typeof entry === 'string' ? MARK + entry : Object.fromEntries(Object.entries(entry).map(([f, v]) => [f, MARK + v]))];
	}),
);

beforeEach(() => setLocale('xx', { xx }));
// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

const titleOf = (el: HTMLElement): string => el.querySelector('.pbl-empty-title')?.textContent ?? '';
const hintOf = (el: HTMLElement): string => el.querySelector('.pbl-empty-hint')?.textContent ?? '';

/**
 * Every piece of text the empty state drew, in one list — the titles, the hints, the
 * buttons and the manual link alike.
 *
 * Asked as a WHOLE rather than selector by selector: the failure this file exists to catch
 * is a call site left spelling its own English, and naming the selectors would only ever
 * check the ones somebody remembered. A string with no marker in front of it is that
 * failure wherever in the frame it was drawn.
 */
function drawnText(el: HTMLElement): string[] {
	const parts: string[] = [];
	for (const node of Array.from(el.querySelectorAll('.pbl-empty, .pbl-empty-filter, .pbl-loading'))) {
		for (const child of Array.from(node.querySelectorAll('div, button, a'))) {
			// Only the leaves: an ancestor's textContent is its children concatenated, which
			// would report a marked string for a frame holding one unmarked child.
			if (child.querySelector('div, button, a')) continue;
			const text = child.textContent?.trim() ?? '';
			if (text !== '') parts.push(text);
		}
	}
	return parts;
}

/** Every string the frame drew came from the catalog — nothing was spelled at its call site. */
function expectAllMarked(el: HTMLElement): void {
	const drawn = drawnText(el);
	expect(drawn.length).toBeGreaterThan(0);
	expect(drawn.filter((text) => !text.startsWith(MARK))).toEqual([]);
}

describe('the tree empty states read their own text from the catalog', () => {
	it('renders the loading state from it, before any result set arrives', () => {
		const containerEl = document.body.createDiv();
		new ProductBacklogView({} as never, containerEl);
		expect(containerEl.querySelector('.pbl-loading')?.textContent).toBe(MARK + en['emptyState.loading']);
	});

	it('renders the empty tree from it — title, hint, creation button and manual link', () => {
		const { containerEl } = makeView(fixture({ empty: true }));

		expect(titleOf(containerEl)).toBe(MARK + en['emptyState.noItems']);
		// The type name is DATA and arrives as a parameter, so it survives the override
		// untranslated in the middle of a marked sentence.
		expect(hintOf(containerEl)).toContain('Epic');
		expectAllMarked(containerEl);
	});

	it('renders the focused empty tree from a key of its own, not the unfocused one', () => {
		const { containerEl } = makeView(fixture({ empty: true }), {}, { focus: 'Feature' });

		expect(titleOf(containerEl)).toBe(MARK + en['emptyState.noTypeItems'].replace('{type}', 'Feature'));
		expect(hintOf(containerEl)).toBe(MARK + en['emptyState.focusedHint'].replaceAll('{type}', 'Feature'));
		expectAllMarked(containerEl);
	});

	it('renders the all-done state and its way back from it', () => {
		// `showCompleted` defaults to TRUE, so nothing is hidden without turning it off and
		// this state never draws.
		const { containerEl } = makeView(fixture({ allDone: true }), { stateProperty: 'note.status', showCompleted: false });

		expect(containerEl.querySelector('.pbl-empty-filter')?.textContent).toContain(MARK);
		expectAllMarked(containerEl);
	});

	it('renders the empty test catalog from it, body and both links alike', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault);
		projectionButton(containerEl, 'Show as test catalog').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titleOf(containerEl)).toBe(MARK + en['emptyState.noTests']);
		// Both type names arrive as parameters; only the sentence around them is marked.
		expect(hintOf(containerEl)).toContain('Test suite');
		expect(hintOf(containerEl)).toContain('Test case');
		expectAllMarked(containerEl);
	});
});

describe('the card-projection empty states read their own text from the catalog', () => {
	it('renders the board with no workflow from it, guidance and setup button alike', () => {
		const harness = makeView(boardVault(), {});
		harness.view.setProjection('board');

		expect(titleOf(harness.containerEl)).toBe(MARK + en['emptyState.noWorkflow']);
		expect(hintOf(harness.containerEl)).toBe(MARK + en['emptyState.noWorkflowBody']);
		expectAllMarked(harness.containerEl);
	});

	it('renders the Deliverables board with no workflow from keys of its own', () => {
		const harness = makeView(boardVault(), {});
		harness.view.setProjection('deliverables');

		// A separate key from the requirements board's, though the English is identical —
		// `en.ts`'s own rule: two keys holding the same text must not be deduplicated.
		expect(titleOf(harness.containerEl)).toBe(MARK + en['emptyState.noDeliverableWorkflow']);
		expect(hintOf(harness.containerEl)).toBe(MARK + en['emptyState.noDeliverableWorkflowBody']);
		expectAllMarked(harness.containerEl);
	});

	it('renders the configured-but-empty Deliverables board from it', () => {
		const harness = makeView(boardVault(), { deliverableStateProperty: 'note.deliverableStatus' });
		harness.view.setProjection('deliverables');

		expect(titleOf(harness.containerEl)).toBe(MARK + en['emptyState.noDeliverables']);
		expect(hintOf(harness.containerEl)).toBe(MARK + en['emptyState.noDeliverablesBody'].replace('{type}', 'Deliverable'));
		expectAllMarked(harness.containerEl);
	});

	it('renders the board under a focus it cannot honour from it, button included', () => {
		const harness = makeView(
			boardVault(),
			{ stateProperty: 'note.status', stateValues: 'New, Done' },
			{ focus: 'Deliverable' },
		);
		harness.view.setProjection('board');

		expect(titleOf(harness.containerEl)).toBe(MARK + en['emptyState.excludedFocus']);
		expect(hintOf(harness.containerEl)).toBe(MARK + en['emptyState.excludedFocusBody'].replace('{type}', 'Deliverable'));
		expectAllMarked(harness.containerEl);
	});

	it('renders the roadmap with no axis from it', () => {
		const harness = makeView(fixture(), noOptionalProperties({}));
		harness.view.setProjection('roadmap');

		expect(titleOf(harness.containerEl)).toBe(MARK + en['emptyState.noAxis']);
		expectAllMarked(harness.containerEl);
	});
});

/**
 * The one control the guidance frames share, and the reason it gets a test of its own: it
 * is drawn by `renderSetupCta`, which three callers reach and which is withheld unless
 * something is adoptable — so a literal there would have shown in exactly the frames the
 * assertions above cannot force it into.
 */
describe('the setup call to action reads its label from the catalog', () => {
	it('names the press from it wherever a frame offers one', () => {
		const harness = makeView(boardVault(), { stateProperty: undefined });
		harness.view.setProjection('board');

		const cta = harness.containerEl.querySelector('.pbl-empty button');
		expect(cta?.textContent).toBe(MARK + en['emptyState.addDefaults']);
	});
});
