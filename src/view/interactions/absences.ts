import { Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { showMenuForClick } from './menu';
import { AbsencePromptModal, AbsenceResult } from '../../ui/prompts';
import { Absence, absencesConfigured } from '../../domain/absences';
import { formatCivil } from '../../domain/timeline';
import { folderForType } from '../../domain/itemTypes';
import { ResourceLane } from '../../domain/roadmap';
import { configProblems } from '../../domain/settingsConsistency';
import { ABSENCE_TYPE } from '../../domain/typeVocabulary';
import { createAbsenceNote, deleteAbsenceNote, renameAbsenceNote, updateAbsenceNote } from '../../storage/absenceNotes';

/**
 * The view's half of an absence: opening the prompt from a resource's row header,
 * gating it, and writing what comes back.
 *
 * Not beside `interactions/create.ts`, which is the New flow over `NewItemSpec` — a
 * parent, a rank, a type from the ladder and a folder that depends on which type was
 * picked. An absence answers none of those questions, so what it shares with that file
 * is the config gate and nothing else.
 */

/**
 * Ask who is away and for how long, then write it.
 *
 * The gate runs FIRST, before the form: an action that took the user's typing and then
 * had its write refused would leave them worse off than one that never opened — the same
 * order `promptCreateItem` puts these in, for the same reason.
 */
export function promptAddAbsence(host: BacklogViewHost, lane: ResourceLane): void {
	if (refusedByConfig(host)) return;
	const folder = folderForType(ABSENCE_TYPE, host.settings) || host.settings.homeFolder;
	new AbsencePromptModal(host.app, {
		heading: 'Add absence',
		description: `Marks the resource unavailable for a stretch. Filed ${folder ? `in "${folder}"` : 'in the vault root'}.`,
		resource: lane.name,
		// The declared roster plus the row this was opened on, so a name typed here keeps
		// the spelling the view options gave it. Deliberately NOT the drawn rows, which
		// would be the wider list: reaching them means `host.roadmap`, which is nullable,
		// and the fallback arm is one no click can take — the control only exists while a
		// row is drawn. A branch nothing can reach is worse than a shorter list, and the
		// row in hand already covers the case the wider list was for.
		known: [...new Set([lane.name, ...host.settings.resourceNames])],
		validate: absenceProblem,
		onSubmit: (result) => void writeAbsence(host, folder, result),
	}).open();
}

/**
 * Change one already-placed stretch: who it is for, the days it covers, and its title.
 *
 * The SAME form the add flow opens, pre-filled — one validator, one field list, one set of
 * refusals, so the two acts cannot come to disagree about what an absence is. The gate runs
 * first for `promptAddAbsence`'s reason, which holds for an edit exactly as it does for a
 * creation: taking the reader's typing and then refusing the write leaves them worse off
 * than never opening.
 *
 * `known` leads with the name this stretch already carries rather than a row's, since that
 * is what this form is about; the roster follows it, the same list the add flow suggests.
 */
function promptEditAbsence(host: BacklogViewHost, absence: Absence): void {
	if (refusedByConfig(host)) return;
	new AbsencePromptModal(host.app, {
		heading: 'Edit absence',
		description: 'Changes who is away and for how long. Renaming it renames the note.',
		resource: absence.resource,
		editing: { title: absence.title, start: formatCivil(absence.start), target: formatCivil(absence.target) },
		known: [...new Set([absence.resource, ...host.settings.resourceNames])],
		validate: absenceProblem,
		onSubmit: (result) => void editAbsence(host, absence, result),
	}).open();
}

/**
 * The config gate both flows run BEFORE opening their form — `applySafely`'s own guard, at
 * the two paths that write a note without going through it — and AGAIN at submit, because
 * the form outlives the config it opened under: Obsidian's options pane stays reachable
 * while a modal is up, and a write after the narrowing would reach `setOwn(fm, '', ...)`.
 *
 * `absencesConfigured` rides beside it: sharper than `configProblems`, which does not
 * require the absence keys at all, and the check `createAbsenceNote`'s "the caller's gate"
 * comment names — kept here so every caller of either write function has run it.
 */
function refusedByConfig(host: BacklogViewHost): boolean {
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(`Fix the view options first: ${problems[0]}`);
		return true;
	}
	if (!absencesConfigured(host.settings)) {
		new Notice('Name the assignee and both date properties before recording absences.');
		return true;
	}
	return false;
}

/**
 * Why this entry is not an absence, or null. 2a and 2b, and both refuse rather than
 * correct: a written absence has no shelf to fall back to, so there would be no surface
 * left to show the mistake on once the note existed.
 *
 * The range compares as TEXT, which is exact rather than lax here: the fields are
 * `type="date"`, so both values are zero-padded ISO dates or empty, and those order
 * lexically exactly as the calendar does. `readAbsence` asks the same question of the
 * note's own values through `reversedSpan`, because by then the values came from
 * frontmatter and no longer carry that guarantee.
 */
function absenceProblem(result: AbsenceResult): string | null {
	if (!result.resource) return 'Name the resource this absence is for.';
	if (!result.title) return 'Give the absence a title.';
	if (!result.start || !result.target) return 'An absence needs both a start and an end date.';
	if (result.target < result.start) return 'The end date is before the start date.';
	return null;
}

/**
 * The absence row's own context menu: one entry, and deliberately not `buildItemMenu`.
 * Every entry in that menu is about a work item — a type, a state, a parent link, a rank
 * — and an absence has none of them.
 *
 * `chipMenu`'s shape (`interactions/menu.ts`) over a row rather than a control, and the
 * `stopPropagation` it carries is not needed here: an absence row is not a card, so
 * nothing wired `wireCardActivation` on it and there is no row action to bubble into.
 */
export function showAbsenceMenu(host: BacklogViewHost, absence: Absence, evt: MouseEvent): void {
	evt.preventDefault();
	const menu = new Menu();
	menu.addItem((mi) =>
		mi
			.setTitle('Edit absence')
			.setIcon('pencil')
			.onClick(() => promptEditAbsence(host, absence)),
	);
	menu.addItem((mi) =>
		mi
			.setTitle('Delete absence')
			.setIcon('trash-2')
			.onClick(() => void removeAbsence(host, absence)),
	);
	showMenuForClick(menu, evt);
}

async function removeAbsence(host: BacklogViewHost, absence: Absence): Promise<void> {
	try {
		await deleteAbsenceNote(host.app, absence.file);
		new Notice(`Deleted "${absence.title}".`);
	} catch (e) {
		console.error('Product Backlog: failed to delete the absence', e);
		new Notice('Could not delete the absence. See the developer console for details.');
	}
}

/**
 * Apply an edit: the frontmatter first, then the rename.
 *
 * That order is deliberate and not an implementation detail. A rename moves the file and
 * every link naming it; doing it first and then failing on the frontmatter would leave a
 * note renamed to describe a stretch it does not hold. This way the worst outcome is the
 * one the reader can see and fix — the right dates under the old name.
 *
 * Stated, not driven: no test injects a failure between the two acts, so the ordering is
 * held by this paragraph and review rather than by a check that fails when they swap.
 */
async function editAbsence(host: BacklogViewHost, absence: Absence, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	try {
		await updateAbsenceNote(host.app, host.settings, absence.file, {
			resource: result.resource,
			start: result.start,
			target: result.target,
		});
		await renameAbsenceNote(host.app, absence.file, result.title);
		new Notice(`Updated "${result.title}".`);
	} catch (e) {
		console.error('Product Backlog: failed to edit the absence', e);
		new Notice('Could not save the absence. See the developer console for details.');
	}
}

async function writeAbsence(host: BacklogViewHost, folder: string, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	try {
		const file = await createAbsenceNote(host.app, host.settings, { folder, ...result });
		new Notice(`Marked ${result.resource} away — "${file.basename}".`);
	} catch (e) {
		console.error('Product Backlog: failed to create the absence', e);
		new Notice('Could not create the absence. See the developer console for details.');
	}
}
