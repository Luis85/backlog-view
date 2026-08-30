import { App } from 'obsidian';

/**
 * The id a note this plugin creates carries, and the one question about it: what the next
 * one is.
 *
 * A FIXED key, and the only write target in `src/` that is not a row in
 * `optionalProperties.ts`. Those rows exist to name a property a vault ALREADY has and to
 * gate a feature that cannot run until somebody points at it. An id names nothing that
 * pre-exists: the plugin invents the value, writes it once at creation, and never reads it
 * back to decide anything. A configurable key would add a fifth reader to that table and
 * one more way for this to be switched off, in exchange for renaming a property nothing
 * else in the vault refers to. The `pbl-` prefix is this plugin's own namespace, and that
 * one word is the whole collision surface.
 */

/** The frontmatter key every note this plugin creates carries. */
export const ITEM_ID_KEY = 'pbl-id';

/**
 * The highest id this session has already handed out, per vault.
 *
 * A floor on a READ, never a source of truth. `metadataCache` catches up asynchronously,
 * so two creations in one tick both scan a vault that knows about neither and would take
 * the same maximum; the floor is what stops the second one repeating the first. It only
 * ever moves up, a reload re-derives it from the vault, and a vault whose ids were edited
 * by hand or restored from a backup overrules it — `nextItemId` reads the scan first.
 *
 * Keyed by `App` rather than held as one number so a second vault cannot inherit the
 * first's count. That is also what keeps the suite honest: each test's fake gets its own
 * floor without a reset hook, so nothing here needs an export only a test calls.
 */
const floors = new WeakMap<App, number>();

/**
 * The next id for this vault: one past the highest that either the vault holds or this
 * session has issued.
 *
 * Deriving it from the Base's RESULTS was refused twice over — the context-row rule
 * forbids it, and a note the filter excluded still holds an id, so skipping it would hand
 * the next creation a number already on disk. A persisted counter was refused for a
 * different reason: two devices on a synced vault would each hold their own and both would
 * issue the same number. The vault is the only copy of this state both devices see.
 *
 * A value is counted only while it floors to something BELOW `Number.MAX_SAFE_INTEGER`,
 * and both halves earn their place. The floor keeps a hand-typed `pbl-id: 7.5` from
 * issuing `8.5` — it counts as `7`, and ignoring it instead would let the next creation
 * land on `7`, which reads as the same item to anyone who rounded it. The ceiling stops one
 * absurd value breaking the sequence permanently, since `1e21 + 1` is still `1e21` in a
 * double and every later id would be that same number forever. `NaN` needs no guard of its
 * own — `NaN > highest` is false whichever way it is asked — which is why one comparison
 * covers `''`, a word and `Infinity` alike — but NOT an object or a boolean, which is why
 * the shape is asked before the arithmetic rather than left to the comparison. Raised by
 * automated review on PR #226, whose evidence was that the malformed-value test only used
 * inputs coercing to `0` or `NaN` and so could not see either.
 *
 * What this canNOT reach, twice over, and both are the guarantee rather than a gap to close
 * later. **Two devices, both offline**, each having synced a maximum of `N`: neither can see
 * the note the other is about to make, so both issue `N+1`. **A file on disk this vault has
 * not indexed yet** — just synced, just restored, written by another program: it is returned
 * by `getMarkdownFiles()` while `getFileCache` answers `null`, so the id it holds is not read
 * and can be issued again. So the claim is narrow on purpose: an id is unique among the notes
 * Obsidian has INDEXED on the creating device. Nothing reconciles a collision afterwards and
 * nothing reports one. Reading the unindexed files instead would make every creation await a
 * parse of every one of them and turn this function async into all four creators, for a
 * number nothing reads back; and a short incremental integer cannot be more than best-effort
 * unique without coordination the vault has no place to keep. Both raised by automated review
 * on PR #226.
 *
 * ponytail: one `getFileCache` per markdown file per creation, against a cache Obsidian
 * already holds in memory. A creation is a user gesture, so this is cheap at backlog scale;
 * a vault large enough to feel it would want the scan narrowed to the folders the plugin
 * writes into.
 */
export function nextItemId(app: App): number {
	let highest = floors.get(app) ?? 0;
	for (const file of app.vault.getMarkdownFiles()) {
		// `unknown`, not the `any` the typings hand back: the two `typeof` guards below are the
		// whole point, and an `any` would let a shape past them without the compiler noticing.
		const raw: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[ITEM_ID_KEY];
		// The SHAPE first, because `Number` coerces two shapes Obsidian's own property
		// editor can produce into plausible ids: a checkbox reads `true` as `1`, and a
		// one-element list reads `[900]` as `900`. Both would advance the sequence off a
		// value that is not an id at all. A string is admitted rather than refused —
		// `pbl-id: "7"` is a text-typed property, and skipping it would hand `7` to a
		// second note that then reads as the same item to anyone looking at the two notes.
		if (typeof raw !== 'number' && typeof raw !== 'string') continue;
		const value = Math.floor(Number(raw));
		if (value > highest && value < Number.MAX_SAFE_INTEGER) highest = value;
	}
	const next = highest + 1;
	// The scan's ceiling is not enough on its own: a note holding `MAX_SAFE_INTEGER - 1`
	// passes it, and the SECOND call then issues `MAX_SAFE_INTEGER + 1` — a value adding one
	// no longer moves, so every call after it repeats that same number. Guarding what is
	// ISSUED is what closes the boundary the scan's guard leaves open. Unreachable in a real
	// vault by nine orders of magnitude, and a throw rather than a clamp for
	// `createRelease`'s stated reason: this is a state the caller is supposed to have ruled
	// out, and silently handing back a duplicate is the outcome worth refusing.
	if (!Number.isSafeInteger(next)) throw new Error('nextItemId: the id sequence is out of safe integers');
	floors.set(app, next);
	return next;
}
