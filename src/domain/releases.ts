import { App, TFile } from 'obsidian';
import { BacklogItem, BacklogModel, inPlan } from './model';
import { ReleaseSettings } from './releaseOptions';
import { CivilDate, FieldReading, linkpathFromRawValue, ownValue, readDate, readString } from './noteFields';
import { isMarkerType, isReleaseType } from './itemTypes';

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
	 * Items carrying a membership value this base could not turn into a membership — the
	 * RULE rather than a list of the ways, because {@link membershipTarget} owns the
	 * refusals and a second copy beside them drifts: this comment named three while the
	 * code made five, and then named a NARROWER rule than the code keeps. "Named no
	 * release this base holds" is false for two of the five — an `Iteration` carrying the
	 * property is refused before its link is ever resolved, and two values name two
	 * releases rather than none — so the sentence has to be about what came OUT of the
	 * reader, never about what the value said. Reported rather than dropped: they belong
	 * to no release, so they appear on no release's screen and this is the only place they
	 * can be seen.
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
 * The same refusal for the DATE figure, and it needs its own statement TWICE, because
 * `readDate` is tolerant in two ways this key cannot be.
 *
 * It has `readString`'s habit of unwrapping an array by recursing into its first element,
 * so `target-date: [2026-09-01, 2026-10-01]` would report a clean `2026-09-01` and SORT
 * the index by it. A release states one target date; a list of them is 3b's
 * configured-but-unreadable, not a value to pick from.
 *
 * And it calls a BLANK string absent (`if (text.length === 0) return absentReading()`),
 * which is right where it is shared — the roadmap's dated axis and `readPlacement` both
 * take empty to mean unplaced — and wrong here. 3b names the empty value explicitly and
 * {@link readLabel} beside it already refuses one, so delegating would make two readers in
 * ONE file answer `''` two different ways: an empty `version` reported as somebody's
 * mistake and an empty `target-date` as a key nobody ever bound.
 *
 * Refused HERE rather than in `readDate`, for this function's whole reason for existing:
 * it is where refusals too strict for the shared reader are added, and a change there
 * would reach every dated axis in the plugin. The guard trims for itself, so
 * whitespace-only is the same answer rather than a second reader agreeing about what a
 * blank is.
 */
function readTarget(raw: unknown): FieldReading<CivilDate> {
	if (Array.isArray(raw)) return { value: null, invalid: true };
	if (typeof raw === 'string' && raw.trim() === '') return { value: null, invalid: true };
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
	// Built once per index and dead with it: `membershipTarget` runs per scannable row, so
	// asking `model.releases` itself made the last refusal a scan and the rebuild
	// O(members x releases). `ReadonlySet` because `.has` is the only thing ever asked of
	// it — the same reason `cardedPaths` (`view/childrenList.ts`) states for its own.
	const releasePaths: ReadonlySet<string> = new Set(model.releases.map((r) => r.file.path));

	for (const item of scannableRows(model)) {
		const named = membershipTarget(app, item, releasePaths, settings);
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
		// `Infinity - Infinity`, which is `NaN`, and `sort` coerces a `NaN` result to `+0`:
		// the pair reads as EQUAL and silently keeps whatever order it arrived in. Worse
		// than the "sorts at random" this comment claimed until 2026-08-22, because random
		// would be noticed. `Infinity` itself is not the hazard: `sort` reads only the SIGN
		// of the result, so `Infinity - n` would order correctly. Both keys below use the
		// same shape, the second one for the further reason stated at it.
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
 * them: an export nothing imports is dead surface and `npm run analyze` says so.
 * {@link releaseScope} is the second consumer and it lives HERE, so it earns neither one
 * an `export` — the first thing that reads either from another module will.
 */
const UNRESOLVED = Symbol('unresolved membership');

/** What the live read below needs — one field `BacklogSettings` also spells. */
interface LiveKeys {
	typeKey: string;
}

/**
 * The type a note states RIGHT NOW, off the metadata cache rather than off the model —
 * for a note the caller has not opened.
 */
function liveTypeOf(app: App, file: TFile, keys: LiveKeys): string | null {
	return readString(ownValue(app.metadataCache.getFileCache(file)?.frontmatter, keys.typeKey));
}

/**
 * Whether a membership write names a TARGET the vault no longer calls a release. A plan
 * carries the `TFile` its picker was built from, and nothing between there and the write
 * asks what that note is now — retype it and the value spells a link to a note that is no
 * longer a release, this reader's own extension 1b, reported as an unresolved membership.
 * Found by review (Codex, PR #201): authorization at plan time is not authorization at
 * write time. A REMOVAL asks nothing — there is no target to be wrong about, and taking
 * the key off a note that may not hold it is the one gesture that must always be allowed.
 *
 * **The CARRIER is deliberately not asked here, and the guarantee is narrowed to say so.**
 * A live walk up the carrier's parent chain shipped beside this and was removed on
 * 2026-08-24: which ladder an item is on is a MODEL decision — `buildModel` chains
 * `ladderFor` off the parent **as loaded** — and the vault cannot answer it, because the
 * writer cannot see the Base's result set. With "Show parents outside the filter" off, a
 * returned `Task` whose `Test suite` parent the Base excluded has no parent in the model,
 * lands on the PLAN ladder, and is offered `Set release` correctly; the walk followed that
 * excluded parent through the vault anyway and refused the write the screen had just
 * offered, with nothing stale about it. What a type NAME can answer is still asked, by
 * `mayHoldField` through `refusesLiveType` (`storage/frontmatter.ts`) — a carrier retyped
 * to a marker or to a catalog rung. What is left uncovered is the reparent of a `Task` (or
 * a typeless note) under a catalog note between the pick and the write, recorded in
 * `docs/issues/A carrier reparented into the catalog keeps its release.md`.
 *
 * What is NOT asked here either is whether the target left the BASE: that is a question
 * about the write gate's contract rather than about the vault, it is shared with
 * `Set iteration`, and it is recorded in `docs/issues/A stale release or iteration target
 * can still be committed.md`.
 */
export function refusesLiveMembership(app: App, target: TFile | null | undefined, keys: LiveKeys): boolean {
	if (!target) return false;
	return !isReleaseType(liveTypeOf(app, target, keys));
}

/**
 * Which release this item names: a path, {@link UNRESOLVED}, or null for "names none".
 *
 * FIVE refusals, and each is a rule rather than a safeguard. Five counted by READING the
 * function: `grep -c 'return UNRESOLVED'` answers four, because the last one is the
 * ternary this function ends on and no grep for one spelling can see it.
 *
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
 *   - a value naming no note at all — `getFirstLinkpathDest` resolved nothing, so the note
 *     names a release that is not in the vault. Unresolved and not "names none": the key
 *     holds text somebody wrote, and answering null here would file a broken link beside a
 *     note that never claimed a release;
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
	releasePaths: ReadonlySet<string>,
	settings: ReleaseSettings,
): string | typeof UNRESOLVED | null {
	if (!settings.membershipKey) return null;
	const raw = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.membershipKey);
	if (raw === null || raw === undefined) return null;
	if (Array.isArray(raw)) {
		if (raw.length === 0) return null;
		if (raw.length > 1) return UNRESOLVED;
	}
	// A link is TEXT. `readString` coerces a number or a boolean to its string form, which
	// is wider than any other reader of a link-shaped key: `resolveParent` refuses a
	// non-string outright and so does `readLinkList`, which is what fills `releaseEntry`.
	// Left coerced, `release: 2.4` counted as a membership here while the menu saw none —
	// the two-ends disagreement extension 1f forbids, reached through the VALUE's type
	// rather than through its cardinality (Codex, PR #201). Refused rather than made
	// tolerant at the other end: a bare `2.4` is a spelling Obsidian resolves and a YAML
	// number is not one, and reporting it repairs from the menu, where a silent membership
	// could not be seen at all.
	const scalar: unknown = Array.isArray(raw) ? raw[0] : raw;
	if (typeof scalar !== 'string') return UNRESOLVED;
	// `readString` trims and answers null for a blank string, so this one test covers the
	// empty value 3b names as well as the shapes no reader will guess at.
	const text = readString(scalar);
	if (text === null) return UNRESOLVED;
	if (!inPlan(item) || isMarkerType(item.typeName)) return UNRESOLVED;
	const file = app.metadataCache.getFirstLinkpathDest(linkpathFromRawValue(text), item.file.path);
	if (file === null) return UNRESOLVED;
	return releasePaths.has(file.path) ? file.path : UNRESOLVED;
}

export interface ScopeRow {
	item: BacklogItem;
	/**
	 * Depth within THIS tree, not the backlog's: depth 0 is the topmost KEPT row, which is
	 * normally a CONTEXT ancestor rather than a member. Every row an ancestor chain passes
	 * through without keeping — a marker, an excluded row — costs a level, so the tree
	 * closes up around what it does not draw.
	 */
	depth: number;
	/** True for an ancestor drawn only to keep a member in its place. */
	context: boolean;
}

export interface ReleaseScope {
	release: ReleaseRow | null;
	rows: ScopeRow[];
	members: number;
}

/**
 * The scope of one release: its members, and the ancestors that hold them in place.
 *
 * **Membership never cascades, in either direction.** An ancestor is scaffolding — not a
 * member, not counted, and marked as context so its number-free row is not read as a
 * zero. Inheriting down would put in the release work nobody named; inferring up would
 * put in it an Epic whose other children ship later.
 *
 * A context ancestor is drawn regardless of its own state: hiding it would break the
 * member's place, and it is scaffolding rather than something the reader asked to see.
 *
 * **The index is a parameter rather than derived here.** Every caller with a release
 * picked has already built one — the view needs it for the row this screen is drawn from
 * and for the unresolved memberships it reports — and deriving a second scans every
 * scannable row again to find ONE row by path. Passing it also makes the two screens agree
 * by construction: the header's figures and the member count come from the same pass that
 * drew the index behind it.
 */
export function releaseScope(
	app: App,
	model: BacklogModel,
	settings: ReleaseSettings,
	index: ReleaseIndex,
	path: string,
): ReleaseScope {
	const release = index.rows.find((row) => row.path === path) ?? null;
	if (release === null) return { release: null, rows: [], members: 0 };

	const releasePaths: ReadonlySet<string> = new Set(model.releases.map((r) => r.file.path));
	const members = new Set<string>();
	// Members plus every ancestor that holds one in place — **except the two kinds walked
	// THROUGH rather than kept.**
	//
	// Two rules meet at the first of them and both say the same thing. `Releases as their
	// own type` 4a: an excluded release "never arrives as a context row" and "appears as no
	// row anywhere" — and because this plan keeps the hand-written parent edge, a member
	// filed under a release would otherwise drag that release in as a context ancestor,
	// excluded or not. And the model's own rule: `descendantCount` scores a marker 0 and
	// traverses through it, so a marker is never the thing that holds a row in place; the
	// real ancestor above it is.
	const keep = new Set<string>();
	for (const item of scannableRows(model)) {
		if (membershipTarget(app, item, releasePaths, settings) !== path) continue;
		members.add(item.file.path);
		keep.add(item.file.path);
		for (let up = item.parent; up !== null; up = up.parent) {
			// Both skips CONTINUE the walk upward rather than stopping it — an included
			// ancestor further up is still the member's rightful place.
			//
			// A MARKER, for the two reasons above, and because a release drawn inside another
			// release's scope is nonsense.
			//
			// An `outsideFilter` ancestor, because it is not in the results.
			// `showOutsideParents` DEFAULTS TO TRUE, so an excluded Epic between a member and
			// the top is loaded as a context row and would otherwise be rendered here — and
			// extension 2a says a member whose ancestor is missing from the results is drawn
			// at the top level, not under it. It is also the register's context-row rule
			// verbatim: such a row is never a source of anything derived from the results,
			// and being somebody's scaffolding in THIS projection is exactly that.
			if (isMarkerType(up.typeName) || up.outsideFilter) continue;
			keep.add(up.file.path);
		}
	}

	const rows: ScopeRow[] = [];
	const walk = (item: BacklogItem, depth: number): void => {
		// A row that is not kept is walked THROUGH, never stopped at. A member filed under a
		// marker — the hand-written parent edge this plan deliberately keeps — has that
		// marker as an ancestor, and a marker is never kept; returning here would drop the
		// MEMBER along with it while the header went on counting it, so the scope and the
		// index would disagree about one release. That is the one defect this module exists
		// to prevent. Descending without drawing it leaves the depth alone too, so the
		// member re-roots at the level the marker occupied.
		const kept = keep.has(item.file.path);
		if (kept) rows.push({ item, depth, context: !members.has(item.file.path) });
		for (const child of item.children) walk(child, kept ? depth + 1 : depth);
	};
	// From the model's REAL roots, not its rendered ones: a focus level set on the backlog
	// view must not decide what a release's scope contains. A member whose ancestor is
	// absent from the results is an orphan, which `linkAll` makes a root of that same list,
	// so the walk reaches it at depth 0 with no branch of its own.
	for (const root of model.realRoots) walk(root, 0);

	return { release, rows, members: members.size };
}
