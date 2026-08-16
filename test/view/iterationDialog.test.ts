// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu, Modal } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, refresh, submitButton, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Making an iteration and editing one, from the scope picker's two entries. Every
 * computed date is a PREFILL — what is written is what the reader confirmed — so what is
 * checked here is the write, and the derivation itself is
 * `test/domain/iterationSchedule.test.ts`.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationGoalProperty: 'note.goal',
	startProperty: 'note.start',
	targetProperty: 'note.due',
	iterationLengthDays: '14',
	homeFolder: '',
	'typeFolder.iteration': '',
};

const SPRINT = 'Sprint 12.md';

function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, {
		frontmatter: { type: 'Iteration', order: 10, start: '2026-08-03', due: '2026-08-16', goal: 'Ship it' },
	});
	vault.addFile('Member.md', {
		frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]', start: '2026-08-03' },
	});
	return vault;
}

function open(options: Record<string, unknown> = OPTIONS, scope: string | null = SPRINT, vault = sprintVault()) {
	const harness = makeView(vault, options, { base: 'Plan.base' });
	// The picker is the BOARD's control, so the view has to be on a board to open it —
	// `setBoardScope(null)` is the product board, not the tree.
	harness.view.setBoardScope(scope);
	if (scope === null) harness.view.setProjection('board');
	harness.containerEl
		.querySelector<HTMLElement>('.pbl-scope-btn')
		?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	return { ...harness, vault };
}

/** Fill the dialog's fields by their visible label and submit it. */
async function submitDialog(values: Record<string, string>): Promise<void> {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('dialog not opened');
	for (const setting of Array.from(modal.contentEl.querySelectorAll<HTMLElement>('.setting-item'))) {
		const name = setting.querySelector('.setting-item-name')?.textContent ?? '';
		const input = setting.querySelector('input');
		if (!input || !(name in values)) continue;
		input.value = values[name];
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await flush();
}

/** Which fields the open dialog is showing, by label. */
function fields(): string[] {
	return Array.from(Modal.lastOpened?.contentEl.querySelectorAll('.setting-item-name') ?? []).map(
		(el) => el.textContent ?? '',
	);
}

describe('New iteration…', () => {
	it('creates with the type, both dates and the goal in ONE write', async () => {
		// One `vault.create` and no batch behind it: `writeLog` records
		// `processFrontMatter` alone, which a create never goes through.
		const harness = open();
		Menu.lastShown?.item('New iteration…')?.click();
		await submitDialog({ Name: 'Sprint 13', Goal: 'Finish the importer' });
		expect(harness.vault.fm('Sprint 13.md')).toEqual({
			type: 'Iteration',
			order: expect.any(Number),
			// The day after Sprint 12's target, running fourteen inclusive days.
			start: '2026-08-17',
			due: '2026-08-30',
			goal: 'Finish the importer',
		});
		expect(harness.vault.writeLog).toEqual([]);
		// And it does NOT open, like every other creation this plugin makes: making a
		// sprint is a planning act, and taking the reader off the board they are planning
		// on is what opening it would cost.
		expect(harness.vault.opened).toEqual([]);
	});

	it('prefills the name with the next index', async () => {
		// Numbered so a folder of iterations sorts in the order they run — `Iteration`
		// sorts beside `Iteration 10` and nowhere near `2 - Iteration`. One past the
		// highest numeric prefix any iteration already carries, read off the NAMES: a
		// vault that deleted Sprint 3 must not mint a second one.
		const numbered = sprintVault();
		numbered.addFile('3 - Iteration.md', { frontmatter: { type: 'Iteration', order: 20 } });
		const harness = open(OPTIONS, SPRINT, numbered);
		Menu.lastShown?.item('New iteration…')?.click();
		const name = Modal.lastOpened?.contentEl.querySelector('input');
		expect(name?.value).toBe('4 - Iteration');

		// And 1 in a vault with no numbered iteration at all.
		const fresh = new FakeVault();
		fresh.addFile('Loose.md', { frontmatter: { type: 'PBI', order: 10 } });
		open(OPTIONS, null, fresh);
		Menu.lastShown?.item('New iteration…')?.click();
		expect(Modal.lastOpened?.contentEl.querySelector('input')?.value).toBe('1 - Iteration');
		expect(harness.vault.writeLog).toEqual([]);
	});

	it('writes no goal KEY when the goal is left blank and the property IS configured', async () => {
		// Not the same case as an unconfigured property, and the one the writer gets wrong
		// on its own: an empty string lands as `goal: ''`. Assert the key is ABSENT.
		const harness = open();
		Menu.lastShown?.item('New iteration…')?.click();
		await submitDialog({ Name: 'Sprint 13' });
		expect(Object.keys(harness.vault.fm('Sprint 13.md'))).not.toContain('goal');
	});

	it('omits a field whose property is unconfigured, and works with all three unset', async () => {
		const { iterationGoalProperty, startProperty, targetProperty, ...bare } = OPTIONS;
		expect([iterationGoalProperty, startProperty, targetProperty]).toHaveLength(3);
		const harness = open(bare);
		Menu.lastShown?.item('New iteration…')?.click();
		// A name alone still makes a perfectly good iteration note.
		expect(fields()).toEqual(['Name']);
		await submitDialog({ Name: 'Sprint 13' });
		expect(harness.vault.fm('Sprint 13.md')).toEqual({ type: 'Iteration', order: expect.any(Number) });
	});

	it('refuses a confirmed target before its start, keeping the dialog open', async () => {
		// Refused HERE rather than at the write: the write path's honest answer to a
		// reversed span is to shelve the note, and a dialog that made one on purpose would
		// be a control creating the thing the roadmap has to apologise for.
		const harness = open();
		Menu.lastShown?.item('New iteration…')?.click();
		await submitDialog({ Name: 'Backwards', Start: '2026-09-10', Target: '2026-09-01' });
		expect(harness.vault.fm('Backwards.md')).toEqual({});
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toContain('before the start');
	});

	it('follows the latest sprint even with a focus level retained', async () => {
		// The picker reads the focus-immune set and this must too: read off
		// `model.results`, a retained `PBI` focus left the derivation with no predecessor,
		// prefilling from today while the picker beside it still offered the later sprint.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base', focus: 'PBI' });
		harness.view.setBoardScope(SPRINT);
		harness.containerEl
			.querySelector<HTMLElement>('.pbl-scope-btn')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('New iteration…')?.click();
		await submitDialog({ Name: 'Sprint 13' });
		expect(vault.fm('Sprint 13.md').start).toBe('2026-08-17');
	});

	it('is offered on the product scope too, where Edit is not', () => {
		open(OPTIONS, null);
		const titles = (Menu.lastShown?.items ?? []).map((mi) => mi.titleText);
		expect(titles).toContain('New iteration…');
		expect(titles).not.toContain('Edit iteration…');
	});
});

describe('Edit iteration…', () => {
	it('writes to the iteration note alone, whatever it holds', async () => {
		// The decision the register argues hardest for: an iteration's dates are copied
		// onto an item when it JOINS, and a cascade here would silently reschedule work
		// somebody had since moved, on a screen showing none of it. The COUNT is the
		// claim — a cascade would still produce a correct-looking write for this note.
		const harness = open();
		Menu.lastShown?.item('Edit iteration…')?.click();
		await submitDialog({ Start: '2026-08-04', Target: '2026-08-17', Goal: 'Ship it twice' });
		expect([...new Set(harness.vault.writeLog.map((w) => w.path))]).toEqual([SPRINT]);
		expect(harness.vault.fm(SPRINT)).toMatchObject({ start: '2026-08-04', due: '2026-08-17', goal: 'Ship it twice' });
		expect(harness.vault.fm('Member.md').start).toBe('2026-08-03');
	});

	it('shows no name field, and prefills what the note holds', () => {
		// Renaming an iteration is renaming a note; Obsidian does it better, and the
		// stored scope follows a rename either way.
		open();
		Menu.lastShown?.item('Edit iteration…')?.click();
		expect(fields()).toEqual(['Start', 'Target', 'Goal']);
		const values = Array.from(Modal.lastOpened?.contentEl.querySelectorAll('input') ?? []).map((i) => i.value);
		expect(values).toEqual(['2026-08-03', '2026-08-16', 'Ship it']);
	});

	it('opens on an undated iteration with the properties unset, and writes nothing it cannot', async () => {
		// The edit path's own version of 3b/3c: every field whose key has nowhere to go is
		// absent, an iteration carrying none of them prefills empty, and the batch that
		// results states no axis and no goal rather than blanking either.
		const { iterationGoalProperty, startProperty, targetProperty, ...bare } = OPTIONS;
		expect([iterationGoalProperty, startProperty, targetProperty]).toHaveLength(3);
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		const harness = open(bare, SPRINT, vault);
		Menu.lastShown?.item('Edit iteration…')?.click();
		expect(fields()).toEqual([]);
		await submitDialog({});
		expect(harness.vault.fm(SPRINT)).toEqual({ type: 'Iteration', order: 10 });
	});

	it('removes the goal key when the goal is cleared', async () => {
		const harness = open();
		Menu.lastShown?.item('Edit iteration…')?.click();
		await submitDialog({ Goal: '' });
		expect(Object.keys(harness.vault.fm(SPRINT))).not.toContain('goal');
	});
});

describe('the gate, before the dialog', () => {
	it('refuses both actions on a broken configuration, before a field is typed', async () => {
		// `createBacklogItem` performs no validation of its own — only the ordinary New
		// flow runs the gate before reaching it — so a toolbar action calling it directly
		// is a creation surface accepting a configuration every other one refuses. With
		// the goal property colliding with the type key, the goal would overwrite
		// `type: Iteration` and the new note would not be an iteration at all.
		//
		// Gated on OPEN rather than on submit, so the reader is told what to fix before
		// filling in a name and two dates. `runInit` is the precedent and the reason.
		const harness = open({ ...OPTIONS, iterationGoalProperty: 'note.type' });
		Menu.lastShown?.item('New iteration…')?.click();
		expect(Modal.lastOpened).toBeNull();

		Menu.lastShown?.item('Edit iteration…')?.click();
		expect(Modal.lastOpened).toBeNull();
		await flush();
		expect(harness.vault.writeLog).toEqual([]);
	});

	it('refuses an unnamed iteration', async () => {
		const harness = open();
		Menu.lastShown?.item('New iteration…')?.click();
		await submitDialog({ Name: '   ' });
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toContain('name');
		expect(harness.vault.fm('Sprint 13.md')).toEqual({});
	});
});

describe('the dialog outlives the model it was opened on', () => {
	it('writes nothing when the iteration is retyped while the dialog is open', async () => {
		// A dialog stays open across refreshes, so the item it holds is a snapshot. Retyped
		// to a work item — or to a `Milestone`, whose own target the axis write would
		// overwrite — an unconditional write would put an iteration's dates on the wrong
		// kind of note. `applySafely` cannot catch it: the configuration and the filter are
		// both unchanged. Found by review (Codex, PR #154).
		const vault = sprintVault();
		const harness = open(OPTIONS, SPRINT, vault);
		Menu.lastShown?.item('Edit iteration…')?.click();

		vault.setFrontmatter(SPRINT, { type: 'Milestone', order: 10, due: '2026-08-16' });
		refresh(harness.view, vault);
		await submitDialog({ Start: '2026-09-01', Target: '2026-09-14' });

		expect(vault.writeLog).toEqual([]);
		expect(vault.fm(SPRINT).due).toBe('2026-08-16');
	});
});
