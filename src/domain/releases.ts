import { App } from 'obsidian';
import { BacklogItem, BacklogModel, inPlan } from './model';
import { ReleaseSettings } from './releaseOptions';
import { CivilDate, FieldReading, linkpathFromRawValue, ownValue, readDate, readString } from './noteFields';
import { isMarkerType } from './itemTypes';

/**
 * A figure with THREE answers, not two. `FieldReading` in `noteFields.ts` separates a
 * key that holds nothing (absent) from one holding something no reader will guess at
 * (invalid); this adds the third the register insists on — a key nobody bound at all.
 * "Unconfigured" is a column absent for every row and named once; "invalid" is one row
 * saying somebody wrote something there. Collapsing them reports a configuration mistake
 * as a data mistake, or the reverse.
 */
export interface ReleaseFigure<T> {
	value: T | null;
	invalid: boolean;
	unconfigured: boolean;
}

export interface ReleaseRow {
	item: BacklogItem;
	path: string;
	name: string;
	version: ReleaseFigure<string>;
	target: ReleaseFigure<CivilDate>;
	status: ReleaseFigure<string>;
	/**
	 * Notes whose OWN membership property names this release — never an ancestor, never a
	 * descendant. A FIGURE like the other three, not a bare number: with the membership key
	 * unbound every release would otherwise report a truthful-looking `0`, when the honest
	 * answer is that the count cannot be read at all. Same rule as every other unconfigured
	 * figure — the column is absent and named once, never zero in each row.
	 */
	members: ReleaseFigure<number>;
}

export interface ReleaseIndex {
	rows: ReleaseRow[];
	/**
	 * Items whose membership value named no release this base holds — the RULE rather than
	 * a list of the ways, because {@link membershipTarget} already enumerates its refusals
	 * and a second copy beside them drifts: this comment named three while the code made
	 * five. Reported rather than dropped: they belong to no release, so they appear on no
	 * release's screen and this is the only place they can be seen.
	 */
	unresolved: BacklogItem[];
}

const UNCONFIGURED = { value: null, invalid: false, unconfigured: true } as const;

function figure<T>(reading: FieldReading<T>): ReleaseFigure<T> {
	return { value: reading.value, invalid: reading.invalid, unconfigured: false };
}

/**
 * A label read with [[Releases as their own type]] 3b's own rule: a configured key holding
 * SOMETHING that is not a usable label — an object, a list of them, **or an empty string,
 * which 3b names explicitly** — is unreadable rather than absent, "because somebody wrote
 * something there".
 *
 * `readString` alone cannot answer this: it returns null for an object and for `''` alike,
 * so hard-coding `invalid: false` beside it reports malformed data as an unset key. Worse
 * for a LIST, which it does not refuse at all — it recurses into the first element, so
 * `['0.8.0', '0.9.0']` reads as a clean `0.8.0` and the second value disappears, which is
 * why the array is refused BEFORE the shared reader rather than after it. Not
 * `readPlacement` either, which is the closest existing reader and deliberately calls an
 * empty value ABSENCE — right for a roadmap horizon, wrong for a version 3b says is a
 * refusal.
 */
function readLabel(raw: unknown): FieldReading<string> {
	if (raw === null || raw === undefined) return { value: null, invalid: false };
	if (Array.isArray(raw)) return { value: null, invalid: true };
	const text = readString(raw);
	return text === null ? { value: null, invalid: true } : { value: text, invalid: false };
}

/**
 * The same refusal for the DATE figure, and it needs its own statement because `readDate`
 * has `readString`'s habit: it unwraps an array by recursing into its first element, so
 * `target-date: [2026-09-01, 2026-10-01]` would report a clean `2026-09-01` and SORT the
 * index by it. A release states one target date; a list of them is 3b's
 * configured-but-unreadable, not a value to pick from.
 */
function readTarget(raw: unknown): FieldReading<CivilDate> {
	if (Array.isArray(raw)) return { value: null, invalid: true };
	return readDate(raw);
}

/**
 * Every row a membership property may legally be READ from: the whole tree, minus the
 * context rows.
 *
 * NOT `model.results`, and this is the trap. `results` is the PLAN projection —
 * `projectionForest(focusRoots, inPlan, …)` — so `inPlan` has already dropped every
 * iteration and every test-catalog row before this module sees them. Scanning it would
 * make two of the four non-plan cases unreportable: an `Iteration` or a `Test case`
 * carrying the property by hand would be invisible rather than refused, which is the
 * silent drop [[Setting an item's release]] 1f exists to prevent. `byPath` is the whole
 * set `assignAll` built, so the eligibility guard in {@link membershipTarget} is what
 * refuses a row — never the population it was never shown.
 *
 * `outsideFilter` rows ARE excluded, and that is the context-row rule rather than an
 * exception to this one: a row the Base excluded is never a source of anything derived
 * from the results.
 */
function scannableRows(model: BacklogModel): BacklogItem[] {
	return [...model.byPath.values()].filter((item) => !item.outsideFilter);
}

/**
 * The rank the model already parsed — `item.order`, not a second read of the cache.
 *
 * `readItems.ts` sets `order` from the MAPPED order key, which is exactly the value this
 * sort wants. Re-reading it here would be redundant and, worse, would disagree:
 * `readNumber` uses `Number.parseFloat`, so `10 - first` is rank 10 everywhere else in the
 * plugin, while a `Number()` conversion makes it `NaN` and drops the release to the
 * undated tail. One value, parsed once, or the index orders releases differently from
 * every other screen.
 *
 * A release with no readable rank sorts after every release that has one, so the path
 * tie-break decides between them.
 */
function rank(item: BacklogItem): number {
	return item.order ?? Number.POSITIVE_INFINITY;
}

/** A civil date as a sortable integer; undated sorts last, never as the epoch. */
function dateKey(target: ReleaseFigure<CivilDate>): number {
	const d = target.value;
	if (d === null) return Number.POSITIVE_INFINITY;
	return d.year * 10000 + d.month * 100 + d.day;
}

export function releaseIndex(app: App, model: BacklogModel, settings: ReleaseSettings): ReleaseIndex {
	// Counted rather than seeded: a release nothing points at simply has no entry, and
	// `?? 0` in the row below is what turns that into the zero it means. Seeding every
	// release with 0 first would say the same thing twice.
	const counts = new Map<string, number>();
	const unresolved: BacklogItem[] = [];

	for (const item of scannableRows(model)) {
		const named = membershipTarget(app, item, model, settings);
		if (named === null) continue;
		if (named === UNRESOLVED) {
			unresolved.push(item);
			continue;
		}
		counts.set(named, (counts.get(named) ?? 0) + 1);
	}

	const rows = model.releases.map((item): ReleaseRow => {
		const fm = app.metadataCache.getFileCache(item.file)?.frontmatter;
		return {
			item,
			path: item.file.path,
			name: item.file.basename,
			version: settings.versionKey ? figure(readLabel(ownValue(fm, settings.versionKey))) : UNCONFIGURED,
			target: settings.targetDateKey ? figure(readTarget(ownValue(fm, settings.targetDateKey))) : UNCONFIGURED,
			status: settings.statusKey ? figure(readLabel(ownValue(fm, settings.statusKey))) : UNCONFIGURED,
			members: settings.membershipKey
				? figure({ value: counts.get(item.file.path) ?? 0, invalid: false })
				: UNCONFIGURED,
		};
	});

	rows.sort((a, b) => {
		// Values compared, never their difference — two undated releases make
		// `Infinity - Infinity`, which is `NaN`, and a comparator that returns `NaN` sorts
		// at random. `Infinity` itself is not the hazard: `sort` reads only the SIGN of the
		// result, so `Infinity - n` would order correctly. Both keys below use the same
		// shape, the second one for the further reason stated at it.
		if (dateKey(a.target) !== dateKey(b.target)) return dateKey(a.target) < dateKey(b.target) ? -1 : 1;
		// NOT `rank(a) - rank(b)` guarded by `Number.isFinite`: an unranked release is
		// `+Infinity`, and `Infinity - 10` is `Infinity`, which that guard rejects — so the
		// ranked release and the unranked one would fall through to the PATH tie-break
		// together, and a rank the vault states would decide nothing.
		if (rank(a.item) !== rank(b.item)) return rank(a.item) < rank(b.item) ? -1 : 1;
		// The final tie-break, and it is what makes the order STABLE across renders: two
		// releases sharing a date and a rank — or a vault with the order property unmapped,
		// where none of them has a rank at all — would otherwise sit in whatever order the
		// results arrived in.
		return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
	});

	return { rows, unresolved };
}

/**
 * Returned when a membership value exists but names no release this base holds.
 *
 * Module-private, with {@link membershipTarget}, until something outside this file reads
 * them: an export nothing imports is dead surface and `npm run analyze` says so. Task 5's
 * single-release scope is the consumer that earns both an `export`.
 */
const UNRESOLVED = Symbol('unresolved membership');

/**
 * Which release this item names: a path, {@link UNRESOLVED}, or null for "names none".
 *
 * FOUR refusals, and each is a rule rather than a safeguard:
 *   - a value present but unreadable — an empty string, an object, a list of them.
 *     `readString` answers null to all three exactly as it answers null to a key the note
 *     does not carry, and collapsing them drops a hand-written mistake in silence: the
 *     note HAS the key, so somebody wrote something there. Only a missing key and an
 *     empty list mean "names none";
 *   - two values at once — [[The scope of a release as a tree]] 1c: membership is one
 *     value, and reading a list as membership of each would make every writer in this
 *     epic destructive;
 *   - **a carrier that is not plan work.** [[Setting an item's release]] 1f requires this
 *     of the READER, not only of the writer: a release property hand-written onto a
 *     `Milestone`, an `Iteration`, another `Release` or a test-catalog note does not put
 *     it in the scope, "because a release holds work and those notes are not work".
 *     Refusing at one end only would let a hand-edit do what the menu will not — and this
 *     increment builds no menu, so the reader is the only end there is. `isMarkerType` is
 *     not redundant beside `inPlan`: `inPlan` excludes the catalog and the iterations
 *     while ADMITTING a `Milestone` and a `Release`, which is right for the backlog tree
 *     and wrong here, and the marker predicate covers a fourth marker added later without
 *     anyone having to remember this call site;
 *   - a value naming a note that is not a release.
 *
 * **Obsidian's own resolution wins, and a resolved non-release is an answer, not a miss.**
 * `[[R]]` resolving to a note called `R` that is an Epic is extension 1b's case — the
 * value names something that is not a release, so it is unresolved and gets reported.
 * Reassigning it to a release called `R` in another folder would be the view inventing a
 * membership the vault does not spell. Nothing here looks past what `getFirstLinkpathDest`
 * answered, and a bare name needs no second reader: it is the spelling `resolveParent`
 * already tolerates by handing exactly this text to exactly this call.
 */
function membershipTarget(
	app: App,
	item: BacklogItem,
	model: BacklogModel,
	settings: ReleaseSettings,
): string | typeof UNRESOLVED | null {
	if (!settings.membershipKey) return null;
	const raw = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.membershipKey);
	if (raw === null || raw === undefined) return null;
	if (Array.isArray(raw)) {
		if (raw.length === 0) return null;
		if (raw.length > 1) return UNRESOLVED;
	}
	// `readString` trims and answers null for a blank string, so this one test covers the
	// empty value 3b names as well as the shapes no reader will guess at.
	const text = readString(raw);
	if (text === null) return UNRESOLVED;
	if (!inPlan(item) || isMarkerType(item.typeName)) return UNRESOLVED;
	const file = app.metadataCache.getFirstLinkpathDest(linkpathFromRawValue(text), item.file.path);
	if (file === null) return UNRESOLVED;
	return model.releases.some((r) => r.file.path === file.path) ? file.path : UNRESOLVED;
}
