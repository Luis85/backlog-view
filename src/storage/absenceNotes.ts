import { App, stringifyYaml, TFile } from 'obsidian';
import { AbsenceFacts } from '../domain/absences';
import { BacklogSettings } from '../domain/settings';
import { vaultFolder } from '../domain/settingsResolve';
import { ABSENCE_TYPE } from '../domain/typeVocabulary';
import { ensureFolder, sanitizeTitle, uniqueNotePath } from './frontmatter';
import { setOwn } from './ownProperty';

/**
 * The vault acts an absence has, and the only ones: create the note, and trash it.
 *
 * Its own module rather than a pair of functions in `frontmatter.ts`, for two reasons
 * that point the same way. That file is at its 400-line budget. And neither act goes
 * through `applyWrites`: an absence is not a write target of this backlog — no batch, no
 * captured inverse, no undo slot — so putting them beside the batch writer would file
 * them under a mechanism they deliberately do not use. What they DO share with it is the
 * rule that makes `storage/` a boundary at all: everything that puts bytes in the vault
 * is in this directory, which is why the delete is here too even though no lint rule
 * names `trashFile` the way `no-restricted-syntax` names `vault.create`.
 */

/** Everything a NEW absence note needs: what it says, plus where it goes and what it is called. */
export interface AbsenceSpec extends AbsenceFacts {
	folder: string;
	title: string;
}

/**
 * Create one absence note.
 *
 * NOT `createBacklogItem` with different arguments. That function's `NewItemSpec` carries
 * a parent, a rank and a type chosen from the ladder, and an absence has none of the
 * three — it would be three fields passed as null and a fourth passed as a constant,
 * which is a different function wearing another's signature.
 *
 * Every key here is known non-empty: `absencesConfigured` is the caller's gate and
 * `typeKey` always resolves — so the "never write to an unconfigured key" rule is kept by
 * the gate in front rather than by a guard per key, which is the one place this differs
 * from `applyInto` and worth saying out loud.
 */
export async function createAbsenceNote(app: App, settings: BacklogSettings, spec: AbsenceSpec): Promise<TFile> {
	const folder = vaultFolder(spec.folder);
	await ensureFolder(app, folder);
	const path = uniqueNotePath(app, folder, spec.title);
	// One atomic write, `createBacklogItem`'s own rule: a create-then-update pair could
	// fail in between and leave a note that is an absence in name and a blank note in fact.
	const fm: Record<string, unknown> = {};
	setOwn(fm, settings.typeKey, ABSENCE_TYPE);
	setOwn(fm, settings.assigneeKey, spec.resource);
	setOwn(fm, settings.startKey, spec.start);
	setOwn(fm, settings.targetKey, spec.target);
	return app.vault.create(path, `---\n${stringifyYaml(fm)}---\n`);
}

/**
 * Rewrite one absence in place: who it is for, and the days it covers.
 *
 * The three facts are set through `setOwn` on the SAME keys `createAbsenceNote` writes, so
 * a note written by one and edited by the other cannot end up with two spellings of one
 * fact. `processFrontMatter` rather than a re-create, for the reason the whole storage
 * boundary exists: this is an edit of a note the reader already has links and history to,
 * not a new one.
 *
 * The TITLE is not here, because it is not frontmatter — an absence's title is its
 * basename, so changing it is a RENAME and belongs to {@link renameAbsenceNote}. Two acts
 * rather than one, since only one of them can fail on a name collision and only one has to
 * carry every link that names the note with it.
 *
 * Outside `applyWrites` like the create and the delete beside it: an absence is not a
 * write target of this backlog, so there is no batch, no captured inverse and no undo
 * slot. What takes an edit back is Obsidian's own file history.
 */
export async function updateAbsenceNote(
	app: App,
	settings: BacklogSettings,
	file: TFile,
	spec: AbsenceFacts,
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		setOwn(fm, settings.assigneeKey, spec.resource);
		setOwn(fm, settings.startKey, spec.start);
		setOwn(fm, settings.targetKey, spec.target);
	});
}

/**
 * Give the note a new name, which is what changing an absence's TITLE means.
 *
 * Through `fileManager.renameFile`, never `vault.rename`: the former updates every link
 * that names this note, which matters here for the same reason it matters anywhere —
 * nothing stops a reader linking to an absence from a planning note.
 *
 * A no-op where the name has not changed, checked against the file's own basename rather
 * than against what the form was opened with: those differ the moment two edits race, and
 * a rename to the name a note already has is a needless write that `uniqueNotePath` would
 * answer by appending a number.
 *
 * The comparison is of the SANITIZED title, because that is what the other side of it is:
 * a basename has already been through `sanitizeTitle`, so `Offsite?` typed over `Offsite`
 * is one file name and two strings — and the raw comparison let it past, where
 * `uniqueNotePath` found the note's own path occupied and renamed it to `Offsite 1`. A
 * title edit that changes nothing must change nothing.
 */
export async function renameAbsenceNote(app: App, file: TFile, title: string): Promise<void> {
	if (sanitizeTitle(title) === file.basename) return;
	const folder = file.parent?.path ?? '';
	await app.fileManager.renameFile(file, uniqueNotePath(app, folder === '/' ? '' : folder, title));
}

/**
 * Remove the note, through Obsidian's OWN delete rather than this backlog's undo.
 *
 * There is no batch to reverse: an absence was never one of this plugin's write targets,
 * so the gate captured no inverse of the write that created it and has none of the
 * deletion either. `trashFile` honours the user's own "deleted files" setting, which is
 * the recovery path that belongs to a whole note going away — and the one the user
 * already knows, since it is every other note's.
 */
export async function deleteAbsenceNote(app: App, file: TFile): Promise<void> {
	await app.fileManager.trashFile(file);
}
