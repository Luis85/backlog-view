// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, MessageKey, setLocale } from '../../src/i18n/t';
import { FuzzySuggestModal, Menu, Modal, Notice } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The rest of `view/interactions/` under a catalog that is not English — the prompts, the
 * notices and the backfill's outcome, swept 2026-08-20. `test/i18n/menus.test.ts` is the
 * menu half of the same directory.
 *
 * The construction the other three i18n files use, for their reason: against the shipped
 * registry `t('dependency.dependsOn')` and a literal `'Depends on…'` render the same
 * string, so every other assertion in the suite reads identically whether the call site
 * was swept or missed. Overriding the keys is what makes the difference visible — and the
 * assertions below read the MARKER, never the wording behind it, because a bare value
 * would match both branches.
 *
 * **This is the half that holds the shapes neither lint rule can see**, which for this
 * slice is most of it:
 *
 *   - The prompt OPTION BAGS — `heading:`, `description:`, `placeholder:` and `cta:`.
 *     **This paragraph said they were outside both rules, and that stopped being true the
 *     same day it was written**: `UI_TEXT_PROPERTY` was widened to name them once this file
 *     showed how much rode on the tests alone. What lint now refuses is a literal SPELLED
 *     at one of those properties, anywhere in a swept region.
 *
 *     What it still cannot tell is whether a key is READ, which is what these tests are
 *     for: a call site could pass `t('some.other.key')` and render the wrong sentence with
 *     every rule green. That is a narrower claim than the one it replaces, and it is the
 *     honest one.
 *   - The two ASSEMBLED sentences. `runInit`'s outcome and the undo report are built from
 *     keyed fragments joined by `list()`, and lint sees a call rather than a sentence.
 *     Keying only the fragments would leave the frame in English and pass every rule.
 *     `runInit`'s is covered below; the undo report's is not — it needs a batch that
 *     fails partway, which no fixture here reaches.
 */

/**
 * Every key the seven swept files spell for themselves — the FIXTURE, which is wider than
 * what the two tests below assert. Computed lists are what the other i18n files learned to
 * use, and this one is hand-kept for a reason that is itself a limitation: the keys span
 * seven namespaces with no shared prefix, so there is nothing to compute against. A key
 * added to one of those files and left out of this list is caught by neither half.
 */
const OWN: MessageKey[] = [
	'config.fixFirst',
	'dependency.dependsOn',
	'dependency.remove',
	'dependency.removeEmpty',
	'dependency.propertyChanged',
	'dependency.setUp',
	'dependency.noneLeft',
	'dependency.addPlaceholder',
	'dependency.removePlaceholder',
	'dependency.noteChanged',
	'dependency.noteChangedBeforeWrite',
	'absence.addHeading',
	'absence.addInFolder',
	'absence.addInRoot',
	'absence.editHeading',
	'absence.editDescription',
	'absence.edit',
	'absence.delete',
	'absence.needsProperties',
	'absence.deleted',
	'absence.deleteFailed',
	'absence.updated',
	'absence.saveFailed',
	'absence.created',
	'absence.createFailed',
	'create.whereLabel',
	'create.created',
	'create.failed',
	'create.iterationHeading',
	'create.iterationCta',
	'create.iterationEditHeading',
	'create.iterationEditCta',
	'create.iterationDates',
	'create.iterationGone',
	'create.iterationCreated',
	'create.iterationFailed',
	'init.adopted',
	'init.updatedItems',
	'init.outcome',
	'init.outcomeWithColumns',
	'init.nothingToDo',
	'undo.outcome',
	'undo.conflicts',
	'undo.missing',
	'plan.clearHorizon',
	'plan.scheduleHeading',
	'plan.scheduleDescription',
	'stateColors.noStates',
];

const MARK = 'XX ';
const xx: Catalog = Object.fromEntries(
	OWN.map((key) => {
		const entry = en[key];
		return [
			key,
			typeof entry === 'string'
				? MARK + entry
				: Object.fromEntries(Object.entries(entry).map(([form, value]) => [form, MARK + value])),
		];
	}),
);

beforeEach(() => setLocale('xx', { xx }));
// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

/** Two siblings under an epic, so there is always something legal to depend on. */
function vault(): FakeVault {
	const v = new FakeVault();
	v.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	for (const [index, title] of ['A', 'B'].entries()) {
		v.addFile(`${title}.md`, { frontmatter: { type: 'PBI', order: (index + 1) * 10 }, parentLink: 'Epic' });
	}
	return v;
}

function openMenu(containerEl: HTMLElement, title: string): Menu {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error('no menu opened');
	return menu;
}

function suggester(): FuzzySuggestModal<unknown> {
	const modal = Modal.lastOpened;
	if (!(modal instanceof FuzzySuggestModal)) throw new Error('no suggester opened');
	return modal as FuzzySuggestModal<unknown>;
}

describe('the dependency picker reads its words from the catalog', () => {
	it('names the menu entry, the placeholder and the binding notice from it', async () => {
		const { containerEl } = makeView(vault());

		// The menu title is a `setTitle` and so is lint's; the PLACEHOLDER below is the
		// option-bag shape that no rule reads.
		const entry = openMenu(containerEl, 'B').item(`${MARK}Depends on…`);
		expect(entry).toBeTruthy();
		entry?.click();

		expect(suggester().placeholder).toBe(MARK + en['dependency.addPlaceholder'].replace('{title}', 'B'));

		suggester().choose('A A.md');
		await flush();

		// The property key passes through as data inside a marked sentence.
		expect(Notice.messages.some((m) => m.startsWith(MARK))).toBe(true);
		expect(Notice.messages).toContain(MARK + en['dependency.setUp'].replace('{property}', 'dependsOn'));
	});
});

describe("the backfill's outcome is one sentence, not a frame around fragments", () => {
	it('reports what it set up through the catalog, follow-up clause included', async () => {
		// Nothing bound: the backfill adopts the defaults, which is the branch that also
		// names the properties menu.
		const { containerEl } = makeView(vault(), { parentProperty: undefined, orderProperty: undefined });

		// Found by ICON, not by its label: that label is `render/toolbar.ts`'s and is still
		// English, so keying it later would silently break a lookup by text.
		const button = containerEl.querySelector<HTMLElement>('[data-icon="sparkles"]');
		if (!button) throw new Error('no init control');
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The WHOLE sentence is the catalog's. Asserting the marker at the front is what
		// distinguishes this from a keyed fragment inside an English frame: with the frame
		// left as a template literal the notice starts with `Product Backlog:` and no
		// marker, while every fragment inside it still renders marked.
		const outcome = Notice.messages.find((m) => m.includes(en['init.adopted'].replace('{properties}', '')));
		expect(outcome).toBeDefined();
		expect(outcome?.startsWith(MARK)).toBe(true);
	});
});

/**
 * The iteration dialog's own option bag — its heading, its call to action and the note
 * under its date fields. All three are `heading:` / `cta:` / `description:` properties, so
 * all three are outside both lint rules and this is the only thing holding them.
 *
 * Its EDIT pair (`create.iterationEditHeading`, `create.iterationEditCta`) is reached the
 * same way with an existing iteration in scope, and is not driven here.
 */
describe('the iteration dialog reads its frame from the catalog', () => {
	it('names the heading, the call to action and the date note from it', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', order: 10, start: '2026-08-03', due: '2026-08-16' },
		});
		const harness = makeView(
			vault,
			{
				stateProperty: 'note.status',
				stateValues: 'New, Doing, Done',
				iterationProperty: 'note.iteration',
				startProperty: 'note.start',
				targetProperty: 'note.due',
				homeFolder: '',
			},
			{ base: 'Plan.base' },
		);
		harness.view.setBoardScope(null);
		harness.view.setProjection('board');
		harness.containerEl
			.querySelector<HTMLElement>('.pbl-scope-btn')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Found by its ENGLISH title, and deliberately so: the scope picker's entry is
		// `view/render/toolbarControls.ts`'s and is still unswept, which this lookup proves
		// — it renders unmarked beside a dialog that is marked throughout. It becomes a key
		// when `render/` is swept, and this line changes with it.
		const entry = Menu.lastShown?.item('New iteration…');
		if (!entry) throw new Error('no new-iteration entry');
		entry.click();

		const modal = Modal.lastOpened;
		if (!modal) throw new Error('dialog not opened');
		expect(modal.titleEl.textContent).toBe(MARK + en['create.iterationHeading']);
		// The call to action is the prompt's own button, and it is this CALLER's key rather
		// than `prompt.create` — the two read alike in English and are different strings.
		const cta = modal.contentEl.querySelector('button:not(.extra-setting-button)');
		expect(cta?.textContent).toBe(MARK + en['create.iterationCta']);
		expect(modal.contentEl.textContent).toContain(MARK + en['create.iterationDates']);
	});
});
