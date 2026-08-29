import { App, TFile } from 'obsidian';
import { ensureFolder } from './createNote';
import { vaultFolder } from '../domain/settingsResolve';
import { README_FILE_NAME, readmeSource } from '../domain/readmeMarker';

/**
 * Writing the backlog README — the second vault write that is not a work item, and
 * here for the same reason `baseFile.ts` is: everything that puts bytes in the vault
 * lives in `storage/`, with no exception to remember. `domain/backlogReadme.ts`
 * decides what the file says; this decides whether it may be written at all.
 */

/**
 * What a write did. Four outcomes rather than a boolean, because the interesting
 * ones are the two that wrote nothing: `unchanged` is the repository-friendly no-op
 * (regenerating an identical file must not produce a commit), and `foreign` is the
 * refusal — a file of this name without the marker was written by somebody else and
 * is never replaced. Under `mismatch: 'refuse'` it is also the answer for a file that
 * IS generated but by another source, since the caller's next move is the same either
 * way: this file is not ours to replace.
 */
export type GeneratedOutcome = 'created' | 'updated' | 'unchanged' | 'foreign' | 'replaced';

/**
 * What to do with a file that IS this plugin's generated output but names another source.
 * Not a detail of the writer: it is the caller's judgement about whether its document can
 * be reconstructed, and the two callers answer differently for stated reasons.
 */
export type GeneratedMismatch = 'replace' | 'refuse';

export interface GeneratedWriteResult {
	outcome: GeneratedOutcome;
	path: string;
	/** On `replaced`: the view the old file named, for the notice that says so. */
	previous?: string;
}

/**
 * The first line, without what a round trip through another editor adds either side of
 * it: the carriage return a Windows checkout arrives with, and the byte-order mark an
 * editor may write when it saves the file as UTF-8. Both leave the document identical
 * to read and neither is the plugin's doing, so a marker that failed to match through
 * them would refuse regeneration for good — in exactly the git-backed, edited-elsewhere
 * workflow this document exists for, and with a notice blaming a file the user never
 * wrote.
 */
function firstLine(text: string): string {
	const end = text.indexOf('\n');
	return (end === -1 ? text : text.slice(0, end)).replace(/^\uFEFF/, '').replace(/\r$/, '');
}

/**
 * Where the README for `folder` lives — at the vault root for ''. Through `vaultFolder`,
 * the same answer the resolved settings and the document itself carry: the file must not
 * be created under one spelling while its folder is created under another, which is a
 * create that fails on a parent that exists.
 */
export function readmePath(folder: string): string {
	const dir = vaultFolder(folder);
	return dir ? `${dir}/${README_FILE_NAME}` : README_FILE_NAME;
}

/**
 * Write the generated README into `folder`, creating the folder if it does not exist.
 *
 * The marker check reads the file rather than trusting its name: this plugin's own
 * output may be replaced wholesale, and anything else may not. Reading also answers
 * the no-op question — an identical file is left untouched, so a team keeping the
 * vault in git gets a commit only when the configuration actually changed.
 *
 * Read first and `process` after, rather than `process` alone, precisely because of
 * those two outcomes: they promise that NOTHING is written, and a callback that hands
 * the file back unchanged has still been through a save. The replacement itself goes
 * through `process`, where the check and the write cannot come apart.
 *
 * There is no path where the absence of a file is a fact this function acts on later:
 * a create that loses a race falls into the very rules the lookup skipped, so the same
 * document appearing a moment sooner cannot turn a no-op or a refusal into an error.
 */
export async function writeGeneratedFile(
	app: App,
	path: string,
	content: string,
	mismatch: GeneratedMismatch,
): Promise<GeneratedWriteResult> {
	const existing = app.vault.getFileByPath(path);
	if (existing !== null) return replaceExisting(app, existing, path, content, mismatch);
	try {
		await app.vault.create(path, content);
	} catch (err) {
		// The same race as the one `process` closes, at the other end: sync, a second window
		// or a second command can land the file between the lookup above and this create,
		// which then rejects. The file that appeared is a file like any other, so it gets the
		// questions every existing file gets — ours and identical is still a no-op, somebody
		// else's is still refused — rather than a generic failure for a case the rules already
		// cover. Rethrown while the path is still empty: then the create failed for its own
		// reason (permissions, a full disk), and reporting a document written is worse.
		const raced = app.vault.getFileByPath(path);
		if (raced === null) throw err;
		return replaceExisting(app, raced, path, content, mismatch);
	}
	return { outcome: 'created', path };
}

/**
 * Write the generated README into `folder`, creating the folder if it does not exist.
 * A thin caller since the release notes became the second generated file: everything
 * above is what the two share, and `'replace'` is this one's own answer.
 */
export async function writeBacklogReadme(app: App, folder: string, content: string): Promise<GeneratedWriteResult> {
	await ensureFolder(app, vaultFolder(folder));
	return writeGeneratedFile(app, readmePath(folder), content, 'replace');
}

/** The rules a file that is already there gets, from either route into them. */
async function replaceExisting(
	app: App,
	existing: TFile,
	path: string,
	content: string,
	mismatch: GeneratedMismatch,
): Promise<GeneratedWriteResult> {
	const current = await app.vault.read(existing);
	if (current === content) return { outcome: 'unchanged', path };
	// One question, asked once: a file is ours when its first line PARSES as a marker,
	// never when it merely opens like one. Testing the prefix alone would hand the
	// whole file to `modify` on the strength of an opening somebody could write in a
	// comment of their own — and a half-written marker, from a truncated write or a
	// bad merge, is exactly the file most worth not overwriting.
	if (readmeSource(firstLine(current)) === null) return { outcome: 'foreign', path };
	// Generated, but by whom. Two views may share a home folder and configure
	// different property keys, and a folder holds one contract at a time — so the
	// write goes through and the caller is told whose document it just replaced.
	// Refusing instead would brick the ordinary cases: a renamed base or view, or a
	// file git rewrote, all of which change the line without changing the owner.
	const mine = readmeSource(firstLine(content));
	// `process` rather than `modify`: it reads and writes in one atomic step, so the
	// bytes judged above are the bytes replaced. The permission asked here is about
	// the file's CONTENT — this document may be overwritten, somebody else's may not —
	// and `read`-then-`modify` answers it about content that no longer has to exist by
	// the time the write lands. Sync, another Obsidian window or a second command can
	// land in that gap. The callback re-asks the one question that matters if they did:
	// still ours? Otherwise it hands the file back exactly as found.
	// An array rather than a nullable local: the callback runs synchronously, but
	// narrowing after a closure assignment does not survive the type checker.
	const replaced: (string | null)[] = [];
	await app.vault.process(existing, (live) => {
		const owner = readmeSource(firstLine(live));
		replaced.push(owner);
		if (owner === null) return live;
		// The REFUSE mode asks its second question HERE, not beside the read above, and the
		// placement is the whole of it: sync can put another release's generated file at
		// this path between that read and this callback, and a check for "is this a marker"
		// would hand it to the writer. The permission is about the bytes being replaced,
		// and only this callback sees those.
		if (mismatch === 'refuse' && owner !== mine) return live;
		return content;
	});
	// Reported from the bytes actually replaced, not from the ones read a moment
	// earlier: if the file that lost the race was a THIRD view's, `previous` names a
	// document this write did not touch — and the notice exists precisely to say which
	// one it did.
	const owner = replaced[0] ?? null;
	if (owner === null) return { outcome: 'foreign', path };
	if (owner === mine) return { outcome: 'updated', path };
	// Not ours, and what that means is the caller's own choice. The README REPLACES: two
	// views may share a home folder, and refusing would brick a renamed base or view. The
	// release notes REFUSE: a whole-file write over another release's notes is not in the
	// undo slot and cannot be taken back at all.
	if (mismatch === 'refuse') return { outcome: 'foreign', path, previous: owner };
	return { outcome: 'replaced', path, previous: owner };
}
