import { App } from 'obsidian';
import { loadViewState, saveViewState, updateViewPrefs } from '../storage/viewStateStore';
import { resolveViewIdentity, ViewIdentity } from '../storage/viewIdentity';
import { ScopeRow, childRows } from '../domain/scopeRows';

/**
 * One scope's fold set — "is this row open in THIS scope" — over the view-state store,
 * with the session-only fallback every persisted view keeps.
 *
 * Extracted out of `view/release/scopeTree.ts` (Task 5 of [[Assigned work in the
 * sidebar]]): the release view asks this question per RELEASE, and the assigned-work
 * tree asks the identical question per PERSON. The whole of what varied between the two
 * was the key prefix, so this module takes it as a parameter — `RELEASE_FOLD` or
 * `MYWORK_FOLD` (`storage/foldKeys.ts`) — rather than being copied a second time.
 * `scopeTree.ts` keeps its own old signatures (view, releasePath, …) and calls the
 * functions here with `RELEASE_FOLD` and the open release's path, so nothing that
 * already calls it had to change.
 */

/**
 * What a fold set (and a scope flag) needs of the view that holds them: enough to
 * resolve a view-state identity, and a way to redraw once one changes. A structural
 * type rather than a shared base class — `ReleaseView` and the assigned-work view are
 * unrelated classes, and this is the whole of what either has to offer.
 */
export interface FoldHost {
	app: App;
	viewEl: HTMLElement;
	config: { name?: string };
	render(): void;
}

/** `<NUL><prefix>:<scope path><NUL>` — everything after it is the member path, and the
 *  NUL is safe as a separator for the same reason it is safe as a prefix: neither path
 *  can contain one. */
function foldPrefix(prefix: string, scopePath: string): string {
	return `${prefix}${scopePath}\u0000`;
}

/**
 * The session-only fallback {@link readRawFolds}/{@link writeRawFolds} use where there is
 * no view identity — an embedded base has no identity, so its folds are session-only
 * rather than absent — gone on reload, exactly as a pick would be, and the tree is one
 * press from reopening. Keyed on the HOST, so a remounted view starts fresh, as every
 * other session-only value in this plugin does.
 *
 * Neither store-level walk (the rename's, or `pruneDeletedFolds`') reaches this map. For
 * a DELETE that costs nothing: the row goes with the note, so the key it leaves is
 * unreachable and dies at the end of the session anyway. For a rename it costs one
 * reopened row until reload, which is the accepted limitation the release view's own
 * history already recorded — subscribing every host to vault events to close it would
 * buy back less than this backend already discards on every remount.
 */
const sessionFolds = new WeakMap<FoldHost, string[]>();

/** Every fold key this host's own entry currently holds, whichever backend answers for
 *  it — the identity-backed store, or the session fallback above. Both read and write
 *  sides work over this one flat list, so which backend is live is decided in exactly
 *  two places. */
function readRawFolds(host: FoldHost, id: ViewIdentity | null): string[] {
	if (id === null) return sessionFolds.get(host) ?? [];
	return loadViewState(host.app, id).folds.collapsed;
}

function writeRawFolds(host: FoldHost, id: ViewIdentity | null, all: string[]): void {
	if (id === null) {
		sessionFolds.set(host, all);
		return;
	}
	const state = loadViewState(host.app, id);
	saveViewState(host.app, id, { ...state, folds: { ...state.folds, collapsed: all } });
}

/**
 * The paths folded shut in ONE scope (one release, one person), from the same
 * per-identity entry every other pick is stored in. Nothing new is persisted:
 * `folds.collapsed` already exists and this host's identity gives it its own copy.
 *
 * Neither of `ViewStateController`'s two rename walks reaches these keys, and that is
 * not a cost — the walk that carries a fold here is `renamePathFolds`
 * (`storage/viewStateStore.ts`), over the STORED entries and wired to
 * `vault.on('rename')` at the plugin. Renaming a member, or the scope's own note,
 * therefore migrates the fold rather than reopening the row. What made that affordable
 * was moving the key shape DOWN rather than copying it: `notePath`, `scopeOf` and
 * `movedFoldKey` live in `storage/foldKeys.ts`, the layer that stores the key, so
 * `storage/` needs no import from `view/` and there is still exactly one `notePath`.
 */
export function foldedPaths(host: FoldHost, prefix: string, scopePath: string): Set<string> {
	const id = resolveViewIdentity(host.app, host.viewEl, host.config.name ?? '');
	const full = foldPrefix(prefix, scopePath);
	// Only THIS scope's keys, stripped back to member paths — the caller asks about the
	// rows it is drawing, and a key from another scope answers a different question
	// about the same note.
	return new Set(
		readRawFolds(host, id)
			.filter((k) => k.startsWith(full))
			.map((k) => k.slice(full.length)),
	);
}

/** Write this scope's fold set back, keeping every other scope's keys — and any other
 *  fold this store already holds — untouched.
 *
 *  The set is the WHOLE truth about this scope: a path in it is folded and a path absent
 *  is open, with no third state for "nobody has ruled on this row". So a scope nobody
 *  has folded anything in opens whole — decided rather than emergent, and stated with
 *  the reason in `docs/requirements/The scope of a release as a tree.md` extension 2b,
 *  along with why seeding this set on first open would be worse than the default it
 *  replaces. */
function writeFolds(host: FoldHost, prefix: string, scopePath: string, folded: ReadonlySet<string>): void {
	const id = resolveViewIdentity(host.app, host.viewEl, host.config.name ?? '');
	const full = foldPrefix(prefix, scopePath);
	const others = readRawFolds(host, id).filter((k) => !k.startsWith(full));
	const mine = [...folded].map((path) => `${full}${path}`);
	writeRawFolds(host, id, [...others, ...mine]);
}

/**
 * Flips one row's fold and redraws — one call rather than two repeated at every caller.
 * The disclosure's own click used to pair this with `view.render()` itself, and the
 * keyboard's Left/Right need the identical pair; the render lives in here so both call
 * one function instead of each remembering the redraw.
 */
export function toggleFold(host: FoldHost, prefix: string, scopePath: string, path: string): void {
	const folded = foldedPaths(host, prefix, scopePath);
	if (folded.has(path)) folded.delete(path);
	else folded.add(path);
	writeFolds(host, prefix, scopePath, folded);
	host.render();
}

/**
 * Fold or unfold every row THIS scope drew, without touching another scope's set —
 * `rows` is what makes "exactly this scope" precise rather than "everything".
 *
 * **Collapsing writes a key only for rows `childRows` says have a child** — never for a
 * leaf. A leaf has no disclosure to close, so a leaf's fold key is not a fold anything
 * can ever act on: it sits in `folds.collapsed` forever, indistinguishable from a stale
 * entry every reader already has to defend against. That would cost nothing on its own
 * if the list were free, but it is not — `folds.collapsed` spends from one `MAX_FOLDS`
 * budget shared across every scope this saved view holds (`storage/viewStateStore.ts`'s
 * `readFolds`), which keeps the FIRST entries read and drops the rest once it runs out.
 * A key per leaf is pure waste against that budget: it cannot be un-collapsed, it
 * cannot be seen, and every one written is a slot a REAL fold — on this scope or
 * another — can no longer buy, so folding a row eventually stops working with no
 * error, the redraw simply leaving it open. Expanding needs no such filter: it already
 * writes the empty set.
 *
 * **`rows` here is the caller's FULL scope, not any hide-done-filtered subset a render
 * computes its own kept-set over** — so with hide-done ON this can write a key for a row
 * the tree currently draws as a leaf; accepted rather than threaded through, since the
 * key reads correctly again the moment hide-done goes off and nothing draws a chevron
 * over an empty subtree meanwhile.
 */
export function setAllFolds(host: FoldHost, prefix: string, scopePath: string, rows: ScopeRow[], folded: boolean): void {
	if (!folded) {
		writeFolds(host, prefix, scopePath, new Set());
		return;
	}
	const withKids = childRows(rows);
	writeFolds(
		host,
		prefix,
		scopePath,
		new Set(rows.filter((row) => withKids.has(row.item.file.path)).map((row) => row.item.file.path)),
	);
}

/**
 * The session-only fallback for {@link scopeFlag}/{@link setScopeFlag}, {@link
 * sessionFolds}'s own reason: an embedded base has no identity, so the toggle is
 * session-only there — gone on reload, exactly as the pick and the folds are.
 *
 * One map for both scope flags rather than one `WeakMap` per key: a host only ever asks
 * about its own key (a release view never asks `myWorkHideDone`), so nothing here has to
 * keep two flags apart for one host — but the value is still read and written by the
 * KEY it was asked with, never assumed.
 */
const sessionFlags = new WeakMap<FoldHost, Partial<Record<'releaseHideDone' | 'myWorkHideDone', boolean>>>();

/**
 * Whether a scope screen is hiding finished subtrees — ONE flag for the whole host,
 * never scoped per release or per person the way {@link foldedPaths} is: a fold set has
 * to answer "is THIS row open" for as many scopes as the base holds, but hiding is a
 * single working preference the reader carries from one scope's screen to the next,
 * `bucketList`'s own shape (`storage/viewStateStore.ts`). Read through the same
 * per-identity entry the pick and the folds use, so it survives exactly as they do and
 * no further.
 *
 * `key` is which screen is asking — `'releaseHideDone'` or `'myWorkHideDone'`
 * (`ViewPrefs`) — never a value this module invents, since the two screens' readers keep
 * this choice independently rather than sharing one bit.
 */
export function scopeFlag(host: FoldHost, key: 'releaseHideDone' | 'myWorkHideDone'): boolean {
	const id = resolveViewIdentity(host.app, host.viewEl, host.config.name ?? '');
	if (id === null) return sessionFlags.get(host)?.[key] ?? false;
	return loadViewState(host.app, id).prefs[key] === true;
}

/** Flip the toggle and redraw — {@link toggleFold}'s own pairing, for the identical
 *  reason: every caller wants the write and the render together rather than
 *  remembering both. */
export function setScopeFlag(host: FoldHost, key: 'releaseHideDone' | 'myWorkHideDone', next: boolean): void {
	const id = resolveViewIdentity(host.app, host.viewEl, host.config.name ?? '');
	if (id === null) {
		const flags = sessionFlags.get(host) ?? {};
		flags[key] = next;
		sessionFlags.set(host, flags);
	} else {
		// `undefined` for the default rather than `false`: absence IS the off state, and a
		// stored `false` would be a value meaning "none" — `readPrefs`'s own rule
		// (`storage/viewStateStore.ts`), which `updateViewPrefs` passes straight through.
		updateViewPrefs(host.app, id, { [key]: next ? true : undefined });
	}
	host.render();
}
