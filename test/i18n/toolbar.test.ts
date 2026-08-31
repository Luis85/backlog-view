// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, MessageKey, setLocale } from '../../src/i18n/t';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault, setResults } from '../helpers/vault';
import { boardVault, makeBoard } from '../helpers/board';
import { horizonVault, makeRoadmap, roadmapView } from '../helpers/roadmap';
import { fixture, makeView, useViewHarness } from '../helpers/view';
import { MARK, markedCatalog } from './fixtures';

/**
 * The toolbar row, driven under a catalog that is not English — `render/toolbar.ts`,
 * `toolbarControls.ts`, `toolbarBusy.ts` and `toolbarStatus.ts`, swept 2026-08-20.
 *
 * The construction its three sibling files use, for their reason: against the shipped
 * registry `t('toolbar.expandAll')` and a literal `'Expand all'` render the same string,
 * so every other assertion in the suite reads identically whether the call site was swept
 * or missed. Overriding the keys is what makes the difference visible.
 *
 * **It asks the CATEGORY, `menus.test.ts`'s question rather than `emptyStates.test.ts`'s.**
 * A toolbar is a row of controls, so naming the ones somebody remembered checks exactly
 * the controls that already work: the next one added is the one nobody named. Every
 * surface below is therefore DRAINED — every visible word, every `aria-label`, every
 * tooltip — and what is asserted is that the unmarked remainder is exactly the DATA this
 * row shows. A new English literal joins that remainder and fails; a data value wrongly
 * keyed leaves it and fails too, which is the direction this epic has had to correct
 * twice.
 *
 * It is the runtime half of a pair. `UI_TEXT_LITERAL` and `UI_TEXT_PROPERTY` in
 * `eslint.config.mjs` refuse a NEW literal at the spellings they can see; this file says
 * the calls that replaced the old ones reach the catalog at all. Neither covers what the
 * other does — lint cannot tell whether a key is READ, and no test can see a call site
 * nobody has written yet. What lint reaches here is narrower than in the menu directory:
 * these modules build controls through `createEl` option bags and through `iconButton`,
 * whose label is a positional ARGUMENT that neither selector can see. That shape is this
 * file's alone to hold.
 */

useViewHarness();

/**
 * Every key this slice owns, computed against `en.ts` rather than kept by hand —
 * `menus.test.ts`'s discipline, and one namespace is what makes it exact: a key added to
 * `toolbar.*` is in this list without anyone editing it.
 */
const OWN = Object.keys(en).filter((key): key is MessageKey => key.startsWith('toolbar.'));

/**
 * The one key this row READS without owning. The item count is `count.items`, minted for
 * the bare count that also stands alone elsewhere; taking it rather than a `toolbar.*`
 * twin is the codebase's own rule about two surfaces over one reading.
 */
const REUSED = ['count.items', 'config.fixAll'] as const;

const SWEPT: MessageKey[] = [...OWN, ...REUSED];

const xx: Catalog = markedCatalog(SWEPT);

const marked = (key: MessageKey): string => {
	const entry = en[key];
	if (typeof entry !== 'string') throw new Error(`${key} is a plural entry; assert its form directly`);
	return MARK + entry;
};

/**
 * Every marked string this file watched reach a surface, accumulated across the whole run
 * and audited by the last test. Module state on purpose: the audit's question is about
 * the file, not about any one test in it.
 */
const seen = new Set<string>();

const record = (strings: readonly string[]): string[] => {
	for (const text of strings) if (text.startsWith(MARK)) seen.add(text);
	return strings.slice();
};

beforeEach(() => {
	Menu.forget();
	setLocale('xx', { xx });
});
// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

const barOf = (containerEl: HTMLElement): HTMLElement => {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('no toolbar rendered');
	return bar;
};

/**
 * Every string the row puts in front of a reader, sighted or not: the visible words of
 * each leaf element, plus every `aria-label` and every tooltip. All three, because the
 * acceptance criterion is that screen-reader text moves WITH the visible text — a row
 * translated for sighted users only passes any check that reads `textContent` alone.
 */
function drawnText(bar: HTMLElement): string[] {
	const out: string[] = [];
	for (const el of bar.querySelectorAll<HTMLElement>('*')) {
		const label = el.getAttribute('aria-label');
		if (label) out.push(label);
		if (el.dataset.tooltip) out.push(el.dataset.tooltip);
		if (el.childElementCount === 0 && el.textContent) out.push(el.textContent);
	}
	return record(out);
}

/** Every title a menu draws, following submenus — the whole of what the reader sees. */
function titlesOf(menu: Menu): string[] {
	const out: string[] = [];
	for (const item of menu.items) {
		out.push(item.titleText);
		if (item.submenu) out.push(...titlesOf(item.submenu));
	}
	return record(out);
}

const unmarked = (strings: readonly string[]): string[] => [
	...new Set(strings.filter((text) => !text.startsWith(MARK))),
];

/** Open the control this selector names, and hand back the menu it showed. */
function open(bar: HTMLElement, selector: string): Menu {
	Menu.forget();
	const btn = bar.querySelector<HTMLElement>(selector);
	if (!btn) throw new Error(`no toolbar control at ${selector}`);
	btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error(`no menu opened from ${selector}`);
	return menu;
}

/**
 * By its focus key where it has an explicit one, and by CLASS where its key defaults to
 * the label — which the catalog now supplies, so a selector spelling English would find
 * nothing here.
 */
const openFrom = (bar: HTMLElement, key: string): Menu => open(bar, `[data-pbl-key="${key}"]`);
const openByClass = (bar: HTMLElement, cls: string): Menu => open(bar, `.${cls}`);

describe('the toolbar row reads its own text from the catalog', () => {
	it('draws the tree row from it — every label, tooltip and visible word', () => {
		const { containerEl } = makeView(fixture());
		const drawn = drawnText(barOf(containerEl));

		expect(drawn).toContain(marked('toolbar.expandAll'));
		expect(drawn).toContain(marked('toolbar.undo'));
		expect(drawn).toContain(marked('toolbar.openManual'));
		expect(drawn).toContain(marked('toolbar.assignMissing'));
		expect(drawn).toContain(marked('toolbar.overflow'));
		expect(drawn).toContain(marked('toolbar.projection'));
		expect(drawn).toContain(marked('toolbar.allTypes'));
		// The type name is DATA and arrives as a parameter, so it survives the override
		// untranslated inside a marked sentence.
		expect(drawn).toContain(MARK + 'New Epic');
		// Nothing on an ordinary tree row is spelled at its call site.
		expect(unmarked(drawn)).toEqual([]);
	});

	it('names the focused tree from a key of its own, with the type as the parameter', () => {
		const { containerEl } = makeView(fixture(), {}, { focus: 'Feature' });
		const drawn = drawnText(barOf(containerEl));

		expect(drawn).toContain(MARK + en['toolbar.focusOn'].replace('{type}', 'Feature'));
		expect(drawn).toContain(marked('toolbar.showAllTypes'));
		// The focus button's own visible word is the type, which is the vault's and not
		// this catalog's — the whole of what a focused row leaves unmarked.
		expect(unmarked(drawn)).toEqual(['Feature']);
	});

	it('draws the completed toggle from three whole keys rather than a counted suffix', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' }, { hideCompleted: true });
		const drawn = drawnText(barOf(containerEl));

		expect(drawn).toContain(MARK + en['toolbar.showCompletedHidden'].replace('{count}', '1'));
		expect(drawn).not.toContain(marked('toolbar.showCompleted'));
	});

	it('draws the item count and its breakdown from the catalog, over the vault own words', () => {
		const { containerEl } = makeView(fixture());
		const drawn = drawnText(barOf(containerEl));

		expect(drawn).toContain(MARK + en['count.items'].other.replace('{count}', '4'));
		// The breakdown is one key per reading, so the type names it counts are the only
		// unmarked text in it — and they arrive as parameters inside marked sentences.
		const tooltip = barOf(containerEl).querySelector<HTMLElement>('.pbl-count-label')?.dataset.tooltip ?? '';
		expect(tooltip).toContain(MARK + '2 Epic');
		expect(tooltip).toContain(MARK + '2 Feature');
	});
});

describe('every projection draws its own controls from the catalog', () => {
	it('draws the board scope picker and its menu from it', () => {
		const { containerEl } = makeBoard(boardVault());
		const bar = barOf(containerEl);
		const drawn = drawnText(bar);

		expect(drawn).toContain(MARK + en['toolbar.scopeAria'].replace('{scope}', marked('toolbar.scopeProduct')));
		expect(drawn).toContain(marked('toolbar.scopeTooltip'));

		const titles = titlesOf(openFrom(bar, 'scope'));
		expect(titles).toContain(marked('toolbar.scopeProduct'));
		expect(titles).toContain(marked('toolbar.scopeDeliverables'));
		// No iteration property, so the menu is the two board names and nothing else.
		expect(unmarked([...drawn, ...titles])).toEqual([]);
	});

	it('draws the roadmap zone from it — the axis picker, its menu and the bucket toggle', () => {
		const { containerEl } = makeRoadmap(horizonVault(), { startProperty: 'note.start', targetProperty: 'note.due' });
		const bar = barOf(containerEl);
		const drawn = drawnText(bar);

		expect(drawn).toContain(MARK + en['toolbar.axisAria'].replace('{axis}', marked('toolbar.axisHorizons')));
		expect(drawn).toContain(marked('toolbar.axisTooltip'));
		expect(drawn).toContain(marked('toolbar.bucketGrid'));

		const titles = titlesOf(openFrom(bar, 'axis'));
		expect(titles).toContain(marked('toolbar.axisHorizons'));
		expect(titles).toContain(marked('toolbar.axisDates'));
		expect(unmarked([...drawn, ...titles])).toEqual([]);
	});

	it('draws the dated axis controls from it — the zoom, its menu, density and today', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-20' } });
		const { containerEl } = roadmapView(vault, { startProperty: 'note.start', targetProperty: 'note.due' });
		const bar = barOf(containerEl);
		const drawn = drawnText(bar);

		expect(drawn).toContain(marked('toolbar.compactRows'));
		expect(drawn).toContain(marked('toolbar.jumpToToday'));
		expect(drawn).toContain(MARK + en['toolbar.zoomAria'].replace('{zoom}', marked('toolbar.zoomMonth')));

		const titles = titlesOf(openFrom(bar, 'zoom'));
		expect(titles).toContain(marked('toolbar.zoomWeek'));
		expect(titles).toContain(marked('toolbar.zoomQuarter'));
		expect(unmarked([...drawn, ...titles])).toEqual([]);
	});

	it('names the inert focus control from the projection it stands on, type as parameter', () => {
		const { containerEl, view } = makeBoard(boardVault());
		view.setProjection('deliverables');
		const drawn = drawnText(barOf(containerEl));

		// The LABEL names the board, so it is this catalog's word; the tip names the
		// `type:` value beside it, so that arrives as a parameter and stays English.
		expect(drawn).toContain(marked('toolbar.focusDeliverablesLabel'));
		expect(drawn).toContain(MARK + en['toolbar.focusDeliverablesTip'].replace('{type}', 'Deliverable'));
		expect(unmarked(drawn)).toEqual([]);
	});
});

describe('the advisories and the projections nobody else drives read from it too', () => {
	it('draws the ignored-note advisory and the config warning from the catalog', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		// No type and no parent, so the model counts it ignored rather than as an item.
		vault.addFile('Loose.md', { frontmatter: { note: 'nothing' } });
		// Two owned properties on one key is a configuration the view refuses to guess at.
		const { containerEl } = makeView(vault, { parentProperty: 'note.rank', orderProperty: 'note.rank' });
		const drawn = drawnText(barOf(containerEl));

		expect(drawn).toContain(MARK + en['toolbar.ignoredNotes'].one.replace('{count}', '1'));
		expect(drawn).toContain(MARK + en['toolbar.ignoredTooltip'].one.replace('{count}', '1'));
		expect(drawn).toContain(marked('toolbar.checkViewOptions'));
		expect(drawn).toContain(marked('toolbar.configHelp'));
		// The warning's accessible name is ONE sentence from the catalog with the problems
		// listed inside it, not the fragments joined at the call site. The fragment itself
		// is `domain/`'s and is unmarked here, which is what makes the marked frame visible.
		expect(containerEl.querySelector('.pbl-config-warning')?.getAttribute('aria-label')).toBe(
			MARK + 'Fix the view options first: the parent and order properties share the key "rank".',
		);
	});

	it('names the test catalog and the iteration board from their own keys', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('In sprint.md', { frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]' } });
		const { containerEl, view } = makeView(vault, { iterationProperty: 'note.iteration' });

		view.setProjection('catalog');
		expect(drawnText(barOf(containerEl))).toContain(marked('toolbar.focusCatalogLabel'));
		expect(drawnText(barOf(containerEl))).toContain(marked('toolbar.focusCatalogTip'));

		view.setProjection('board');
		// The iteration entries and the two dialog doors are the picker's, and they draw
		// only once an iteration property is named.
		const titles = titlesOf(openFrom(barOf(containerEl), 'scope'));
		expect(titles).toContain(marked('toolbar.newIteration'));
		expect(unmarked(titles)).toEqual(['Sprint 12']);

		view.setBoardScope('Sprint 12.md');
		const onIteration = drawnText(barOf(containerEl));
		expect(onIteration).toContain(marked('toolbar.focusIterationLabel'));
		expect(onIteration).toContain(marked('toolbar.focusIterationTip'));
		// The scope button now carries the note's own title, which is the vault's word.
		expect(titlesOf(openFrom(barOf(containerEl), 'scope'))).toContain(marked('toolbar.editIteration'));
	});

	it('names the resources axis and the state-colour door from the catalog', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-20', status: 'New', who: 'Ada' },
		});
		const { view, containerEl } = roadmapView(vault, {
			startProperty: 'note.start',
			targetProperty: 'note.due',
			assigneeProperty: 'note.who',
			stateProperty: 'note.status',
			stateValues: 'New, Done',
		});
		const bar = barOf(containerEl);

		expect(drawnText(bar)).toContain(marked('toolbar.stateColours'));
		expect(titlesOf(openFrom(bar, 'axis'))).toContain(marked('toolbar.axisResources'));

		// `dates` is the default active axis with both configured (`configuredAxes`'s own
		// priority order), so the resources axis's own creation control draws only once
		// it is picked.
		view.setAxisPick('resources');
		expect(drawnText(barOf(containerEl))).toContain(marked('toolbar.newResource'));
	});

	it('draws the grouping advisory from the catalog when Bases reports a group-by', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		setResults(view, vault.entries(), [{ hasKey: () => true, entries: [] }]);
		const drawn = drawnText(barOf(containerEl));

		expect(drawn).toContain(marked('toolbar.groupingIgnored'));
		expect(drawn).toContain(marked('toolbar.groupingIgnoredTooltip'));
	});

	it('draws the completed toggle with nothing hidden from the third key', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' }, { hideCompleted: true });

		expect(drawnText(barOf(containerEl))).toContain(marked('toolbar.showCompleted'));
	});
});

describe('the menus the toolbar opens read their entries from the catalog', () => {
	it('draws the New-type picker from one key with the type as its parameter', () => {
		const { containerEl } = makeView(fixture());
		const titles = titlesOf(openByClass(barOf(containerEl), 'pbl-new-pick'));

		expect(titles).toContain(MARK + 'New Epic');
		expect(titles).toContain(MARK + 'New Bug');
		expect(unmarked(titles)).toEqual([]);
	});

	it('draws the focus menu from it, with every type name arriving as data', () => {
		const { containerEl } = makeView(fixture());
		const titles = titlesOf(openFrom(barOf(containerEl), 'focus'));

		expect(titles).toContain(marked('toolbar.allTypes'));
		// Every entry below the first IS a type name, so the unmarked remainder is exactly
		// the vocabulary — the direction that fails if one of those is ever keyed.
		expect(unmarked(titles)).toContain('Epic');
		expect(unmarked(titles)).toContain('Task');
		expect(unmarked(titles)).not.toContain('All types');
	});

	it('draws the overflow menu from it, mirroring the buttons it stands in for', () => {
		const { containerEl } = makeView(fixture());
		const titles = titlesOf(openFrom(barOf(containerEl), 'overflow'));

		expect(titles).toContain(marked('toolbar.expandAll'));
		expect(titles).toContain(marked('toolbar.collapseAll'));
		expect(titles).toContain(marked('toolbar.openManual'));
		expect(titles).toContain(marked('toolbar.assignMissing'));
		expect(titles).toContain(marked('toolbar.clickAction'));
		expect(unmarked(titles)).toEqual([]);
	});
});

describe('the catalog keeps what the toolbar needs of it', () => {
	/**
	 * The switcher's visible word is meant to sit INSIDE its accessible name, so speech
	 * control can match what a reader can see. It is a property of two strings and of
	 * nothing the compiler checks, so it is asked of the catalog here — of English today,
	 * and of whatever a translator writes in its place.
	 *
	 * **Case-insensitively, and three of the four.** `renderModeToggle`'s own comment said
	 * "each `word` is a substring of its `label`" and English has never met it: `Tree` is
	 * `tree` in its label, and `Tests` is not in `Show as test catalog` at all. Both are
	 * pre-existing and neither is a text move's to fix — the wording is the change, and
	 * this slice moved the strings without touching them. The exception is NAMED rather
	 * than dropped from the list, so keying a fourth position or rewording the catalog
	 * one fails here instead of quietly joining it.
	 */
	it('keeps each switcher word inside the label it is under, bar the one that never was', () => {
		const positions = [
			['toolbar.modeTree', 'toolbar.modeTreeWord'],
			['toolbar.modeBoard', 'toolbar.modeBoardWord'],
			['toolbar.modeRoadmap', 'toolbar.modeRoadmapWord'],
			['toolbar.modeCatalog', 'toolbar.modeCatalogWord'],
		] as const;
		const inside = ([label, word]: readonly [MessageKey, MessageKey]): boolean =>
			String(en[label]).toLowerCase().includes(String(en[word]).toLowerCase());

		expect(positions.filter((pair) => !inside(pair)).map(([label]) => label)).toEqual(['toolbar.modeCatalog']);
	});

	/**
	 * Every key this slice owns was watched reaching a surface, or is named here as one
	 * the file does not drive. The audit is the reason the fixture list above may be
	 * computed rather than curated: a key added to `toolbar.*` and never read renders
	 * nothing and would otherwise fail nothing.
	 *
	 * The three unreached ones are the busy indicator's, and all need a write in FLIGHT:
	 * the plain label, the counted form and the per-file progress only carry text between
	 * a batch starting and finishing.
	 * `test/view/toolbar.test.ts` drives both under English, through a fake vault that
	 * probes after each file it writes; repeating that machinery here would be a second
	 * copy of a fixture for two keys lint already reads at their `setText` calls.
	 */
	it('watched every key it owns reach a surface, bar the three it names', () => {
		const unreached = OWN.filter((key) => {
			const entry = en[key];
			const forms = typeof entry === 'string' ? [entry] : Object.values(entry);
			// The catalog's own text as a PATTERN, with `{name}` standing for whatever the
			// vault put there — comparing raw templates reads every parameterised key as
			// missing while all of them are on screen.
			return !forms.some((form) => {
				const pattern = new RegExp(`^${MARK}${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+')}$`);
				return [...seen].some((text) => pattern.test(text));
			});
		});

		expect(unreached).toEqual([
			'toolbar.updating',
			'toolbar.updatingCounted',
			'toolbar.updatingProgress',
			'toolbar.untyped',
		]);
	});
});
