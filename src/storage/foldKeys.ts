import { movedPath } from './viewIdentity';

/**
 * The SHAPE of a stored fold key, in the layer that stores it.
 *
 * These lived in `view/viewState.ts` until a rename walk needed them: `renamePathFolds`
 * (`viewStateStore.ts`) has to migrate a release view's folds, and that view holds no
 * `ViewStateController` to do it in memory — it reads and writes `folds.collapsed`
 * directly. `storage/` may not import `view/`, and copying the parsing down would have put
 * one rule in two places for the duplication gate to find. Moving it down instead leaves
 * exactly one `notePath` in the tree, in the layer whose FORMAT it describes; `view/`
 * imports it upward the same way it already imports `movedPath` from `viewIdentity.ts`.
 * `view/viewState.ts` re-exports the three prefixes, so nothing that names them had to move.
 */

/**
 * Prefix marking a key as the DATED AXIS's own fold state, kept apart from the tree's.
 * The grid's chevron folds rows off the plan and the tree's opens a node in the backlog:
 * two questions about one item, so one bit could only answer both by making the reader
 * lose their place in the other projection every time they used it.
 *
 * A NUL, because a vault path may legitimately contain any printable prefix — {@link notePath}
 * has to strip this back off to prune and to rename, so a key that could be a real path
 * would prune the wrong entry.
 */
export const TIMELINE_SCOPE = '\u0000timeline:';

/**
 * Prefix marking a key as a CARD's own disclosure state, kept apart from both the tree's
 * bare-path bit and `TIMELINE_SCOPE`: a card's face and the tree row for the same note are
 * two questions again, the same reason `TIMELINE_SCOPE` exists — "is this node open in the
 * backlog" and "is this card's children list open" used to be one bit, so expanding either
 * moved the reader's place in the other, including through the toolbar's bulk controls,
 * which the tree row's bit alone can never avoid since a bulk action legitimately means
 * the tree by it. One scope regardless of WHICH card projection draws the card (board,
 * either roadmap axis, Deliverables): the question "is this item's card open" is one
 * question about the note, not one per screen that happens to draw it as a card — unlike
 * the dated axis's own rows, whose fold is a genuine fact about that PLAN and nothing else.
 */
export const CARD_SCOPE = '\u0000card:';

/**
 * Prefix marking a key as ONE RELEASE's own fold state (`view/release/scopeTree.ts`,
 * which owns the key SHAPE — `foldPrefix` — and every reason a release multiplies this
 * one bit per release rather than sharing {@link TIMELINE_SCOPE}'s single split). The
 * backlog view's own `ViewState` only needs to recognise the prefix, for the reason every
 * entry here shares: `restore()` loads whatever `folds.collapsed` a saved view's IDENTITY
 * holds, whichever view last wrote it, and a saved view's TYPE can change while its
 * identity does not — a `.base` view switched from the release view to the backlog view
 * carries the release folds it never had a `ViewStateController` to read. Before this
 * joined {@link notePath}, the backlog view's own flush read a whole
 * `\u0000release:<release path>\u0000<member path>` key as if it were one bare path,
 * found no such file, and silently deleted the release's own fold — on the very first
 * data update after the switch, with nothing on screen saying so.
 */
export const RELEASE_FOLD = '\u0000release:';

/** The note path a key is FILED under, whichever scope settled it. A release-fold key
 *  carries TWO paths — the release, then the member after a second NUL — and it is the
 *  member that answers this, so this takes everything after the LAST NUL rather than
 *  slicing off a fixed prefix length. A prune asks {@link foldKeyPaths} instead: a key
 *  dies with EITHER of its notes, and this deliberately names only one of them. */
export function notePath(key: string): string {
	if (key.startsWith(TIMELINE_SCOPE)) return key.slice(TIMELINE_SCOPE.length);
	if (key.startsWith(CARD_SCOPE)) return key.slice(CARD_SCOPE.length);
	if (key.startsWith(RELEASE_FOLD)) return key.slice(key.lastIndexOf('\u0000') + 1);
	return key;
}

/**
 * Every note path a key names: one for the tree's own scopes, TWO for a release fold —
 * the release, then the member.
 *
 * Both, because a fold key is only alive while BOTH notes are. If the MEMBER is gone the
 * key names a row nothing can draw; if the RELEASE is gone the whole scope is gone with
 * it, since a release's screen is reached through the release note and every key under
 * that prefix answers a question about a screen that no longer exists. {@link notePath}
 * deliberately answers a narrower question — which single path a key is FILED under — so
 * a prune that asked it alone would keep every fold of a deleted release forever.
 */
export function foldKeyPaths(key: string): string[] {
	if (!key.startsWith(RELEASE_FOLD)) return [notePath(key)];
	return [key.slice(RELEASE_FOLD.length, key.lastIndexOf('\u0000')), notePath(key)];
}

/** The scope prefix a settled key carries, or '' for the tree's own bare path. A
 *  release-fold key's own "scope" is everything up to and including its SECOND NUL —
 *  `RELEASE_FOLD` plus the release path — because that whole span, not just the fixed
 *  prefix, has to be put back in front of a renamed member to reconstruct the same key
 *  over the same release. Not exported: {@link movedFoldKey} is the only caller, and an
 *  export nothing imports is what the dead-code gate is for. */
function scopeOf(key: string): string {
	if (key.startsWith(TIMELINE_SCOPE)) return TIMELINE_SCOPE;
	if (key.startsWith(CARD_SCOPE)) return CARD_SCOPE;
	if (key.startsWith(RELEASE_FOLD)) return key.slice(0, key.lastIndexOf('\u0000') + 1);
	return '';
}

/**
 * The same key with every note path it carries moved — or null for a key this rename does
 * not touch.
 *
 * A release-fold key carries TWO paths, the release and the member, and either can be the
 * thing renamed: `ViewState.renamePath`'s old expression asked only about the member, so
 * renaming the release note itself stranded every fold in its scope under a path no reader
 * would ever ask for again. `movedPath` matches the path itself OR its `oldPath/` prefix,
 * so a folder rename carries everything beneath it — the event names the folder and never
 * the notes in it.
 */
export function movedFoldKey(key: string, oldPath: string, newPath: string): string | null {
	if (key.startsWith(RELEASE_FOLD)) {
		const cut = key.lastIndexOf('\u0000');
		const release = key.slice(RELEASE_FOLD.length, cut);
		const member = key.slice(cut + 1);
		const movedRelease = movedPath(release, oldPath, newPath) ?? release;
		const movedMember = movedPath(member, oldPath, newPath) ?? member;
		// Null only when NEITHER half moved: a caller that swapped an unchanged key for an
		// identical one would still count the walk as a change and rewrite the whole map.
		if (movedRelease === release && movedMember === member) return null;
		return `${RELEASE_FOLD}${movedRelease}\u0000${movedMember}`;
	}
	const moved = movedPath(notePath(key), oldPath, newPath);
	// Back into the scope it came from: a rename moves the item, never the question the
	// scope is asking about it.
	return moved === null ? null : scopeOf(key) + moved;
}
