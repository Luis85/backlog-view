import { Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { showMenuForClick } from './menu';
import { AbsencePromptModal, AbsenceResult } from '../../ui/prompts';
import { Absence, absencesConfigured, absenceTitle } from '../../domain/absences';
import { formatCivil } from '../../domain/timeline';
import { folderForType } from '../../domain/itemTypes';
import { ResourceLane } from '../../domain/roadmap';
import { configProblems } from '../../domain/settingsConsistency';
import { ABSENCE_TYPE } from '../../domain/typeVocabulary';
import {
	AbsenceSpec,
	createAbsenceNote,
	deleteAbsenceNote,
	renameAbsenceNote,
	updateAbsenceNote,
} from '../../storage/absenceNotes';

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
	const folder = absenceFolder(host);
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
		onSubmit: (result) => void writeAbsence(host, result),
	}).open();
}

/**
 * Where an absence is filed: its own configured folder, else the home folder, else the
 * vault root — `promptCreateItem`'s ladder minus the two rungs an absence has no question
 * about (no parent, so no folder-mode "beside the parent's folder note", and nothing to
 * infer from since it is not a work item).
 *
 * Asked TWICE on purpose, once to say where the note will go and once to put it there.
 * The description is what the configuration said when the form opened; the write follows
 * the configuration at SUBMIT, which is the same rule `refusedByConfig` is re-asked under
 * — the options pane stays reachable while a modal is up, and the reader's newest
 * statement of where absences live is the one they meant. The ordinary creation flow
 * resolves at submit for exactly this reason (`folderFor` in `interactions/create.ts`),
 * and this one captured the string at open until review pointed at the difference.
 */
function absenceFolder(host: BacklogViewHost): string {
	return folderForType(ABSENCE_TYPE, host.settings) || host.settings.homeFolder;
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
		description: 'Changes who is away and for how long. The note is renamed to match.',
		resource: absence.resource,
		editing: { start: formatCivil(absence.start), target: formatCivil(absence.target) },
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
	if (!result.start || !result.target) return 'An absence needs both a start and an end date.';
	if (result.target < result.start) return 'The end date is before the start date.';
	return null;
}

/**
 * The absence mark's own context menu: one entry each, and deliberately not
 * `buildItemMenu`. Every entry in that menu is about a work item — a type, a state, a
 * parent link, a rank — and an absence has none of them.
 *
 * `chipMenu`'s shape (`interactions/menu.ts`) over a mark rather than a control, but
 * WITHOUT the `stopPropagation` it carries: the mark is a child of the header
 * `TimelineDrawing.laneElement` registers, and the band's drop depends on `dragover` and
 * `drop` bubbling up to it (`renderLaneAbsences`'s own doc comment). Stopping propagation
 * here would recreate `docs/bugs/An absence stretch is a dead spot in its own band.md`.
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
 * one the reader can see and fix — the right dates under the old name. Both halves now
 * follow from one edit rather than from two fields: the three facts decide the frontmatter
 * AND the derived name, so a new date is what moves both.
 *
 * Driven, not merely stated: `test/view/resourceAbsences.test.ts` refuses the frontmatter
 * write of an edit that also changes the derived name, and asserts the note still answers
 * to its old name — which is exactly what swapping the two acts breaks.
 */
async function editAbsence(host: BacklogViewHost, absence: Absence, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	try {
		await updateAbsenceNote(host.app, host.settings, absence.file, {
			resource: result.resource,
			start: result.start,
			target: result.target,
		});
		await renameAbsenceNote(host.app, absence.file, absenceTitle(result));
		// The note's OWN name, never the requested one — `uniqueNotePath` sanitizes the
		// title and appends a number where one is taken, so a rename onto an existing
		// `Vacation` lands as `Vacation 1` and naming the request would send the reader
		// looking for a note that does not exist. `writeAbsence` below already reports
		// `file.basename` for the same reason; a rename mutates the `TFile` in place, so
		// this reads the name the note now answers to.
		new Notice(`Updated "${absence.file.basename}".`);
	} catch (e) {
		console.error('Product Backlog: failed to edit the absence', e);
		new Notice('Could not save the absence. See the developer console for details.');
	}
}

async function writeAbsence(host: BacklogViewHost, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	try {
		// The spread comes FIRST, so the derived name wins over anything the form's own
		// result might one day carry under that key. That ORDER is the whole guarantee: the
		// annotation pins the fields `AbsenceSpec` requires, and excess-property checking
		// does NOT reach a key arriving through a spread — checked against this repo's own
		// compiler rather than assumed, since the opposite was written here first.
		const spec: AbsenceSpec = { ...result, folder: absenceFolder(host), title: absenceTitle(result) };
		const file = await createAbsenceNote(host.app, host.settings, spec);
		new Notice(`Marked ${result.resource} away — "${file.basename}".`);
	} catch (e) {
		console.error('Product Backlog: failed to create the absence', e);
		new Notice('Could not create the absence. See the developer console for details.');
	}
}
