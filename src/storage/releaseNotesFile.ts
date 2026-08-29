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
export async function writeReleaseNotes(
	app: App,
	folder: string,
	releaseBasename: string,
	content: string,
): Promise<GeneratedWriteResult> {
	await ensureFolder(app, vaultFolder(folder));
	return writeGeneratedFile(app, releaseNotesPath(folder, releaseBasename), content, 'refuse');
}
