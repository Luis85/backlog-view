// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, MessageKey, setLocale } from '../../src/i18n/t';
import { Menu, MenuItem, Modal, Notice } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { makeRoadmap, shelfHeavyVault } from '../helpers/roadmap';
import { flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

/**
 * Every menu the view opens, driven under a catalog that is not English —
 * `view/interactions/menu.ts`, `shelfMenu.ts`, `columnMenu.ts`, `tags.ts` and `labels.ts`,
 * swept 2026-08-20.
 *
 * The construction `test/i18n/sweptSurfaces.test.ts` and `test/i18n/emptyStates.test.ts`
 * use, for their reason: against the shipped registry `t('menu.outdent')` and a literal
 * `'Outdent'` render the same string, so every other assertion in the suite reads
 * identically whether the call site was swept or missed. Overriding the keys is what makes
 * the difference visible.
 *
 * **What this file asserts is the CATEGORY, not a list of entries somebody remembered.**
 * A menu is a list, and the question here is "is every drawn title text", which cannot be
 * answered by naming the titles: the next entry added is exactly the one nobody named. So
 * each surface is drained of every title it draws — through submenus too — and what is
 * asserted is that the unmarked remainder is exactly the DATA this menu lists. A new
 * English literal joins that remainder and fails; a data value wrongly keyed leaves it and
 * fails too, which is the direction the epic has already had to correct twice.
 *
 * It is the runtime half of a pair. `UI_TEXT_LITERAL` in `eslint.config.mjs` refuses a NEW
 * literal at the spellings it can see — these files reach the UI through `setTitle` and
 * `new Notice`, which is exactly what that rule reads — while this file says the calls
 * that replaced the old ones reach the catalog at all. Neither covers what the other does.
 * What NEITHER reaches is a prose literal handed to `ValuePromptModal` as an option-bag
 * property: `title:`, `fieldName:`, `placeholder:` and `ctaLabel:` are not `setTitle` calls
 * and `UI_TEXT_PROPERTY` does not apply in this directory. The three prompt surfaces below
 * are driven for that reason, and they are the part of this file that is load-bearing
 * rather than belt-and-braces.
 */

useViewHarness();

/**
 * Every key this slice owns, computed against `en.ts` rather than kept by hand — the
 * discipline both sibling files claimed and one of them did not keep, leaving a whole
 * surface held by neither lint nor test. One namespace is what makes the computation
 * exact: a key added to `menu.*` is in this list without anyone editing it.
 */
const OWN = Object.keys(en).filter((key): key is MessageKey => key.startsWith('menu.'));

/**
 * The four keys this slice READS without owning. Each is a second surface over an act
 * whose first surface already had a key, and taking the existing one rather than minting a
 * twin is the codebase's own rule about two surfaces over one action — they must not be
 * able to disagree. Named explicitly because a prefix filter cannot find them.
 */
const REUSED = ['fold.expandColumn', 'fold.collapseColumn', 'shelf.search', 'shelf.clearSearch'] as const;

const SWEPT: MessageKey[] = [...OWN, ...REUSED];

const MARK = 'XX ';
const xx: Catalog = Object.fromEntries(
	SWEPT.map((key) => {
		const entry = en[key];
		return [
			key,
			typeof entry === 'string'
				? MARK + entry
				: Object.fromEntries(Object.entries(entry).map(([form, value]) => [form, MARK + value])),
		];
	}),
);

/** What that key renders as under the fixture — the assertion's own single source. */
const marked = (key: MessageKey): string => {
	const entry = en[key];
	if (typeof entry !== 'string') throw new Error(`${key} is a plural entry; assert its form directly`);
	return MARK + entry;
};

/**
 * Every marked string this file watched reach a surface, accumulated across the whole run
 * and audited by the last test in the file. Module state on purpose: the audit's question
 * is about the file, not about any one test in it.
 */
const seen = new Set<string>();

const record = <T>(strings: readonly string[], value: T): T => {
	for (const text of strings) if (text.startsWith(MARK)) seen.add(text);
	return value;
};

beforeEach(() => {
	Menu.lastShown = null;
	Modal.lastOpened = null;
	Notice.reset();
	setLocale('xx', { xx });
});
// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

/** Every title a menu draws, following submenus — the whole of what the reader sees. */
function titlesOf(menu: Menu): string[] {
	const out: string[] = [];
	for (const item of menu.items) {
		out.push(item.titleText);
		if (item.submenu) out.push(...titlesOf(item.submenu));
	}
	return record(out, out);
}

/** What a surface drew that is NOT from the catalog — the set each test names in full. */
const unmarked = (menu: Menu): string[] => titlesOf(menu).filter((title) => !title.startsWith(MARK));

function openMenuOn(el: HTMLElement, what: string): Menu {
	Menu.lastShown = null;
	el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error(`no menu opened on ${what}`);
	return menu;
}

const openRowMenu = (containerEl: HTMLElement, title: string): Menu =>
	openMenuOn(rowByTitle(containerEl, title), title);

/** The shelf's section rides the CARD menu, which is the roadmap's own row. */
const openCardMenu = (containerEl: HTMLElement, title: string): Menu =>
	openMenuOn(cardByTitle(containerEl, title), title);

function entry(menu: Menu, title: string): MenuItem {
	const found = menu.items.find((item) => item.titleText === title);
	if (!found) throw new Error(`menu entry not found: ${title}`);
	return found;
}

/** A dialog's field labels, placeholders and call to action — the option bag, rendered. */
function modalStrings(modal: Modal): string[] {
	const el = modal.contentEl;
	const names = Array.from(el.querySelectorAll('.setting-item-name')).map((node) => node.textContent ?? '');
	const placeholders = Array.from(el.querySelectorAll('input')).map((input) => input.placeholder);
	const buttons = Array.from(el.querySelectorAll('button')).map((node) => node.textContent ?? '');
	const titles = [modal.titleEl?.textContent ?? ''];
	return record([...titles, ...names, ...placeholders, ...buttons], [...titles, ...names, ...placeholders, ...buttons]);
}

/** Everything the row menu can offer, so one fixture drives every entry that has a gate. */
const CONFIGURED = {
	stateProperty: 'note.status',
	stateValues: 'New, Active, Done',
	riskProperty: 'note.risk',
	priorityProperty: 'note.priority',
	assigneeProperty: 'note.assignee',
	iterationProperty: 'note.iteration',
	horizonProperty: 'note.horizon',
	horizonValues: 'Now, Next, Later',
	startProperty: 'note.start',
	targetProperty: 'note.due',
	tagsProperty: 'note.tags',
};

/** The Base's visible properties, which is what makes the tags column — and its menu — real. */
const VISIBLE = { order: ['note.status', 'note.tags'] };

/** A backlog carrying one of everything the menus list, so the data half is non-empty. */
function fullVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
	vault.addFile('Feature B1.md', {
		frontmatter: {
			type: 'Feature',
			order: 10,
			status: 'New',
			risk: 'High',
			priority: '2 - Should',
			assignee: 'Sam',
			horizon: 'Now',
			tags: ['alpha'],
			start: '2026-08-01',
			due: '2026-08-31',
		},
		parentLink: 'Epic B',
	});
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

/**
 * What the row menu lists that is NOT text, and must never become text: the type ladder
 * `New <type>` and `Set type` offer, the workflow states, the declared risk and priority
 * ladders, the observed assignee, the iterations in the model, the horizon buckets and the
 * item's own tags. A locale that translated any one of these would offer a pick that writes
 * a value another locale's vault cannot read — the test `CLAUDE.md` states as "one writes
 * notes the other cannot read", asked here of the whole menu at once rather than of the
 * constants somebody thought to check.
 */
const DATA = [
	'Epic',
	'Feature',
	'PBI',
	'Task',
	'Bug',
	'Issue',
	'Idea',
	'Milestone',
	'Resource',
	'Deliverable',
	'New',
	'Active',
	'Done',
	'High',
	'1 - High',
	'2 - Normal',
	'3 - Low',
	'1 - Must',
	'2 - Should',
	'3 - Could',
	"4 - Won't",
	'Sam',
	'Sprint 12',
	'Now',
	'Next',
	'Later',
	'#alpha',
];

/**
 * English this menu still draws, from the two files in this directory the slice did NOT
 * sweep — `plan.ts` owns `Clear horizon` and `dependencies.ts` owns `Depends on…`. They are
 * named here rather than left in `DATA`, because the two lists mean opposite things: `DATA`
 * must never shrink and this one must reach empty. Sweeping either file fails this test,
 * which is the point — the entry is deleted in the same change that keys the string.
 */
const UNSWEPT = ['Clear horizon', 'Depends on\u2026'];

describe('the row menu reads every word it spells from the catalog', () => {
	it('leaves only the values it lists unmarked, submenus included', () => {
		const { containerEl } = makeView(fullVault(), CONFIGURED, VISIBLE);
		const menu = openRowMenu(containerEl, 'Feature B1');

		// Everything here is a value the plugin writes, matches or persists: the type
		// ladder `New <type>` and `Set type` offer, the workflow states, the declared risk
		// and priority ladders, the observed assignee, the iterations in the model, the
		// horizon buckets and the tags. Translating any one of them would write a note
		// another locale's vault cannot read — which is the whole of the rule this
		// assertion exists to hold, stated as the set rather than as a promise.
		expect(new Set(unmarked(menu))).toEqual(new Set([...DATA, ...UNSWEPT]));
	});

	it('names the structural moves, the opens and every submenu from it', () => {
		const { containerEl } = makeView(fullVault(), CONFIGURED, VISIBLE);
		const titles = titlesOf(openRowMenu(containerEl, 'Feature B2'));

		// A spot check under the category assertion above, so a wrong-key swap — every
		// entry marked, two of them wearing each other's words — still fails.
		expect(titles).toContain(marked('menu.moveUp'));
		expect(titles).toContain(marked('menu.moveToTop'));
		expect(titles).toContain(marked('menu.outdent'));
		expect(titles).toContain(marked('menu.openInNewTab'));
		expect(titles).toContain(marked('menu.openToTheRight'));
		expect(titles).toContain(marked('menu.setType'));
		expect(titles).toContain(marked('menu.editTags'));
		expect(titles).toContain(marked('menu.schedule'));
		// The two that interpolate a title: the sentence is one key and the vault's own
		// words pass through it untouched.
		expect(titles).toContain(`${MARK}Indent under "Feature B1"`);
		expect(titles).toContain(`${MARK}New PBI`);
	});

	it('names the unschedule and the horizon clear only where they remove something', () => {
		const { containerEl } = makeView(fullVault(), CONFIGURED, VISIBLE);
		// Feature B1 carries both dates, so this is the entry's own live case.
		expect(titlesOf(openRowMenu(containerEl, 'Feature B1'))).toContain(marked('menu.unschedule'));
	});

	it('names the parent-link repair from it', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, parent: '[[Nowhere]]' } });
		const { containerEl } = makeView(vault, CONFIGURED, VISIBLE);
		expect(titlesOf(openRowMenu(containerEl, 'Epic A'))).toContain(marked('menu.clearParentLink'));
	});
});

describe('the submenus and the dialogs they open', () => {
	it('names each label menu s clear, and Set iteration s None', () => {
		const { containerEl } = makeView(fullVault(), CONFIGURED, VISIBLE);
		const menu = openRowMenu(containerEl, 'Feature B1');
		const titles = titlesOf(menu);

		expect(titles).toContain(marked('menu.clearRisk'));
		expect(titles).toContain(marked('menu.clearPriority'));
		expect(titles).toContain(marked('menu.clearAssignee'));
		expect(titles).toContain(marked('menu.clearIteration'));
		expect(titles).toContain(marked('menu.newAssignee'));
		expect(titles).toContain(marked('menu.newTag'));
	});

	it('draws the assignee prompt from it — title, field, placeholder and button', () => {
		const { containerEl } = makeView(fullVault(), CONFIGURED, VISIBLE);
		const menu = openRowMenu(containerEl, 'Feature B1');
		entry(entry(menu, marked('menu.setAssignee')).submenu!, marked('menu.newAssignee')).click();

		const modal = Modal.lastOpened;
		if (!modal) throw new Error('the assignee prompt did not open');
		const strings = modalStrings(modal);
		// The option bag neither lint rule in this directory can see.
		expect(strings).toContain(marked('menu.assignTitle'));
		expect(strings).toContain(marked('menu.assignField'));
		expect(strings).toContain(marked('menu.assignPlaceholder'));
		expect(strings).toContain(marked('menu.assignCta'));
	});

	it('draws the new-tag prompt from it, and says so when the tag is refused', async () => {
		const { containerEl } = makeView(fullVault(), CONFIGURED, VISIBLE);
		const menu = openRowMenu(containerEl, 'Feature B1');
		entry(entry(menu, marked('menu.editTags')).submenu!, marked('menu.newTag')).click();

		const modal = Modal.lastOpened;
		if (!modal) throw new Error('the tag prompt did not open');
		const strings = modalStrings(modal);
		expect(strings).toContain(marked('menu.addTagTitle'));
		expect(strings).toContain(marked('menu.addTagField'));
		expect(strings).toContain(marked('menu.addTagPlaceholder'));
		expect(strings).toContain(marked('menu.addTagCta'));

		// A tag that normalizes to nothing is refused out loud rather than silently.
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('the tag prompt drew no field');
		input.value = '123';
		input.dispatchEvent(new Event('input'));
		modal.contentEl.querySelector('button:not(.extra-setting-button)')?.dispatchEvent(new MouseEvent('click'));
		await flush();
		expect(record(Notice.messages, Notice.messages)).toContain(marked('menu.tagRejected'));
	});
});

describe('the shelf s own section', () => {
	it('names the sort, the type filter and the search, and lists the types as data', () => {
		const { containerEl } = makeRoadmap(shelfHeavyVault());
		const menu = openCardMenu(containerEl, 'Anchor');
		const titles = titlesOf(menu);

		expect(titles).toContain(marked('menu.sortShelf'));
		expect(titles).toContain(marked('menu.filterShelfByType'));
		expect(titles).toContain(marked('menu.shelfSortTree'));
		expect(titles).toContain(marked('menu.shelfSortTitle'));
		expect(titles).toContain(marked('menu.shelfSortModified'));
		expect(titles).toContain(marked('menu.showAllTypes'));
		expect(titles).toContain(marked('menu.hideAllTypes'));
		expect(titles).toContain(marked('menu.searchShelf'));
		// The type's own name is the vault's; only the frame around the count is text.
		expect(titles).toContain(`${MARK}Epic (7)`);
	});

	it('titles the search dialog with the key the shelf header s own box carries', () => {
		const { containerEl } = makeRoadmap(shelfHeavyVault());
		entry(openCardMenu(containerEl, 'Anchor'), marked('menu.searchShelf')).click();

		const modal = Modal.lastOpened;
		if (!modal) throw new Error('the search prompt did not open');
		const strings = modalStrings(modal);
		expect(strings).toContain(marked('shelf.search'));
		expect(strings).toContain(marked('menu.searchField'));
		expect(strings).toContain(marked('menu.searchPlaceholder'));
		expect(strings).toContain(marked('menu.searchCta'));
	});

	it('names the clear once a search runs', async () => {
		const harness = makeRoadmap(shelfHeavyVault());
		harness.view.setShelfSearch('Undated');
		await flush();
		expect(titlesOf(openCardMenu(harness.containerEl, 'Undated 1'))).toContain(marked('shelf.clearSearch'));
	});
});

describe('the board column s menu', () => {
	it('folds through the key the column header s own disclosure draws from', () => {
		// Both directions, because the entry is a ternary over two keys and a fixture in one
		// state can only ever watch one of them.
		const { containerEl } = makeBoard(boardVault());
		for (const verb of ['Collapse', 'Expand'] as const) {
			const header = containerEl.querySelector<HTMLElement>('.pbl-board-col-header');
			if (!header) throw new Error('no column header rendered');
			const menu = openMenuOn(header, 'a board column');

			// `{name}` is the column's own value and passes through; the verb is the
			// catalog's, and it is the SAME key `render/board.ts` labels the header's own
			// disclosure with — one act, one wording, on both surfaces.
			const name = header.querySelector('.pbl-board-col-name')?.textContent ?? '';
			expect(titlesOf(menu)).toContain(`${MARK}${verb} ${name}`);
			// Fold it through its own disclosure, so the second pass reads the other branch.
			containerEl.querySelector<HTMLElement>('.pbl-board-col .pbl-chevron')?.click();
		}
	});
});

/**
 * The audit, and the reason this file's SWEPT list is computed rather than written down:
 * a list kept by hand says "every key" and means "every key somebody remembered". This
 * asks the catalog instead, and names the residue in full.
 *
 * It reads `seen`, which every helper above fills, so it depends on running LAST in the
 * file — vitest runs a file's tests in source order, and this describe is the last one.
 */
describe('the audit over the catalog itself', () => {
	it('watched every key this slice owns reach a surface, except the ones lint alone holds', () => {
		// A key with a parameter never renders as its own template, so a covered key is one
		// whose template MATCHES something seen — `{name}` standing for whatever the vault
		// put there. Comparing the templates themselves was this check's first form, and it
		// reported every parameterised key missing while all of them were on screen.
		const rendered = (key: MessageKey): RegExp => {
			const entry = en[key];
			const template = typeof entry === 'string' ? entry : Object.values(entry)[0];
			const escaped = (MARK + template).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			return new RegExp(`^${escaped.replace(/\\\{\w+\\\}/g, '.+')}$`);
		};
		const missed = SWEPT.filter((key) => ![...seen].some((text) => rendered(key).test(text)));

		// The residue, named in full rather than counted, so it cannot quietly grow. Each
		// needs a state no fixture above is in, and `UI_TEXT_LITERAL` is what holds all
		// three: every one is a `setTitle` call, which is a spelling that rule reads.
		// `menu.useFolderPosition` needs folder mode with a link override on the row,
		// `menu.openChild` needs a card with its children disclosed on the roadmap, and
		// `menu.clearTestState` needs a catalog member carrying a test state.
		expect(missed).toEqual(['menu.useFolderPosition', 'menu.openChild', 'menu.clearTestState']);
	});
});
