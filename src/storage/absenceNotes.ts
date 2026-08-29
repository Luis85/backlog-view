import { App, stringifyYaml, TFile } from 'obsidian';
import { isResourceType } from '../domain/itemTypes';
import { ownValue, readString } from '../domain/noteFields';
import { BacklogSettings } from '../domain/settings';
import { vaultFolder } from '../domain/settingsResolve';
import { ABSENCE_TYPE } from '../domain/typeVocabulary';
import { ensureFolder, uniqueNotePath, wikilinkTo } from './createNote';
import { refusesLiveAssignee } from './frontmatter';
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
 *
 * **Both writers ask ONE question about the resource they name, through the ONE guard
 * `applyWrites` asks it with** — `refusesLiveAssignee` (`frontmatter.ts`), imported rather
 * than restated. One rather than two because it is one question: an absence's resource and
 * an item's assignee are the same link, to the same `settings.assigneeKey`, about a note
 * that may have been retyped out of `Resource` since the form's roster was captured. Two
 * guards would be two places to keep the guard's own two cache rules in step — a MISSING
 * cache is no answer rather than a "no", and a DELETED target must not ride in on that
 * same null — and this module has no better view of either than that function does.
 *
 * **It is asked at the LAST moment before the write, not at the top of the function**, and
 * the difference is a real window rather than a tidiness preference. Both writers await
 * before they write — `processFrontMatter` resolves its own I/O before it runs the
 * callback, and the create path awaits `ensureFolder` — so a check made before those awaits
 * is a check with a gap after it, and another vault operation retyping the resource inside
 * that gap lands the very link this guard exists to refuse. That is the identical argument
 * `applyWrites` makes about the carrier's type, reaching the same answer from the other
 * side: it asks inside the callback because that is the one place the value is READABLE,
 * and this asks there because that is the last place the answer is still TRUE.
 *
 * `vault.create` takes no callback, so the create path's last readable moment is the line
 * before it. A refusal there can leave behind a folder `ensureFolder` just made — the
 * absence folder, which the next absence would create anyway — and that is the accepted
 * price of one check instead of two (Codex review, PR #209).
 */

/**
 * Everything a NEW absence note needs: the `Resource` it names, the days it covers, and
 * where it goes and what it is called.
 *
 * Does NOT extend `AbsenceFacts` (`domain/absences.ts`) any more — that type carries the
 * resource as a `LinkEntry`, read off a note that may not resolve, while by the time a
 * `AbsenceSpec` exists the resource has already been chosen from the roster: there is no
 * unresolved case left to represent, only a real `TFile` to spell as a link.
 */
/**
 * What {@link updateAbsenceNote} did, one value per outcome rather than a boolean: the two
 * refusals are two different notes moving under one open modal, and the caller reports
 * which. Read as a type rather than a set of booleans because they are exclusive — the
 * target is asked about first and the note is never opened when it answers.
 */
export type AbsenceEdit = 'written' | 'becameResource' | 'staleResource';

export interface AbsenceSpec {
	resource: TFile;
	start: string;
	target: string;
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
 *
 * **Returns `null` where the resource it was asked to name is no longer one** — the module
 * docblock's shared guard, asked after `ensureFolder`'s await and before `vault.create`, so
 * a refusal leaves no note behind to take back. ONE refusal here against {@link
 * updateAbsenceNote}'s two: there is no note yet for the other race to have retyped
 * underneath this call.
 */
export async function createAbsenceNote(app: App, settings: BacklogSettings, spec: AbsenceSpec): Promise<TFile | null> {
	const folder = vaultFolder(spec.folder);
	await ensureFolder(app, folder);
	const path = uniqueNotePath(app, folder, spec.title);
	// After every await, never before them — see the module docblock. Nothing has been
	// written at this line, so a refusal here leaves no note behind to take back.
	if (refusesLiveAssignee(app, spec.resource, settings)) return null;
	// One atomic write, `createBacklogItem`'s own rule: a create-then-update pair could
	// fail in between and leave a note that is an absence in name and a blank note in fact.
	const fm: Record<string, unknown> = {};
	setOwn(fm, settings.typeKey, ABSENCE_TYPE);
	setOwn(fm, settings.assigneeKey, wikilinkTo(app, spec.resource, path));
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
 *
 * **Returns WHICH of three things happened**, because two different notes can move under
 * one open modal and the reader is owed which one did. `staleResource` is the resource this
 * absence names, retyped out of `Resource` since the form captured its roster — the module
 * docblock's shared guard, asked INSIDE the callback beside the carrier's own question, so
 * the two races are refused at one moment rather than at two with a gap between them.
 * `becameResource` is the note being EDITED, retyped INTO one, which is the refusal below
 * and reads on:
 *
 * The edit modal that produced `spec` was opened against
 * this file while it was an absence, and both Obsidian's options pane and the vault
 * itself stay reachable while it is up — so the note can be retyped to `Resource` between
 * open and submit. `applyWrites` and `applyPropertyWrites` ask the identical question
 * inside their own `processFrontMatter` callback, for the identical reason: it is the one
 * place the live type is readable before the file is touched. This writer shares none of
 * their path — no batch, no `configProblems` gate, no undo slot — so the question is asked
 * again here rather than inherited, using the same `readString(ownValue(fm, …))` +
 * `isResourceType` shape rather than a second reader. The caller (`editAbsence`) must not
 * rename a note this refuses — under EITHER reason: the rename is the other half of what
 * the carrier's refusal protects a resource from, and under the target's it would spell a
 * stale resource's name into the note's own title.
 *
 * `spec` is `AbsenceSpec` minus its location and its name — the same three writable facts
 * `createAbsenceNote` takes, `resource` already resolved to the `TFile` it names.
 */
export async function updateAbsenceNote(
	app: App,
	settings: BacklogSettings,
	file: TFile,
	spec: Pick<AbsenceSpec, 'resource' | 'start' | 'target'>,
): Promise<AbsenceEdit> {
	// The outcome itself rather than a flag, so both refusals are stated where they are
	// decided and neither can be re-derived wrongly on the way out.
	let outcome: AbsenceEdit = 'written';
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		if (isResourceType(readString(ownValue(fm, settings.typeKey)))) {
			outcome = 'becameResource';
			return;
		}
		// Inside the callback beside the carrier's question, not before the await that
		// opened the file — see the module docblock.
		if (refusesLiveAssignee(app, spec.resource, settings)) {
			outcome = 'staleResource';
			return;
		}
		setOwn(fm, settings.assigneeKey, wikilinkTo(app, spec.resource, file.path));
		setOwn(fm, settings.startKey, spec.start);
		setOwn(fm, settings.targetKey, spec.target);
	});
	return outcome;
}

/**
 * Give the note a new name, which is what changing an absence's TITLE means.
 *
 * Through `fileManager.renameFile`, never `vault.rename`: the former updates every link
 * that names this note, which matters here for the same reason it matters anywhere —
 * nothing stops a reader linking to an absence from a planning note.
 *
 * A no-op where the name has not changed, asked as ONE question: the path this title
 * resolves to, against the path the note already has. That single comparison answers both
 * halves it used to take two rules to answer — the title is sanitized on the way (`Offsite?`
 * typed over `Offsite` is one file name and two strings), and the note's own path is free
 * rather than taken (`uniqueNotePath`'s `self`), so a note that once landed at `X 1` is
 * re-confirmed there instead of ratcheting to `X 2` on every later edit. Both are the same
 * rule: a title edit that changes nothing must change nothing.
 */
export async function renameAbsenceNote(app: App, file: TFile, title: string): Promise<void> {
	const folder = file.parent?.path ?? '';
	const path = uniqueNotePath(app, folder === '/' ? '' : folder, title, file);
	if (path === file.path) return;
	await app.fileManager.renameFile(file, path);
}

/**
 * Remove the note, through Obsidian's OWN delete rather than this backlog's undo.
 *
 * There is no batch to reverse: an absence was never one of this plugin's write targets,
 * so the gate captured no inverse of the write that created it and has none of the
 * deletion either. `trashFile` honours the user's own "deleted files" setting, which is
 * the recovery path that belongs to a whole note going away — and the one the user
 * already knows, since it is every other note's.
 *
 * **Deliberately NOT given `updateAbsenceNote`'s live-type refusal.** The same race is
 * reachable here — the menu that names `file` can sit open while the note is retyped to
 * `Resource` before the click lands — but the Guarantee this refusal exists for
 * (`docs/requirements/A resource is not a backlog item.md`) is that no forward WRITE lands
 * on one, and a trash is not a write: it changes no field and leaves nothing for a stray
 * value to corrupt silently. It is also the coarser and more visible failure of the two —
 * the note disappearing is immediately obvious, where `updateAbsenceNote`'s hole would have
 * been a quiet field overwrite with no undo slot behind it — and its recovery path is
 * already named above rather than borrowed from the write boundary. So this is a
 * considered "no", not an oversight: the hole editAbsence closed was a write, and this act
 * has none.
 */
export async function deleteAbsenceNote(app: App, file: TFile): Promise<void> {
	await app.fileManager.trashFile(file);
}
