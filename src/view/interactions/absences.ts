import { Menu, Notice, TFile } from 'obsidian';
import { BacklogViewHost } from '../host';
import { showMenuForClick } from './menu';
import { AbsencePromptModal, AbsenceResult } from '../../ui/prompts';
import { Absence, absencesConfigured, absenceTitle } from '../../domain/absences';
import { formatCivil } from '../../domain/timeline';
import { folderForType } from '../../domain/itemTypes';
import { namedTargets } from '../../domain/readItems';
import { AssignableLane } from '../../domain/roadmap';
import { configProblems } from '../../domain/settingsConsistency';
import { ABSENCE_TYPE } from '../../domain/typeVocabulary';
import {
	AbsenceSpec,
	createAbsenceNote,
	deleteAbsenceNote,
	renameAbsenceNote,
	updateAbsenceNote,
} from '../../storage/absenceNotes';
import { t } from '../../i18n/t';

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
 * The resources an absence may name, as id/label pairs — the note's own path and the
 * label `namedTargets` gives it, so two resources sharing a basename are two options the
 * reader can tell apart rather than two identical entries (the same disambiguation
 * `BacklogModel.resourceLabels` carries for every other surface, asked directly here
 * because this caller needs the roster itself, not only its labels). Built once per open
 * of the form, never per row and never per absence.
 */
function resourceChoices(host: BacklogViewHost): { id: string; label: string }[] {
	return namedTargets(host.model?.resources ?? []).map((target) => ({ id: target.item.file.path, label: target.label }));
}

/** The `Resource` note an offered id names, or null once the model has moved past it. */
function resourceById(host: BacklogViewHost, id: string): TFile | null {
	return host.model?.resources.find((resource) => resource.file.path === id)?.file ?? null;
}

/**
 * The roster to open the form with, or the refusal for why there is none — asked AFTER
 * `refusedByConfig`, on the same "check first, open nothing broken" rule: an absence with
 * nobody to be away is not a thing to collect, so a form with no resource to offer must
 * never open at all rather than open onto a choice that cannot be made.
 *
 * `promptAddAbsence`'s own gate and not `promptEditAbsence`'s (see that function's own
 * comment for why it needs none): unreachable through the ADD button too, today —
 * `renderLaneAbsenceAdd` draws one per LANE, and a lane is a `Resource` note by
 * construction (`deriveLanes`, Task 5), so the button cannot exist while the roster is
 * empty. Kept rather than asserted away, unlike `domain/roadmap.ts`'s `labelOf`: a caller
 * that opened this form WITHOUT going through a lane — a command, a toolbar button not
 * tied to a row — would make it reachable, where nothing could ever hand `labelOf` a
 * model built from a different `resources` array than the one its map was built from.
 * Driven directly at this boundary in `test/view/absenceEditing.test.ts`, the way
 * `test/view/cardDrag.test.ts` drives a host nothing renders.
 */
function resourcesOrRefuse(host: BacklogViewHost): { id: string; label: string }[] | null {
	const resources = resourceChoices(host);
	if (resources.length === 0) {
		new Notice(t('absence.noResources'));
		return null;
	}
	return resources;
}

/**
 * Ask who is away and for how long, then write it.
 *
 * The gate runs FIRST, before the form: an action that took the user's typing and then
 * had its write refused would leave them worse off than one that never opened — the same
 * order `promptCreateItem` puts these in, for the same reason.
 */
export function promptAddAbsence(host: BacklogViewHost, lane: AssignableLane): void {
	if (refusedByConfig(host)) return;
	const resources = resourcesOrRefuse(host);
	if (!resources) return;
	const folder = absenceFolder(host);
	new AbsencePromptModal(host.app, {
		heading: t('absence.addHeading'),
		// Two whole sentences picked between, never a clause spliced into a shared frame: a
		// locale that leads with the location has no way into a middle assembled here.
		description: folder ? t('absence.addInFolder', { folder }) : t('absence.addInRoot'),
		resources,
		// The row's own note, so the pre-selection is guaranteed to be an offered choice:
		// every lane but the milestones' one is a `Resource` note by construction, and this
		// is the narrowed type that guarantees it (`AssignableLane`).
		resource: lane.file.path,
		validate: (result) => absenceProblem(result, resources),
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
 * The roster offered is the same one the add flow offers — every `Resource` note the
 * model carries — never led with this stretch's own, since a note is not "first" the way
 * a typed name once was.
 *
 * No `resourcesOrRefuse` here, unlike the add flow: this form opens from a drawn MARK,
 * and a mark draws only once `deriveLanes` has already resolved `absence.resource` to a
 * lane — so AT THE MOMENT it was drawn, a `Resource` note was on the roster, the one this
 * stretch names. That does not survive Obsidian's own `Menu` staying open between the
 * right-click and the click on "Edit absence": a model rebuild in that window could drop
 * the resource, or every resource, before `resourceChoices` reads the roster fresh here —
 * the same gap `AbsencePromptModal`'s own placeholder comment names. Left unhandled by a
 * gate on purpose rather than missed: the placeholder branch and `absenceProblem`'s
 * refusal already answer an offered list with nothing matching, whatever emptied it, so a
 * check here would refuse the same submission a second way rather than a new one.
 */
function promptEditAbsence(host: BacklogViewHost, absence: Absence): void {
	if (refusedByConfig(host)) return;
	const resources = resourceChoices(host);
	new AbsencePromptModal(host.app, {
		heading: t('absence.editHeading'),
		description: t('absence.editDescription'),
		resources,
		// Asserted rather than guarded with a fallback, `domain/roadmap.ts`'s `labelOf` own
		// reason: this stretch drew as a mark in the first place only because its link
		// already resolved to a lane, so `file` is never null for any `absence` this
		// function is actually handed.
		resource: absence.resource.file!.path,
		editing: { start: formatCivil(absence.start), target: formatCivil(absence.target) },
		validate: (result) => absenceProblem(result, resources),
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
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return true;
	}
	if (!absencesConfigured(host.settings)) {
		new Notice(t('absence.needsProperties'));
		return true;
	}
	return false;
}

/**
 * Why this entry is not an absence, or null. 2a and 2b, and both refuse rather than
 * correct: a written absence has no shelf to fall back to, so there would be no surface
 * left to show the mistake on once the note existed.
 *
 * The resource is checked against the OFFERED list rather than merely for presence —
 * `resources` is the whole vocabulary the form rendered, so a submission naming an id
 * outside it is unreachable through the `<select>` and can only mean the defensive
 * placeholder was left selected. Same refusal either way: nobody is named.
 *
 * The range compares as TEXT, which is exact rather than lax here: the fields are
 * `type="date"`, so both values are zero-padded ISO dates or empty, and those order
 * lexically exactly as the calendar does. `readAbsence` asks the same question of the
 * note's own values through `reversedSpan`, because by then the values came from
 * frontmatter and no longer carry that guarantee.
 */
function absenceProblem(result: AbsenceResult, resources: { id: string; label: string }[]): string | null {
	if (!resources.some((resource) => resource.id === result.resource)) return t('absence.nameResource');
	if (!result.start || !result.target) return t('absence.needsBothDates');
	if (result.target < result.start) return t('absence.endBeforeStart');
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
			.setTitle(t('absence.edit'))
			.setIcon('pencil')
			.onClick(() => promptEditAbsence(host, absence)),
	);
	menu.addItem((mi) =>
		mi
			.setTitle(t('absence.delete'))
			.setIcon('trash-2')
			.onClick(() => void removeAbsence(host, absence)),
	);
	showMenuForClick(menu, evt);
}

async function removeAbsence(host: BacklogViewHost, absence: Absence): Promise<void> {
	try {
		await deleteAbsenceNote(host.app, absence.file);
		new Notice(t('absence.deleted', { title: absence.title }));
	} catch (e) {
		console.error('Product Backlog: failed to delete the absence', e);
		new Notice(t('absence.deleteFailed'));
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
 *
 * A THIRD outcome joins those two: `updateAbsenceNote` can also refuse outright, because
 * the note it holds a stale reference to was retyped to `Resource` while this modal was
 * open. That refusal has to reach here rather than stay a silent no-op, because a rename
 * run anyway would still rename a resource — half of what the refusal exists to stop. So
 * the rename is skipped and reported exactly like any other failure, never attempted.
 *
 * A FOURTH, narrower than either: the id the form returned no longer names a `Resource`
 * this model carries — the roster moved under an open modal, the one race `validate`
 * cannot see, since it runs against the list captured at open. Reported rather than
 * silently dropped, for the same reason every other refusal here is.
 */
async function editAbsence(host: BacklogViewHost, absence: Absence, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	const resource = resourceById(host, result.resource);
	if (!resource) {
		new Notice(t('absence.resourceMissing'));
		return;
	}
	try {
		const wrote = await updateAbsenceNote(host.app, host.settings, absence.file, {
			resource,
			start: result.start,
			target: result.target,
		});
		if (!wrote) {
			new Notice(t('absence.becameResource'));
			return;
		}
		await renameAbsenceNote(
			host.app,
			absence.file,
			absenceTitle({ resource: { file: resource, raw: resource.basename }, start: result.start, target: result.target }),
		);
		// The note's OWN name, never the requested one — `uniqueNotePath` sanitizes the
		// title and appends a number where one is taken, so a rename onto an existing
		// `Vacation` lands as `Vacation 1` and naming the request would send the reader
		// looking for a note that does not exist. `writeAbsence` below already reports
		// `file.basename` for the same reason; a rename mutates the `TFile` in place, so
		// this reads the name the note now answers to.
		new Notice(t('absence.updated', { name: absence.file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to edit the absence', e);
		new Notice(t('absence.saveFailed'));
	}
}

/**
 * Create the note. `writeAbsence`'s own version of `editAbsence`'s fourth outcome: the id
 * the form returned may no longer name a `Resource` this model carries, the one race
 * `validate` cannot see since it runs against the list captured at open.
 */
async function writeAbsence(host: BacklogViewHost, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	const resource = resourceById(host, result.resource);
	if (!resource) {
		new Notice(t('absence.resourceMissing'));
		return;
	}
	try {
		const title = absenceTitle({ resource: { file: resource, raw: resource.basename }, start: result.start, target: result.target });
		const spec: AbsenceSpec = { resource, start: result.start, target: result.target, folder: absenceFolder(host), title };
		const file = await createAbsenceNote(host.app, host.settings, spec);
		new Notice(t('absence.created', { resource: resource.basename, name: file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to create the absence', e);
		new Notice(t('absence.createFailed'));
	}
}
