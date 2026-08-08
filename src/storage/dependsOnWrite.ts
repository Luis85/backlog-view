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
	add: string[];
	remove: string[];
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
	const linkpath = linkpathFromRawValue(text);
	if (linkpath.length === 0) return null;
	return app.metadataCache.getFirstLinkpathDest(linkpath, file.path)?.path ?? null;
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
	const removed: string[] = [];
	const next: unknown[] = [];
	for (const value of current) {
		// Matched on the TRIMMED text (`dropText`), captured for the inverse as the
		// ORIGINAL value: `dropText` returning non-null already means `value` is a
		// string (that is what `textOf` requires), so restoring `value` itself rather
		// than the matched text is what puts back a line with significant surrounding
		// whitespace exactly as it was, not trimmed.
		if (dropText(value) !== null) removed.push(value as string);
		else next.push(value);
	}
	const added: string[] = [];
	if (delta.add) {
		const wanted = delta.add.path;
		const already = next.some((value) => {
			const text = textOf(value);
			return text !== null && pathOf(text) === wanted;
		});
		if (!already) {
			const link = '[[' + app.metadataCache.fileToLinktext(delta.add, file.path) + ']]';
			next.push(link);
			added.push(link);
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
	const identityOf = (text: string): string => resolvedPathOf(app, file, text) ?? text;
	const toRemove = countOf(restore.remove.map(identityOf));
	const removed: string[] = [];
	const next: unknown[] = [];
	for (const value of liveEntries(fm, restore.key)) {
		const text = textOf(value);
		const key = text !== null ? identityOf(text) : null;
		const remaining = key !== null ? (toRemove.get(key) ?? 0) : 0;
		if (key !== null && remaining > 0) {
			toRemove.set(key, remaining - 1);
			removed.push(text as string);
			continue;
		}
		next.push(value);
	}
	const already = countOf(
		next
			.map((value) => textOf(value))
			.filter((text): text is string => text !== null)
			.map(identityOf),
	);
	const added: string[] = [];
	for (const text of restore.add) {
		const key = identityOf(text);
		const have = already.get(key) ?? 0;
		if (have > 0) {
			already.set(key, have - 1);
			continue;
		}
		next.push(text);
		added.push(text);
	}
	if (added.length === 0 && removed.length === 0) return null;
	writeEntries(fm, restore.key, next);
	return { key: restore.key, add: removed, remove: added };
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
