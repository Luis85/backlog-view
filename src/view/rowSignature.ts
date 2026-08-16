import { BacklogItem } from '../domain/model';
import { ownWorkflowReading } from '../domain/board';
import { childTypeChoices, displayType } from '../domain/itemTypes';
import { offerableTypes, projectionPopulation } from './projection';
import { drawsSomething } from './render/columns';
import { BacklogViewHost, Column } from './host';

/**
 * What decides whether a rendered row may be KEPT across a data update, as two strings —
 * and they are two because the two halves fail differently. See ADR 0029.
 *
 * {@link renderInputs} is everything a pass draws from that belongs to no single item,
 * compared ONCE. It is safe by construction: `host.settings` goes in whole, so a
 * settings-derived rendering decision written next year is covered without anyone
 * remembering to add a term.
 *
 * {@link rowSignature} is everything ONE row draws from, and it is an ENUMERATION.
 * Nothing fails when a term is missing — the build says nothing, the suite says nothing,
 * and the symptom is a stale cell on screen. That asymmetry is this design's real cost
 * and it is stated here rather than smoothed over. Four review rounds found this list
 * short, two of them inside the fix for the previous one.
 *
 * Pure and DOM-free, `childrenList.ts`'s shape: it takes a `BacklogViewHost`, so it
 * cannot live in `domain/`, and it renders nothing, so it does not belong in `render/`.
 *
 * ## Every `item.*` the tree's row path reads, and the term that covers it
 *
 * Swept over the WHOLE of `render/rows.ts`, `render/columns.ts` and `render/chips.ts`
 * (chips are a per-row renderer since they moved out of `columns.ts`), plus **every**
 * helper those files hand the item to: `displayType`, `ownWorkflowReading`,
 * `childTypeChoices`, `rollupReport`, `stateKeyFor` and `placementEnds`. Start a re-sweep
 * from that list of six rather than rediscovering which helpers matter — the first sweep
 * matched call sites with a pattern needing `(item` or `(host, item`, which silently
 * misses `stateKeyFor(host.settings, item)`, the one helper in the set that turned out to
 * hold the gap below. A grep for `item.` cannot see any of the six, and it credits a field
 * named only in a COMMENT: `item.levelIndex` appears nowhere in `src/view/` outside two.
 *
 * | read | covered by |
 * | --- | --- |
 * | `typeName` `tags` `horizon` `riskValue` `assigneeValue` `plannedStart` `plannedTarget` `stateValue` and both secondary state values | the frontmatter term — one term, so nobody has to predict which keys a column is pointed at tomorrow |
 * | `entry` (every `note.*` cell) | the frontmatter term, given {@link reusableColumns} refused every other source, plus {@link renderInputs}' per-column type probe |
 * | `levelIndex` (the badge's text) | `displayType(item)` — the answer the badge draws, rather than the fields behind it |
 * | `ladder` | **no term here at all — projection MEMBERSHIP.** See below; this is the one read with nothing in this file behind it. |
 * | `effectiveLevelIndex` (via `childLevelIndex`) | `offerableTypes(host, childTypeChoices(item))` — the add button's presence and label |
 * | `done` `deliverableDone` `testDone` (the `pbl-done` class) | `ownWorkflowReading(item).done` for the FLAG — but not for which workflow supplies it, which is `ladder` again |
 * | `descendantCount` `doneDescendants` (via `rollupReport` too) | a term each |
 * | `title` `depth` `impliedType` `orphan` `outsideFilter` | a term each |
 * | `children` | the VISIBLE child test, not the raw list: a chevron follows what renders |
 * | `file` | the path is the row's identity, so it is the reuse KEY rather than a term |
 *
 * ### `item.ladder` is guarded by membership, and that has to be written down
 *
 * `ladder` is the only read with no signature term behind it, and it is NOT covered by
 * `displayType`: `Task` names a rung of BOTH ladders (`typeVocabulary.ts` says so), so
 * `displayType` returns `"Task"` either way, and `childTypeChoices` clamps to `"Task"` on
 * both sides too. It is also not private to the badge — `stateKeyFor` and
 * `ownWorkflowReading` each branch on `inCatalog(item)`, which is exactly
 * `item.ladder === TEST_LEVELS`, so the ladder decides WHICH KEY and WHICH VALUE this
 * row's state chip draws. A note `type: Task, status: Doing, test_status: Passed` whose
 * parent is retyped `PBI` → `Test suite`, with a distinct `testStateProperty`, draws
 * `Doing` from `status` in one case and `Passed` from `test_status` in the other, and
 * {@link rowSignature} returns the byte-identical string for both.
 *
 * What makes that safe today is a fact in `view/projection.ts` and not in this file:
 * `projectionMember` IS `inCatalog` (or its negation), so a ladder flip takes the row off
 * whichever tree-shaped projection is drawing it. The row is never reused because it is
 * never rendered.
 *
 * That is a `renderInputs`-shaped guarantee resting on a term in neither function, so it
 * is written here rather than left to be inferred. **If `projectionMember` ever stops
 * being `inCatalog`** — a projection drawing both ladders, a Deliverable row on a
 * tree-shaped surface — the guard vanishes with no edit to this file and no test failing,
 * and a state chip goes stale in the wrong column behind a matching signature. The fix
 * then is a `item.ladder` term here, not a fifth argument. ADR 0029's `## Revisit when`
 * carries the same trigger.
 *
 * Two the pass owns rather than the row: `host.colWidths` writes one custom property per
 * column onto the tree element and never onto a cell, so a resize moves every row without
 * touching one — it is a term of {@link renderInputs} all the same, because the HEADER's
 * grip is built from the number and a pass that reuses leaves that header alone; and
 * `host.clickFolds` changes what a click MEANS, resolved per event by the delegated
 * handler, never drawn.
 *
 * ## What the checks under this list actually reach
 *
 * Each of the sixteen terms was deleted in turn and BOTH `test/view/rowSignature.test.ts`
 * and `test/view/rowReuse.test.ts` were run — the walk's suite as well as the signature's
 * own, because a term this file states can be held by the render that spends it. **Eleven
 * of the sixteen have a test that fails without them**, and the two instruments agree on
 * which eleven: the wider one is named because it is what the count was taken with, not
 * because it reaches further here. The other five are stated below rather than left
 * reading as checked, because a term nothing can fail on is exactly the shape this file
 * exists to distrust. Five in FOUR bullets — the first names two, held only as a pair:
 *
 * - `displayType(item)` and `offerableTypes(host, childTypeChoices(item))` are held as a
 *   PAIR — the parent-retype test fails only when BOTH go. Neither could be isolated: a
 *   badge and an add button are both `effectiveLevelIndex` read off the same ladder, so
 *   every input that moves one moves the other. Both are kept anyway, because that
 *   coupling is a fact about today's two ladders and not a rule either function states.
 * - `item.impliedType` is a strict function of this note's own frontmatter and
 *   `settings.typeKey`, so the first term and {@link renderInputs} already cover it and
 *   nothing can fail without it. Kept because it names a class the row WEARS
 *   (`pbl-implied`), so a sweep reconciles against this list one-to-one; the redundancy
 *   is in the safe direction.
 * - `ownWorkflowReading(item).done` is **not** such a function, and saying it was is a
 *   mistake this comment made once: the reading branches on `inCatalog(item)`, so which
 *   workflow supplies the flag depends on `item.ladder`, which chains from the parent. It
 *   is unheld for the OTHER reason — membership takes such a row off the projection
 *   before a reuse could be attempted, as the `item.ladder` section above sets out. Kept,
 *   and the ladder is what to add here if that membership rule ever changes.
 * - `item.title` is `file.basename`, so it cannot move while the path is fixed and the
 *   path is the reuse key. Kept rather than argued, because that argument is about a
 *   module this one does not import.
 */

/**
 * Everything a pass draws from that belongs to no single item, as one string compared
 * once per render.
 *
 * It exists so {@link rowSignature} below can stay strictly per-item. A row draws from more
 * than its own note — `showCounts` turns the rollup cell on and off, a changed done value
 * repaints `.pbl-done`, the filter text decides which substring lights up, the fit verdict
 * sizes every cell — and `refreshFromData` re-resolves the settings on the same
 * argument-less update path, so a view-option change arrives looking like a data change.
 *
 * Listing those inside the per-row signature would be a list of the places somebody
 * thought of, and the next settings-derived rendering decision is the one it would miss.
 * Answered here instead: unchanged, rows may be kept; changed, the pass rebuilds.
 */
export function renderInputs(host: BacklogViewHost): string {
	return JSON.stringify([
		host.settings,
		host.columns,
		host.projection,
		host.filterText,
		host.columnFit,
		// The HEADER's, not the rows': a cell points at its column's published custom
		// property rather than holding a number, so a resize moves every row without
		// touching one — but the header's grip announces the width it was built with
		// (`aria-valuenow`) and its gesture measures from it, and a pass that keeps the
		// header keeps both. The rows are rebuilt with it, which is what every pass did
		// before this decision and is one wasted build per keypress.
		host.colWidths,
		valueKinds(host),
	]);
}

/**
 * The RENDERED TYPE of each column, probed once per pass.
 *
 * A property's type is Obsidian's, not the note's: change `points` from text to date in
 * the property registry and `Value.renderTo` draws the same YAML scalar a different way,
 * while the frontmatter — and so every row signature — is identical. The columns list
 * cannot see it either; the property id did not change.
 *
 * A type belongs to the PROPERTY, vault-wide, so it cannot differ between two notes in
 * one column — which is what makes a probe exact rather than a sample. But the sample
 * must be **per column**: one entry chosen for all of them reports nothing for a column
 * that entry happens to leave empty, and keeps reporting nothing as the registry changes
 * underneath a later row that does have a value. So each column finds its own first
 * populated entry, and a column no result populates contributes nothing because there is
 * nothing on screen to go stale.
 *
 * `results`, not `items`: a context row is never a source of anything derived from the
 * Base's results — and THIS projection's results, not the plan's, since the catalog draws
 * from `model.catalog` and probing `model.results` would record an empty kind for a
 * property only the test rows carry. `projectionPopulation` is the existing answer to
 * "whose rows are these" and the renderer asks it too.
 *
 * ponytail: linear scan per empty column, once per pass — O(results × empty columns) at
 * worst. If a wide base with mostly empty columns ever shows up in the numbers, cache the
 * resolved kinds and invalidate them on a column-list change.
 */
function valueKinds(host: BacklogViewHost): string[] {
	const model = host.model;
	const results = model ? projectionPopulation(host.projection, model).results : [];
	return host.columns.map((column) => {
		for (const item of results) {
			try {
				const value = item.entry?.getValue(column.prop) ?? null;
				// `drawsSomething`, not `!= null`: a missing property comes back as a
				// `NullValue` INSTANCE, which is not null, so a bare null check stops at
				// the first row that lacks the property and records `NullValue` as the
				// column's type for good — leaving a populated row's rendering unguarded.
				if (drawsSomething(value)) return value.constructor.name;
			} catch {
				// This entry cannot answer for this property; the next one may.
			}
		}
		return '';
	});
}

/**
 * Whether this column set allows reuse at all.
 *
 * `file.mtime`, `file.size` and a `formula.*` are refused: a body edit changes
 * `file.mtime` with the frontmatter untouched, so the cell would go stale while its
 * signature matched — the one failure direction that is not acceptable.
 *
 * **This is the source of the value, not the value's rendering, and it is only half the
 * question.** A `note.*` value goes through `Value.renderTo` in `renderValue`, which for a
 * wikilink draws a link — or an embed — whose text belongs to ANOTHER note. Rename that
 * note and this row's own frontmatter is unchanged. The prefix cannot see that, and the
 * second half is answered per row at render time instead: the pass asks the cell what it
 * actually drew rather than predicting it.
 *
 * ponytail: a whole-pass refusal for the non-frontmatter columns, where a per-cell rule
 * would keep the win for those vaults. Upgrade path is re-rendering those cells alone on
 * a kept row, which costs a second reuse rule; take it when a vault that shows one of
 * these columns complains about the pause.
 */
export function reusableColumns(columns: readonly Column[]): boolean {
	return columns.every((column) => column.prop.startsWith('note.'));
}

/**
 * A JSON replacer that keeps apart values `JSON.stringify` would flatten into each other.
 *
 * The signature's whole job is that a match means "draws the same". `JSON.stringify`
 * breaks that in three places, and each is a **false match** — the direction that ships a
 * stale row rather than one wasted build:
 *
 * - `NaN` and `Infinity` both serialize as `null`, so a key changing between YAML `.nan`
 *   and an empty value reads as unchanged.
 * - a `Date` serializes to its ISO string, so a real date and a string that spells the
 *   same instant collide — and Bases renders those two differently.
 * - `undefined` is dropped entirely, so a key holding it is indistinguishable from a key
 *   that is absent.
 *
 * It reads `this[key]` rather than the `value` argument because `toJSON` runs FIRST: by
 * the time the replacer sees a `Date` it is already a string. The holder is where the
 * type still exists.
 *
 * **Ordinary strings beginning `#` are escaped**, and that is what keeps the tagging
 * injective rather than trading one collision for another: without it a note literally
 * containing the text `#num:NaN` would serialize exactly as a real `NaN` does. Escaping
 * moves every authored string out of the sentinel namespace — `#num:NaN` becomes
 * `##num:NaN`, `##x` becomes `###x` — so no value a user can write can spell a tag.
 */
function distinctly(this: Record<string, unknown>, key: string, value: unknown): unknown {
	const raw = this[key];
	if (raw instanceof Date) return `#date:${raw.toISOString()}`;
	if (typeof raw === 'number' && !Number.isFinite(raw)) return `#num:${String(raw)}`;
	if (raw === undefined) return '#undefined';
	if (typeof raw === 'string' && raw.startsWith('#')) return `#${raw}`;
	return value;
}

/**
 * Everything ONE row draws from, given that {@link renderInputs} already held.
 *
 * Two groups: the note's frontmatter, which is one term covering the title's own cells,
 * every `note.*` value, all six chips and the tags — and the derived values a row shows
 * that its own frontmatter cannot give.
 *
 * The frontmatter goes in whole rather than key by key on purpose. A subset would have to
 * predict which keys a column might be pointed at, and the safe failure direction is the
 * other one: a signature that differs when the row would have drawn the same costs one
 * wasted row build, where a signature that matches when it would have drawn differently
 * ships a stale row.
 *
 * The derived terms are the enumeration, and the table at the top of this file is what a
 * sweep should be reconciled against rather than a memory. Two of them are stated as the
 * ANSWER a row draws rather than as the fields behind it — `displayType` for the badge,
 * `offerableTypes` for the add button — because a field list is what went short before,
 * and naming the function covers a field added to it later. What that does NOT buy is a
 * field the function reads without its answer moving, which is exactly `item.ladder`:
 * read up there for the one term this list deliberately does not carry.
 *
 * Returns null where the row cannot be signed AT ALL — a note the metadata cache has not
 * answered for yet. The guard at the top of the body says why that is not the same thing
 * as signing an absent frontmatter, and the walk treats it exactly as it treats a row that
 * drew another note's content: nothing recorded, so nothing to match, so never claimed.
 */
export function rowSignature(
	host: BacklogViewHost,
	item: BacklogItem,
	place: { pos: number; count: number },
): string | null {
	const frontmatter = host.app.metadataCache.getFileCache(item.file)?.frontmatter;
	// UNSIGNABLE, rather than signed as an absent value. The metadata cache fills
	// asynchronously, so Bases can hand the view an entry before `getFileCache` answers for
	// that note — and the row's own cells are drawn from that ENTRY while this term is read
	// from the CACHE. While the two disagree about what is known, a `note.*` value can move
	// between two passes with this string identical, and the row would be kept with a stale
	// cell. Signing it as `null` made every such row stable and therefore reusable, which is
	// exactly the hole. The row still RENDERS as it always did; it is only ineligible for
	// reuse, which the walk states once for this case and for a volatile one alike.
	if (!frontmatter) return null;
	return JSON.stringify([
		JSON.stringify(frontmatter, distinctly),
		// `file.basename`, so it cannot move while the path is fixed — carried anyway
		// rather than resting on the reuse key a module this one does not import chooses.
		item.title,
		item.depth,
		// The badge's own text rather than the fields behind it. An UNTYPED note takes its
		// rung from the parent chain, so retyping the parent redraws this badge with this
		// note byte-identical. It does NOT cover a ladder flip — `Task` is a rung of both
		// ladders and this returns `"Task"` either way; see the `item.ladder` section at
		// the top of this file for what does.
		displayType(item),
		item.impliedType,
		// Draws the `.pbl-orphan` unlink marker, and flips when a referenced parent starts
		// being returned by the Base: same frontmatter, same depth, same position.
		item.orphan,
		item.outsideFilter,
		item.descendantCount,
		item.doneDescendants,
		ownWorkflowReading(item).done,
		item.children.some((child) => !host.isRowHidden(child)),
		host.isCollapsed(item.file.path),
		host.selectedPath === item.file.path,
		place.pos,
		place.count,
		offerableTypes(host, childTypeChoices(item)),
	]);
}
