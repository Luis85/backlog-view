import { App } from 'obsidian';
import { ensureFolder } from './createNote';
import { vaultFolder } from '../domain/settingsResolve';
import { GeneratedWriteResult, writeGeneratedFile } from './readmeFile';

/**
 * The release notes file — the second document this plugin owns whole, and the second
 * caller of `writeGeneratedFile`. `domain/releaseNotesText.ts` decides what it says; this
 * decides where it goes and whether it may be written at all.
 *
 * The suffix is DATA, not a message: it is part of a file name the plugin writes and then
 * matches, so two readers in two Obsidian languages must not disagree about which file is
 * which. The root guide's own test — "one writes notes the other's view cannot read" — is
 * exactly this case.
 */
const NOTES_SUFFIX = 'release notes';

/**
 * Where a release's notes live. The basename comes from a note that already exists, so it
 * is already a legal file name and nothing here sanitizes it.
 *
 * The fixed suffix is what keeps the output off the RELEASE NOTE itself when somebody
 * points the notes folder at the releases folder — a collision that would otherwise read
 * as a permanent refusal (the release note is not generated, so it is `foreign` forever)
 * rather than as the mistake it is.
 */
export function releaseNotesPath(folder: string, releaseBasename: string): string {
	const dir = vaultFolder(folder);
	const name = `${releaseBasename} ${NOTES_SUFFIX}.md`;
	return dir ? `${dir}/${name}` : name;
}

/**
 * Write one release's notes, creating the folder if it does not exist.
 *
 * Created rather than refused: every write path in this plugin makes its own folder, and
 * a notes file that did not would be the only write in the plugin that fails on a folder
 * the reader just named. That is a correction to extension 4e, recorded in the spec.
 *
 * `'refuse'` rather than the README's `'replace'`, and the difference is not a preference:
 * a whole-file write over another release's notes is not in the undo slot and cannot be
 * taken back at all, while a README replaced by a renamed view is one regeneration away
 * from being right again.
 */
/**
 * **Why `refuse` and not `replace`, and what it costs.**
 *
 * `writeBacklogReadme` passes `replace` deliberately: its own comment says refusing would
 * brick a renamed base or view, since those change the marker line without changing who
 * owns the file. That reasoning applies here too — rename the `.base`, rename the view, or
 * move the release to another folder keeping its basename, and this file's source changes
 * while its path does not. The next generation then reads its own previous output as
 * another release's and refuses, on every press, until somebody removes or renames it.
 *
 * Taken anyway, because the two failures are not the same size. A refusal is loud,
 * recoverable and says how to recover (`release.notes.refused` names the file and the
 * escape). The alternative is a whole-file overwrite of another release's notes, in no
 * undo slot, with a different population and no notice — two releases can share a basename
 * in different folders, so they can share this output path.
 *
 * A rename-proof identity would beat both and is not available: Obsidian has no stable
 * note id, so a renamed base and a different base are the same evidence from here.
 * Migrating the marker when the identity changes is that same ambiguity restated — it
 * cannot tell a rename from the collision this mode exists to catch.
 */
export async function writeReleaseNotes(
	app: App,
	folder: string,
	releaseBasename: string,
	content: string,
): Promise<GeneratedWriteResult> {
	await ensureFolder(app, vaultFolder(folder));
	return writeGeneratedFile(app, releaseNotesPath(folder, releaseBasename), content, 'refuse');
}
