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
 * **Does this live line name the note the captured line was written for?** One question,
 * and every matching decision in the replay below is it — there is no second rule about
 * spellings, no third about deletions.
 *
 * A captured entry that named NOTHING has no note to share, so its own trimmed text is
 * the whole of its identity and only that spelling can be it.
 *
 * Otherwise the captured entry holds the `TFile`, and what makes that answerable is that
 * Obsidian keeps the file's own name up to date in two directions at once: a rename
 * mutates the one object (so `entry.file.path` is always the note's LAST path) and
 * rewrites the links that exist (so a live line the plugin wrote says that same last
 * path). The two therefore agree whatever happened in between, which is why this asks
 * the vault rather than comparing strings:
 *
 * - the live line RESOLVES → it is this line iff it resolves to the captured file
 *   itself. Not to a file at the captured path: a note deleted and recreated under the
 *   same name is a different object and somebody else's dependency.
 * - the live line resolves to NOTHING → nothing else can be claiming that spelling, so
 *   it is this line iff it names the captured file's last path (`namesPath`). That
 *   covers a deleted prerequisite, whose line sits there broken, and a renamed-then-
 *   deleted one, whose line Obsidian rewrote before the note went — the case a
 *   text-or-path comparison could see neither half of.
 */
function namesCaptured(app: App, file: TFile, text: string, entry: DependsOnEntry): boolean {
	if (entry.file === null) return text.trim() === entry.text.trim();
	const now = resolvedFileOf(app, file, text);
	return now === null ? namesPath(text, entry.file.path) : now === entry.file;
}

/**
 * Whether an UNRESOLVED link text names a path — the comparison `getFirstLinkpathDest`
 * would have made had the note still been there, against one known path rather than
 * against the vault. Obsidian writes the shortest unambiguous form, so the bare name is
 * the spelling to expect and the fuller ones are what a user may have typed.
 *
 * Deliberately exact rather than case-insensitive, though link resolution is not: this
 * predicate only ever decides whether an undo may TAKE a line, so being stricter than
 * Obsidian declines the doubtful case instead of consuming somebody else's.
 */
function namesPath(text: string, path: string): boolean {
	const linkpath = linkpathFromRawValue(text);
	if (linkpath.length === 0) return false;
	const withoutExtension = path.replace(/\.md$/, '');
	const segments = withoutExtension.split('/');
	return linkpath === path || linkpath === withoutExtension || linkpath === segments[segments.length - 1];
}

/**
 * Which live line each captured line claims, or null for one with nothing to claim.
 *
 * Both arms of the replay ask this, which is what makes "the same line" mean one thing
 * whichever direction is writing: the `remove` arm takes what it claims back off the
 * note, the `add` arm reads a claim as "already back" and writes nothing.
 *
 * A claim is exclusive, so this is a MULTISET match rather than a membership test — a
 * removal can capture the same raw text more than once (`[A, A]` is one dependency and
 * two lines), and each captured copy must find its own live line or be restored.
 *
 * **A live line satisfies the captured line it IS before one it merely resembles**,
 * which is why this is two passes over all the captured lines rather than one pass
 * asking both questions per line. The first claims an identical spelling — the line
 * this write actually put there, not merely one naming the same note — and the second
 * lets what is left claim any line naming that note, which is what a hand-respelling
 * (`A` rewritten `[[A]]`) or an Obsidian rename needs. Per-entry ordering breaks it:
 * removing `[A, [[A]]]` and hand-restoring only `[[A]]` had captured `A` claim it by
 * note, leaving captured `[[A]]` to be appended — two `[[A]]` on the note, and the
 * spelling the user actually lost still missing.
 *
 * The exact pass compares the RAW live value against the RAW captured text, padding and
 * all: counting it off the trimmed reading made `" A "` an exact match for a captured
 * `"A"`, so the wrong captured entry was consumed and a second padded copy appended.
 * Eligibility is still `namesCaptured`, so an identical spelling that has come to name
 * somebody else's note is not this line — which is the whole of what used to be a
 * separate conditional preference.
 */
function claimLines(
	live: unknown[],
	captured: DependsOnEntry[],
	names: (text: string, entry: DependsOnEntry) => boolean,
): (number | null)[] {
	const claimed = live.map(() => false);
	const found = captured.map<number | null>(() => null);
	const eligible = (index: number, entry: DependsOnEntry): boolean => {
		if (claimed[index]) return false;
		const text = textOf(live[index]);
		return text !== null && names(text, entry);
	};
	const claim = (n: number, index: number): void => {
		if (index === -1) return;
		claimed[index] = true;
		found[n] = index;
	};
	captured.forEach((entry, n) => claim(n, live.findIndex((value, i) => eligible(i, entry) && value === entry.text)));
	captured.forEach((entry, n) => {
		if (found[n] === null) claim(n, live.findIndex((_, i) => eligible(i, entry)));
	});
	return found;
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
 * What "the same line" means is `namesCaptured`, and what a claim on one means is
 * `claimLines`; both arms ask both, so this function decides nothing about identity of
 * its own. The `remove` arm takes the lines it claims off the note; the `add` arm treats
 * a claim as the line already being back and writes only what is left over.
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
	const names = (text: string, entry: DependsOnEntry): boolean => namesCaptured(app, file, text, entry);
	const live = liveEntries(fm, restore.key);
	// A captured line with no claim is already gone — nothing left for it to take.
	const taken = claimLines(live, restore.remove, names);
	const held = new Set(taken.filter((index): index is number => index !== null));
	// Captured for the redo as the ORIGINAL live value — the same split
	// `applyDependsOnDelta`'s own capture keeps above, and for the same reason: recording
	// the line as written rather than as matched is what carries a hand-added respelling
	// (padding, or any other edit) into the redo instead of normalizing it away.
	const removed: DependsOnEntry[] = [...held].map((index) => {
		const text = live[index] as string;
		return { text, file: resolvedFileOf(app, file, text.trim()) };
	});
	const next: unknown[] = live.filter((_, i) => !held.has(i));
	const back = claimLines(next, restore.add, names);
	const added: DependsOnEntry[] = [];
	restore.add.forEach((entry, n) => {
		if (back[n] !== null) return; // already on the note, by hand or by an earlier partial replay
		const line = restoredLine(app, file, entry);
		// Null means there is no spelling that would say what this line said, so nothing
		// is written; `added` states what actually landed, so the redo stays accurate.
		if (line === null) return;
		next.push(line);
		added.push({ text: line, file: entry.file });
	});
	if (added.length === 0 && removed.length === 0) return null;
	writeEntries(fm, restore.key, next);
	return { key: restore.key, add: removed, remove: added };
}

/**
 * The exact text to write back for one captured line, or null when there is none to
 * write.
 *
 * The captured spelling is what goes back — it carries the user's own padding and their
 * choice of `A` over `[[A]]` — and the only reason to write anything else is that while
 * the line was OFF the note, the note it named moved. Obsidian rewrites the links that
 * EXIST on a rename and a removed line is not there to be rewritten, so replaying the
 * captured text verbatim would restore `[[A]]` for a note now called B.
 *
 * So: is the captured file still the vault's file at its own path?
 *
 * - **Yes** — it is alive, wherever it now lives, and the line must name it. The captured
 *   text goes back if it still does, and is retargeted to the note's current name if a
 *   rename moved it out from under the spelling.
 * - **No** — the note is gone, and there is nothing to name. Its line is restorable only
 *   as the broken line it now is, which is exactly what the note would be saying had the
 *   removal never happened — the same judgement the `remove` arm makes when it claims a
 *   broken line it wrote itself. The one refusal left is the captured text resolving to
 *   SOMETHING: a different note has taken that name, and writing it would silently make
 *   the user depend on a note they never picked.
 *
 * A line that resolved to nothing when it was captured has no file to ask, and its text
 * is its whole identity, so it always goes back as it was.
 */
function restoredLine(app: App, file: TFile, entry: DependsOnEntry): string | null {
	if (entry.file === null) return entry.text;
	if (app.vault.getFileByPath(entry.file.path) !== entry.file) {
		return resolvedFileOf(app, file, entry.text.trim()) === null ? entry.text : null;
	}
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
