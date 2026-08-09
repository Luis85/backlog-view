import { App, TFile } from 'obsidian';
import { linkpathFromRawValue, ownValue } from '../domain/noteFields';
import { BacklogSettings } from '../domain/settings';
import { DependsOnDelta, ItemWrite } from '../domain/writePlan';
import { setOwn } from './ownProperty';

/**
 * Reverses one applied prerequisite change, in RAW TEXT both ways: `add` puts back the
 * exact lines a removal took out, `remove` takes out the exact line an add put in.
 *
 * Declared here rather than inside `RestoreWrite` for a structural reason — this module
 * must not import from `frontmatter.ts`, or the two form a cycle — and it happens to be
 * the right home anyway: the shape is the delta this module produces.
 */
export interface DependsOnRestore {
	key: string;
	add: DependsOnEntry[];
	remove: DependsOnEntry[];
}

/**
 * One captured line: the text to write back, and the note it named WHEN IT WAS
 * CAPTURED — held as the file object rather than as a path or a spelling, because that
 * is the only identity a rename does not break. Obsidian mutates the one `TFile` and
 * rewrites the links that named it, so `[[A]]` captured against a note later renamed to
 * B is a text that resolves to nothing while the live entry reads `[[B]]`: matching by
 * text or by captured path leaves the dependency in place and the undo does nothing at
 * all. Reading `file.path` at REPLAY time follows the rename to where the live entry
 * now points. Null for a line that named nothing when it was captured — a broken entry
 * has no note to be renamed, so its own text is the whole of its identity.
 */
export interface DependsOnEntry {
	text: string;
	file: TFile | null;
}

/**
 * The prerequisite list's half of the write boundary.
 *
 * Beside `frontmatter.ts` rather than inside it, and that is a size decision with a real
 * constraint on it: neither function here calls `processFrontMatter`. They transform a
 * frontmatter object the caller already opened, so the rule that every vault write goes
 * through `frontmatter.ts` is untouched — what moved is the list arithmetic, not the
 * write.
 */

/** Every entry the key currently holds, of any type, in the note's own order. */
function liveEntries(fm: Record<string, unknown>, key: string): unknown[] {
	const raw: unknown = ownValue(fm, key);
	if (raw === undefined) return [];
	return Array.isArray(raw) ? raw : [raw];
}

/**
 * The trimmed text of an entry that could be a dependency LINE — null for anything else,
 * which is exactly what a delta must never match, drop or rewrite: a non-string entry is
 * unrelated frontmatter the tolerant reader already ignores (`dependsOn: [7, "A"]` reads
 * one dependency, "A"), and it must survive an edit to "A" rather than being silently
 * dropped as collateral. A blank string reads the same way — no line the reader would
 * ever offer to remove — so it passes through untouched here too.
 */
function textOf(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text.length > 0 ? text : null;
}

/** Write the list back, or remove the key when nothing survives. Absence is a value. */
function writeEntries(fm: Record<string, unknown>, key: string, next: unknown[]): void {
	if (next.length > 0) setOwn(fm, key, next);
	else delete fm[key];
}

/** Count occurrences of each string, for MULTISET matching — a duplicate line is two
 *  entries to restore, not one, and a plain membership test cannot tell them apart. */
function countOf(texts: string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
	return counts;
}

/**
 * The note a dependency LINE names, exactly as the reader resolves one — shared by the
 * forward writer's own duplicate guard (`applyDependsOnDelta`'s `dropText`/`already`) and
 * the restore below, so "the same note" means one thing whichever direction is writing.
 * Null for text that resolves to nothing, which is its own identity below: a broken line
 * has no note to share, so it can only ever match its own exact spelling.
 */
function resolvedPathOf(app: App, file: TFile, text: string): string | null {
	return resolvedFileOf(app, file, text)?.path ?? null;
}

/** The same lookup, kept as the FILE — what a capture stores so a later rename cannot
 *  strand it. See `DependsOnEntry`. */
function resolvedFileOf(app: App, file: TFile, text: string): TFile | null {
	const linkpath = linkpathFromRawValue(text);
	if (linkpath.length === 0) return null;
	return app.metadataCache.getFirstLinkpathDest(linkpath, file.path) ?? null;
}

/**
 * Apply one prerequisite delta to the LIVE list, returning the delta that undoes it —
 * or null when nothing changed, so a no-op neither rewrites the value into a different
 * shape nor spends the undo slot.
 *
 * Modelled on `applyTagDelta` above, including the half that is easy to drop: an add
 * checks the live list first. The menu row that planned this can be a refresh behind
 * the note, so the prerequisite may have arrived between the menu opening and the pick
 * landing — and an unconditional append would write a second entry the reader collapses
 * into no visible change, whose inverse then removes EVERY entry naming that note and
 * takes the other writer's line away with it.
 */
function applyDependsOnDelta(
	app: App,
	file: TFile,
	fm: Record<string, unknown>,
	key: string,
	delta: DependsOnDelta,
): DependsOnRestore | null {
	const current = liveEntries(fm, key);
	// Which note a live entry names, asked exactly as the reader asks it.
	const pathOf = (text: string): string | null => resolvedPathOf(app, file, text);
	// The whole key goes at once, whatever it holds — including a value the reader
	// discards entirely, which is the only state with no line to offer and so the only
	// one that could otherwise be left on disk with nothing able to clear it. Captured by
	// `touchedKeys` rather than as a delta, so it emits no inverse here.
	//
	// Stale-refresh guarded like the `add` arm below, for the same reason: the picker
	// offered this line against a value that read as no dependencies, and the pick can
	// land after the note gained a real one. Deleting unconditionally would erase that
	// arrival instead of the nothing the picker showed, so this only fires while the
	// live value STILL reads as nothing nameable — the same test `textOf` states for
	// every other entry here.
	if (delta.removeKey) {
		if (current.every((value) => textOf(value) === null)) delete fm[key];
		return null;
	}
	// The matched text of an entry this delta would drop, or null to keep it untouched —
	// a non-string or blank entry is never a candidate, so it can never match either arm.
	const dropText = (value: unknown): string | null => {
		const text = textOf(value);
		if (text === null) return null;
		if (delta.removeRaw !== undefined && text === delta.removeRaw) return text;
		if (delta.removePath !== undefined && pathOf(text) === delta.removePath) return text;
		return null;
	};
	const removed: DependsOnEntry[] = [];
	const next: unknown[] = [];
	for (const value of current) {
		// Matched on the TRIMMED text (`dropText`), captured for the inverse as the
		// ORIGINAL value: `dropText` returning non-null already means `value` is a
		// string (that is what `textOf` requires), so restoring `value` itself rather
		// than the matched text is what puts back a line with significant surrounding
		// whitespace exactly as it was, not trimmed.
		const matched = dropText(value);
		if (matched !== null) removed.push({ text: value as string, file: resolvedFileOf(app, file, matched) });
		else next.push(value);
	}
	const added: DependsOnEntry[] = [];
	if (delta.add) {
		const wanted = delta.add.path;
		const already = next.some((value) => {
			const text = textOf(value);
			return text !== null && pathOf(text) === wanted;
		});
		if (!already) {
			const link = '[[' + app.metadataCache.fileToLinktext(delta.add, file.path) + ']]';
			next.push(link);
			added.push({ text: link, file: delta.add });
		}
	}
	if (added.length === 0 && removed.length === 0) return null;
	writeEntries(fm, key, next);
	// The inverse: put back what went out, take out what came in.
	return { key, add: removed, remove: added };
}

/**
 * Replay one captured prerequisite inverse against the LIVE list, returning the REDO —
 * only what THIS replay actually changed, read backwards — or null when it changed
 * nothing.
 *
 * Both arms are compare-and-swap against the live value, not a blind swap of the
 * captured fields: the note may have moved since the batch was captured (the user
 * hand-edited it, or undid the same change by hand), so a replay states what it
 * actually did rather than what it was told to do. Skipping that check is exactly how a
 * redo comes to re-add a dependency the user deliberately removed themselves.
 *
 * Both arms are also MULTISETS, not membership tests, because a removal can have
 * captured the same raw text more than once (`[A, A]` is one dependency and two lines):
 * `toRemove`/`already` count each text rather than asking yes-or-no, so undoing a
 * duplicate-line removal restores every copy instead of the first. The guard this
 * replaces a plain "already present" check for is the same one `applyDependsOnDelta`'s
 * `add` keeps: an entry already on the note — because the user put it back by hand, or
 * because an earlier partial replay already restored it — satisfies one occurrence of
 * what this replay would add, so only the copies genuinely missing get written. A count
 * of zero live copies is the ordinary case and restores the full multiplicity untouched.
 *
 * Both multisets are counted by RESOLVED NOTE (`resolvedPathOf`), not by exact text — the
 * same reason `applyDependsOnDelta`'s own `add` guard resolves rather than compares raw
 * strings: a line surviving between capture and replay may have been hand-edited to a
 * different spelling of the same note (`A` respelled `[[A]]`), and a text-only compare
 * would not recognise it as already there. Text is still the identity for an entry that
 * resolves to nothing — a broken line has no note to share, so it can only satisfy its
 * own exact spelling — which is what keeps this a strict generalisation of the old
 * behaviour rather than a looser one. The counted KEY changed; the counted QUANTITY (one
 * per captured line, multiplicity and all) did not.
 *
 * The `remove` arm additionally prefers an EXACT-TEXT occurrence over a resolved-path
 * one: an undo owns the exact line ITS OWN write put there, not merely a live entry that
 * happens to name the same note. Without that preference, a user who hand-adds their own
 * spelling of a note the plugin already depends on (`[[A]]` written by a prior add, `A`
 * inserted by hand alongside it) can have their own line consumed by an undo that was
 * only ever entitled to the plugin's — resolved-path matching is correct only as the
 * FALLBACK for an entry genuinely respelled since the write, which is the case the
 * multiset paragraph above describes and which stays intact.
 *
 * **Known limitation, deliberate:** a restored entry is appended, never reinserted at
 * the position it was removed from, so undoing a removal from `[B, A]` hands back
 * `[A, B]` — the row's own text visibly reorders even though nothing about which
 * prerequisite it names changed. A positional restore is refused on purpose: a captured
 * index is only meaningful if nothing else touched the list between the write and the
 * undo, which is exactly the assumption compare-and-swap exists because it cannot make.
 * The list is semantically a set (resolution collapses duplicates and spellings), so
 * display order is the only thing this ever costs.
 */
export function restoreDependsOn(
	app: App,
	file: TFile,
	fm: Record<string, unknown>,
	restore: DependsOnRestore,
): DependsOnRestore | null {
	// TRIMMED for the unresolved fallback, because that is the identity the live side is
	// already counted under: every live entry reaches this through `textOf`, which trims.
	// Captured text does not — a removal records the ORIGINAL value, padding and all, so
	// that an undo can put the exact line back. Comparing the two untrimmed would have
	// `" Ghost "` fail to recognise a hand-restored `Ghost` and append a duplicate. Only
	// the comparison KEY is trimmed; what gets written is still the captured spelling.
	// One identity for both sides. A LIVE entry is asked of the vault, so a rename it
	// already followed resolves to the note's current path. A CAPTURED entry is asked of
	// the file it held, whose `.path` the same rename moved — never of its text, which a
	// rename strands. Text is the fallback on both sides, for the line that names nothing.
	const identityOf = (text: string): string => resolvedPathOf(app, file, text) ?? text.trim();
	const capturedIdentity = (entry: DependsOnEntry): string => entry.file?.path ?? entry.text.trim();
	const live = liveEntries(fm, restore.key);
	const consumed = new Array<boolean>(live.length).fill(false);
	const removed: DependsOnEntry[] = [];
	for (const wanted of restore.remove) {
		// Prefer the exact line this entry captured — an undo owns the line its own
		// write put there, not merely a live entry naming the same note.
		let index = live.findIndex((value, i) => !consumed[i] && value === wanted.text);
		if (index === -1) {
			// Fallback: no exact spelling survives, so match by resolved note instead —
			// the case a genuine hand-respelling (`A` rewritten `[[A]]`) needs.
			const wantedKey = capturedIdentity(wanted);
			index = live.findIndex((value, i) => {
				if (consumed[i]) return false;
				const text = textOf(value);
				return text !== null && identityOf(text) === wantedKey;
			});
		}
		if (index === -1) continue; // already gone — nothing left for this entry to take
		consumed[index] = true;
		// Captured for the redo as the ORIGINAL `value` — the same split
		// `applyDependsOnDelta`'s own capture keeps above, and for the same reason:
		// restoring `value` itself rather than the matched text is what carries a
		// hand-added respelling (padding, or any other edit) into the redo instead of
		// normalizing it away.
		const text = live[index] as string;
		removed.push({ text, file: resolvedFileOf(app, file, text.trim()) });
	}
	const next: unknown[] = live.filter((_, i) => !consumed[i]);
	const pending = stillOwed(next, restore.add, identityOf);
	const added: DependsOnEntry[] = [];
	for (const entry of pending.owed) {
		const key = capturedIdentity(entry);
		const have = pending.already.get(key) ?? 0;
		if (have > 0) {
			pending.already.set(key, have - 1);
			continue;
		}
		const line = restoredLine(app, file, entry);
		// Null means the note this line was captured FOR is not in the vault any more, so
		// there is no spelling that would name it. Skipping is the `remove` arm's own
		// "already gone" answer read from the other side, and `added` states what was
		// actually written, so the redo stays accurate.
		if (line === null) continue;
		next.push(line);
		added.push({ text: line, file: entry.file });
	}
	if (added.length === 0 && removed.length === 0) return null;
	writeEntries(fm, restore.key, next);
	return { key: restore.key, add: removed, remove: added };
}

/**
 * Which captured lines are still owed, and what is already back to count them against.
 *
 * Two counts, because one captured line can be satisfied by an exact spelling of itself
 * or by any live entry naming the same note — and which of the two applies decides which
 * captured entry gets consumed. **A live line satisfies the captured line it IS before
 * one it merely resembles**, so the exact matches are claimed here, first. Removing
 * `[A, [[A]]]` and hand-restoring only `[[A]]` otherwise had the by-note count satisfy
 * captured `A`, leaving captured `[[A]]` to be appended: two `[[A]]` on the note, and the
 * spelling the user actually lost still missing.
 *
 * Its own function because `restoreDependsOn` is at its complexity budget, and because
 * the two passes are one question asked twice rather than two steps of the replay.
 */
function stillOwed(
	live: unknown[],
	captured: DependsOnEntry[],
	identityOf: (text: string) => string,
): { owed: DependsOnEntry[]; already: Map<string, number> } {
	// The exact count is built from the line AS WRITTEN, the identity count from its
	// trimmed reading. Counting both off the trimmed text made `" A "` on the note an
	// exact match for a captured `"A"`, so undo consumed the wrong captured entry and
	// appended a second padded copy — the very confusion the exact pass exists to end.
	const lines = live
		.map((value) => ({ raw: value as string, trimmed: textOf(value) }))
		.filter((line): line is { raw: string; trimmed: string } => line.trimmed !== null);
	const exact = countOf(lines.map((line) => line.raw));
	const already = countOf(lines.map((line) => identityOf(line.trimmed)));
	const owed: DependsOnEntry[] = [];
	for (const entry of captured) {
		const have = exact.get(entry.text) ?? 0;
		if (have === 0) {
			owed.push(entry);
			continue;
		}
		exact.set(entry.text, have - 1);
		const key = identityOf(entry.text);
		already.set(key, Math.max(0, (already.get(key) ?? 0) - 1));
	}
	return { owed, already };
}

/**
 * The exact text to write back for one captured line, or null when there is none to
 * write.
 *
 * The captured spelling is preferred and is usually what goes back — that is what
 * carries the user's own padding and their choice of `A` over `[[A]]`. It is only wrong
 * in one situation, and the situation is invisible from the text: while the line was
 * OFF the note, the note it named moved. Obsidian rewrites links on a rename, but only
 * the ones that exist, and a removed line is not there to be rewritten — so an undo that
 * put the captured text back would restore `[[A]]` for a note now called B, which is a
 * broken dependency the user never had.
 *
 * Two questions, in order. Is the captured file still the vault's file at its own path?
 * If not it was deleted — possibly with a DIFFERENT note created under the old name, in
 * which case writing the captured text would silently make the user depend on a note
 * they never picked, so nothing is written at all. Otherwise: does the captured text
 * still name that file? If yes it is returned untouched, padding and all. If no, the
 * file moved, and the link is regenerated from where it is now.
 *
 * A line that resolved to nothing when it was captured has no file to ask either
 * question of, and its text is its whole identity, so it always goes back as it was.
 */
function restoredLine(app: App, file: TFile, entry: DependsOnEntry): string | null {
	if (entry.file === null) return entry.text;
	if (app.vault.getFileByPath(entry.file.path) !== entry.file) return null;
	if (resolvedPathOf(app, file, entry.text.trim()) === entry.file.path) return entry.text;
	return retarget(entry.text, app.metadataCache.fileToLinktext(entry.file, file.path));
}

/**
 * One wikilink with its TARGET replaced and everything else kept — the `#heading` and the
 * `|alias` the user wrote, which say what they meant by the link and which a rename has
 * no business editing. Rebuilding the whole link from the file would resolve correctly
 * and silently drop both: `[[A#Plan|Prerequisite]]` came back as `[[B]]`.
 *
 * Anything that is not a bracketed link is replaced whole, because there is no target
 * portion to isolate — a bare `A` says nothing except which note it means, so the new
 * name is the entire content of it.
 */
function retarget(text: string, linktext: string): string {
	const match = /^(\s*\[\[)([^\]|#]*)(.*?\]\]\s*)$/.exec(text);
	return match ? `${match[1]}${linktext}${match[3]}` : `[[${linktext}]]`;
}

/**
 * The prerequisite restore one write earns, or nothing — the configured-key test and the
 * delta application in one place, so the caller states no rule of its own about a key it
 * does not own.
 */
export function dependsOnRestore(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
): DependsOnRestore | undefined {
	// Never a key no property names, the rule every optional write here keeps.
	if (write.dependsOn === undefined || settings.dependsOnKey === '') return undefined;
	return applyDependsOnDelta(app, write.file, fm, settings.dependsOnKey, write.dependsOn) ?? undefined;
}
