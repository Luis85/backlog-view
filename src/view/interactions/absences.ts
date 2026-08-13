import { Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { showMenuForClick } from './menu';
import { AbsencePromptModal, AbsenceResult } from '../../ui/prompts';
import { Absence } from '../../domain/absences';
import { folderForType } from '../../domain/itemTypes';
import { ResourceLane } from '../../domain/roadmap';
import { configProblems } from '../../domain/settingsConsistency';
import { ABSENCE_TYPE } from '../../domain/typeVocabulary';
import { createAbsenceNote, deleteAbsenceNote } from '../../storage/absenceNotes';

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
	// Creation writes frontmatter too — the same config guard as `applySafely`.
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(`Fix the view options first: ${problems[0]}`);
		return;
	}
	const folder = folderForType(ABSENCE_TYPE, host.settings) || host.settings.homeFolder;
	new AbsencePromptModal(host.app, {
		heading: 'Add absence',
		description: `Marks the resource unavailable for a stretch. Filed ${folder ? `in "${folder}"` : 'in the vault root'}.`,
		resource: lane.name,
		// The rows on screen, so a second absence for the same person cannot come to
		// spell that person differently from the row it draws in.
		known: host.roadmap?.roadmap.lanes.map((drawn) => drawn.name) ?? [lane.name],
		validate: absenceProblem,
		onSubmit: (result) => void writeAbsence(host, folder, result),
	}).open();
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

async function writeAbsence(host: BacklogViewHost, folder: string, result: AbsenceResult): Promise<void> {
	try {
		const file = await createAbsenceNote(host.app, host.settings, { folder, ...result });
		new Notice(`Marked ${result.resource} away — "${file.basename}".`);
	} catch (e) {
		console.error('Product Backlog: failed to create the absence', e);
		new Notice('Could not create the absence. See the developer console for details.');
	}
}
