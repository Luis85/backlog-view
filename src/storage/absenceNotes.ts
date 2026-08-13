import { App, stringifyYaml, TFile } from 'obsidian';
import { BacklogSettings } from '../domain/settings';
import { vaultFolder } from '../domain/settingsResolve';
import { ABSENCE_TYPE } from '../domain/typeVocabulary';
import { ensureFolder, uniqueNotePath } from './frontmatter';
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

/** What an absence note is written from — four facts, and where to put them. */
export interface AbsenceSpec {
	folder: string;
	title: string;
	resource: string;
	/** Both ends as `YYYY-MM-DD`, already validated: this module writes, it does not judge. */
	start: string;
	target: string;
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
