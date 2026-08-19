// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, setLocale } from '../../src/i18n/t';
import {
	AbsencePromptModal,
	FolderPromptModal,
	IterationPromptModal,
	SchedulePromptModal,
	TitlePromptModal,
} from '../../src/ui/prompts';
import { openManual } from '../../src/ui/manualDialog';
import { openStateColorsDialog } from '../../src/ui/stateColorsDialog';
import { promptCreateBacklogBase } from '../../src/commands/scaffold';
import { installObsidianDom } from '../helpers/dom';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

/**
 * The surfaces `ui/` and `commands/` spell for themselves, driven under a catalog that is
 * not English.
 *
 * Against the shipped registry these checks would be vacuous in the way that matters:
 * `t('prompt.create')` and a literal `'Create'` render the same string, so a suite reading
 * English cannot tell a swept call site from one that was missed. Overriding the keys is
 * what makes the difference visible — a literal left behind renders its own English while
 * everything beside it renders the override.
 *
 * It is the runtime half of a pair. The other half is `UI_TEXT_LITERAL` in
 * `eslint.config.mjs`, which refuses a NEW literal at the spellings it can see; this file
 * says the calls that replaced the old ones reach the catalog at all. Neither covers what
 * the other does: lint cannot tell whether a key is read, and no test can see a call site
 * nobody has written yet.
 */

/**
 * Every key those two directories spell — the FIXTURE, which is wider than what is
 * asserted below. The value is English with a marker in front, so a parameter's own text is
 * untouched and `{name}`-style substitution still happens; what is asserted is the marker,
 * never the wording after it.
 *
 * Three of them are overridden and never read back. `prompt.newItemFolderDesc` and
 * `scaffold.folderDesc` go through `Setting.setDesc`, which the mock deliberately does not
 * render, and `scaffold.failed` needs a vault whose write throws. Lint is what holds those
 * three; naming them is what stops this list reading as the assertion set.
 */
const SWEPT = [
	'prompt.folderField',
	'prompt.save',
	'prompt.create',
	'prompt.clearDate',
	'prompt.absenceResource',
	'prompt.absenceStart',
	'prompt.absenceEnd',
	'prompt.iterationName',
	'prompt.iterationStart',
	'prompt.iterationTarget',
	'prompt.iterationGoal',
	'prompt.newItemType',
	'prompt.newItemTitle',
	'prompt.newItemTitlePlaceholder',
	'prompt.newItemFolderPlaceholder',
	'prompt.newItemFolderDesc',
	'stateColors.title',
	'stateColors.intro',
	'stateColors.useDefault',
	'manual.dialogTitle',
	'scaffold.heading',
	'scaffold.folderDesc',
	'scaffold.cta',
	'scaffold.created',
	'scaffold.failed',
] as const;

const MARK = 'XX ';
const xx: Catalog = Object.fromEntries(SWEPT.map((key) => [key, MARK + en[key]]));

/** What that key renders as under the fixture — the assertion's own single source. */
const marked = (key: (typeof SWEPT)[number]): string => MARK + en[key];

beforeEach(() => {
	document.body.empty();
	Modal.lastOpened = null;
	Notice.reset();
	setLocale('xx', { xx });
});
// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

/** The `.setting-item-name` of every row a dialog drew, in order. */
const rowNames = (el: HTMLElement): string[] =>
	Array.from(el.querySelectorAll('.setting-item-name')).map((node) => node.textContent ?? '');

const placeholders = (el: HTMLElement): string[] =>
	Array.from(el.querySelectorAll('input')).map((input) => input.placeholder);

/** The prompt's call-to-action, which is never the extra-setting button a row may carry. */
const cta = (el: HTMLElement): string =>
	el.querySelector('button:not(.extra-setting-button)')?.textContent ?? '';

describe('the prompts read their own labels from the catalog', () => {
	it('draws the new-item prompt from it, field names, placeholders and button alike', () => {
		const vault = new FakeVault();
		const modal = new TitlePromptModal(vault.app as never, {
			heading: 'New Epic',
			types: ['Epic', 'Feature'],
			askFolder: true,
			onSubmit: () => undefined,
		});
		modal.open();

		expect(rowNames(modal.contentEl)).toEqual([
			marked('prompt.newItemType'),
			marked('prompt.newItemTitle'),
			marked('prompt.folderField'),
		]);
		expect(placeholders(modal.contentEl)).toEqual([
			marked('prompt.newItemTitlePlaceholder'),
			marked('prompt.newItemFolderPlaceholder'),
		]);
		expect(cta(modal.contentEl)).toBe(marked('prompt.create'));
	});

	it('gives the folder prompt the same folder label the new-item prompt has', () => {
		// One key, two forms — so the two cannot drift into naming one thing differently.
		const vault = new FakeVault();
		const modal = new FolderPromptModal(vault.app as never, {
			heading: 'Somewhere',
			description: 'Handed in by the caller.',
			ctaLabel: 'Also the caller s',
			defaultFolder: 'docs',
			onSubmit: () => undefined,
		});
		modal.open();
		expect(rowNames(modal.contentEl)).toEqual([marked('prompt.folderField')]);
	});

	it('names the schedule prompt s clear button after the field it empties', () => {
		const vault = new FakeVault();
		const modal = new SchedulePromptModal(vault.app as never, {
			heading: 'Schedule',
			description: 'Handed in by the caller.',
			fields: [{ field: 'start', name: 'Planned start', value: '' }],
			validate: () => null,
			onSubmit: () => undefined,
		});
		modal.open();

		// The field's own name is the CALLER's and passes through untouched; only the
		// sentence around it comes from the catalog.
		expect(modal.contentEl.querySelector('.extra-setting-button')?.getAttribute('aria-label')).toBe(
			`${MARK}Clear Planned start`,
		);
		// Not the first button: the clear this row carries is one too.
		expect(cta(modal.contentEl)).toBe(marked('prompt.save'));
	});

	it('draws the absence prompt s three fields and the save it shares with the schedule', () => {
		const vault = new FakeVault();
		const modal = new AbsencePromptModal(vault.app as never, {
			heading: 'Away',
			description: 'Handed in by the caller.',
			resource: 'Ada',
			known: [],
			validate: () => null,
			onSubmit: () => undefined,
		});
		modal.open();

		expect(rowNames(modal.contentEl)).toEqual([
			marked('prompt.absenceResource'),
			marked('prompt.absenceStart'),
			marked('prompt.absenceEnd'),
		]);
		expect(cta(modal.contentEl)).toBe(marked('prompt.save'));
	});

	it('draws the iteration prompt s fields from keys of its own, not the absence s', () => {
		const vault = new FakeVault();
		const modal = new IterationPromptModal(vault.app as never, {
			heading: 'Iteration',
			description: 'Handed in by the caller.',
			name: '',
			start: '',
			target: '',
			goal: '',
			fields: { start: true, target: true, goal: true },
			cta: 'The caller s',
			validate: () => null,
			onSubmit: () => undefined,
		});
		modal.open();

		expect(rowNames(modal.contentEl)).toEqual([
			marked('prompt.iterationName'),
			marked('prompt.iterationStart'),
			marked('prompt.iterationTarget'),
			marked('prompt.iterationGoal'),
		]);
	});
});

describe('the dialogs read their own text from the catalog', () => {
	it('titles the state-colour dialog and its reset from it', () => {
		openStateColorsDialog(
			{} as never,
			[{ state: 'Doing', value: '#111111', defaultValue: '#222222', isSet: true }],
			() => undefined,
		);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('no dialog opened');

		expect(modal.titleEl.textContent).toBe(marked('stateColors.title'));
		expect(modal.contentEl.querySelector('.pbl-state-colors-intro')?.textContent).toBe(marked('stateColors.intro'));
		expect(modal.contentEl.querySelector('.extra-setting-button')?.getAttribute('aria-label')).toBe(
			marked('stateColors.useDefault'),
		);
		// The row is a state the user configured, so it is data and stays as written.
		expect(rowNames(modal.contentEl)).toEqual(['Doing']);
	});

	it('titles the manual dialog from it', () => {
		openManual({} as never, [{ id: 'one', title: 'First', entries: [{ term: 'A', text: 'alpha' }] }], 'one');
		expect(Modal.lastOpened?.titleEl.textContent).toBe(marked('manual.dialogTitle'));
	});
});

describe('the scaffold command reads its prompt and its notice from the catalog', () => {
	it('draws the prompt from it, and reports the file it made', async () => {
		const vault = new FakeVault();
		promptCreateBacklogBase(vault.app as never);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		expect(modal.titleEl.textContent).toBe(marked('scaffold.heading'));
		expect(rowNames(modal.contentEl)).toEqual([marked('prompt.folderField')]);
		expect(cta(modal.contentEl)).toBe(marked('scaffold.cta'));

		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		// The path is vault content: it arrives as a parameter and is not the catalog's.
		expect(Notice.messages).toEqual([`${MARK}Created "docs/Product Backlog.base". Add your first epic from the view.`]);
	});
});
