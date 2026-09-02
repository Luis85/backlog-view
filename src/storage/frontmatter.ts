import { App, Notice, TFile } from 'obsidian';
import { t } from '../i18n/t';
import { StatedEnds } from '../domain/bars';
import { isResourceType, mayHoldField, placementEnds, PlacementEnd, schemaEnds } from '../domain/itemTypes';
import {
	absentReading,
	CivilDate,
	FieldReading,
	hasTag,
	normalizeTag,
	ownValue,
	readDate,
	readString,
	readTags,
} from '../domain/noteFields';
import { refusesLiveMembership } from '../domain/releases';
import { BacklogSettings, isDoneValue } from '../domain/settings';
import {
	optionalKeyFor,
	OptionalField,
	resolvedDeliverableStateKey,
	resolvedTestStateKey,
} from '../domain/optionalProperties';
import { DateSpan, daysBetween, reversedSpan } from '../domain/timeline';
import { ItemWrite, TagDelta } from '../domain/writePlan';
import { wikilinkTo } from './createNote';
import { DependsOnRestore, dependsOnRestore, restoreDependsOn } from './dependsOnWrite';
import { setOwn } from './ownProperty';
import { AxisEntry, landsMembership, plannedAxis, stubKeys, touchedKeys } from './writeKeys';

/**
 * The ONLY module that writes frontmatter. Everything upstream decides what a
 * change should be (`domain/writePlan.ts`) and hands the plan here; nothing else
 * in the codebase may call `processFrontMatter` or create a note. Keeping that
 * true is what makes the write-safety rules checkable by reading one file.
 */

/** A raw frontmatter value, or its absence — undo must tell the two apart. */
export type RawValue = { present: true; value: unknown } | { present: false };

/**
 * One key's before/after, captured as a write landed. `prior` is what undo puts
 * back; `written` is the compare of the restore's compare-and-swap. Raw values,
 * not planner shapes: an aliased or unresolved parent link, a string-typed order
 * and an absent key all have to come back exactly as they were.
 */
export interface KeyRestore {
	key: string;
	prior: RawValue;
	written: RawValue;
}

/** The inverse of one applied write. Only keys the write effectively changed appear. */
export interface RestoreWrite {
	file: TFile;
	keys: KeyRestore[];
	/**
	 * Reverses the effective tag delta. Tags stay a delta rather than a snapshot —
	 * the list is shared with the user's own edits, and a delta composes with
	 * changes made between the write and the undo instead of clobbering them.
	 */
	tags?: { key: string; delta: TagDelta };
	/**
	 * Reverses the effective prerequisite change, in RAW TEXT both ways: `add` puts
	 * back the exact lines a removal took out, `remove` takes out the exact line an add
	 * put in. A delta for the tags' reason, and raw for the reader's — an entry that
	 * resolves to nothing has no other identity, and undoing its removal has to restore
	 * the text rather than a note it never named.
	 */
	dependsOn?: DependsOnRestore;
}

/** What a restore batch could not put back, for the undo notice. */
export interface RestoreOutcome {
	/** Keys whose live value no longer matched what the batch wrote; left as they are. */
	conflicts: number;
	/** Notes gone from the vault since the write; skipped whole. */
	missing: number;
}

/**
 * The dates one axis write moved between, read off the note either side of it —
 * tri-state per end, the same shape `axisReadings` already produces. A plain
 * `DateSpan` cannot tell an end the note never stated from one it stated something
 * this axis refuses to read, and that is exactly the distinction a caller announcing
 * the move needs: `placementLabel`'s lesson on the horizon axis, read onto this one.
 */
export interface DateChange {
	before: StatedEnds;
	after: StatedEnds;
}

/**
 * What a batch actually did. `changed` is what the announcement asks — a batch that
 * completed is not the same as a batch that changed something, and a screen-reader
 * user hearing about a move that did not happen is the failure this exists to prevent.
 * `dates` is the first axis write's before/after, from the values the writer itself
 * saw: the model may be a refresh behind, so the caller cannot name them.
 */
export interface WriteOutcome {
	changed: boolean;
	dates: DateChange | null;
}

/**
 * Apply writes sequentially so concurrent edits of the same file cannot race.
 * `onProgress` reports after each file so a long batch — a backfill over a whole
 * backlog is hundreds of notes — can show how far along it is. Each await yields
 * to the event loop, so the view stays interactive throughout.
 *
 * `onInverse` receives each write's inverse as it lands — incrementally, not as a
 * return value, because a batch that fails partway leaves its earlier writes
 * applied, and those are exactly the ones that still need to be undoable. A write
 * that changed nothing emits no inverse, so a no-op batch cannot cost the caller
 * the undo of the change before it.
 */
export async function applyWrites(
	app: App,
	settings: BacklogSettings,
	writes: ItemWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void,
): Promise<WriteOutcome> {
	const outcome: WriteOutcome = { changed: false, dates: null };
	let done = 0;
	for (const write of writes) {
		let inverse: RestoreWrite | null = null;
		let refused = false;
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			// The ends this note's LIVE type answers for. Everything below is narrowed by
			// them, because a key the projection never drew is not part of what a move
			// changed — a marker's stale start most of all.
			const liveType = readString(ownValue(fm, settings.typeKey));
			// **A RESOURCE is never written to, whatever the batch was planned against.**
			// `readItems` keeps one out of every projection, but that gate reads the note as
			// the MODEL was built — and a gesture in flight holds the `BacklogItem` it was
			// captured from. Retype a note to `Resource` mid-move and the plan aimed at it
			// survives, while its live shape is an ordinary item's (a resource is no marker,
			// so it answers both ends) and therefore matches what was captured. The axis
			// check below cannot see it for exactly that reason.
			//
			// Asked HERE because this is the one place the live type is readable before the
			// file is touched, and asked of EVERY write rather than the axis alone: what
			// makes a resource unwritable is the type, not which property a batch names.
			if (isResourceType(liveType)) {
				refused = true;
				return;
			}
			const ends = placementEnds(liveType, settings.iterationBars);
			const before = axisReadings(fm, settings);
			// Asked of the LIVE note before this file is touched, so a note that no longer
			// fits the plan is never half-written. It stops the batch where it stands
			// rather than undoing what came before it: the check needs the live
			// frontmatter, which is only readable inside this callback, so there is no
			// pass that could refuse every file up front without opening each of them
			// twice. Every date batch today is ONE write, so the two are the same thing —
			// and the outcome below reports what actually landed rather than claiming
			// nothing did, which is what makes the difference visible if that changes.
			if (
				refusesLiveType(settings, write, liveType) ||
				refusesLiveMembership(app, write.release, settings) ||
				refusesLiveAssignee(app, write.assignee, settings) ||
				refusesAxis(fm, settings, write, ends)
			) {
				refused = true;
				return;
			}
			// The same question, with the other answer. A stub is not a gesture in flight:
			// the backfill names hundreds of notes in one batch, so refusing it at the one
			// release in the base would abandon every note after it, and what a release may
			// not hold is DROPPED from the plan instead. Narrowed once, into a plan both
			// halves below read, so `touchedKeys` and `applyInto` cannot come to disagree
			// about the list — a key written but not captured is a change no undo can reach.
			const planned = withHoldableStubs(write, liveType, settings);
			const keys = touchedKeys(settings, planned);
			const prior = keys.map((key) => rawValueOf(fm, key));
			// `planned`, not `write`, into main's `liveType` signature: both sides are
			// needed. Dropping the narrowing would let `touchedKeys` and `applyInto`
			// disagree about the key list — a key written but not captured is a change no
			// undo can reach — and dropping `liveType` would take the live-type reading
			// out of the one place that has the note open.
			const lists = applyInto(app, fm, settings, planned, liveType);
			inverse = captureInverse(write.file, keys, prior, fm, lists);
			if (write.axis && (write.axis.start !== undefined || write.axis.target !== undefined)) {
				// Narrowed to the ends the placement HAS, on both sides. A marker keeps a
				// stale start deliberately, so an unnarrowed `before` would announce a
				// target slide as a range — "2026-07-01 to 2026-09-30" for a note the
				// timeline draws and edits as one September point. The destination is
				// already narrowed, through `placeItem`; describing the two ends of one
				// move in two different vocabularies is the mistake `placementLabel` and
				// `targetLabel` were split to stop making.
				outcome.dates ??= {
					before: narrowReadings(before, ends),
					after: narrowReadings(axisReadings(fm, settings), ends),
				};
			}
		});
		if (refused) {
			console.error('Product Backlog: refused a batch the note no longer fits', write);
			new Notice(outcome.changed ? t('gate.staleDatesPartial') : t('gate.staleDatesNone'));
			// The accumulated outcome, not a fresh `changed: false`: writes before this
			// one landed and emitted their inverses, and reporting otherwise would tell
			// the caller — and the announcement — that a change nobody can see did not
			// happen.
			return outcome;
		}
		if (inverse) {
			outcome.changed = true;
			onInverse?.(inverse);
		}
		onProgress?.(++done, writes.length);
	}
	return outcome;
}

/**
 * Apply one planned write to the live frontmatter, returning the list restores its
 * deltas earned (each absent when it changed nothing). Separate from the loop above so
 * the question "what does a write DO" is answerable in one place, and so the capture
 * that surrounds it stays readable beside it.
 */
function applyInto(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
	liveType: string | null,
): Pick<RestoreWrite, 'tags' | 'dependsOn'> {
	// The state this note is actually leaving, read BEFORE the write replaces it. The
	// model's idea of it can be a refresh behind — an external edit, or a batch still
	// landing — and the done boundary has to be judged on the truth. Through the same
	// tolerant reader the model builds `stateValue` with, or a state stored as a
	// one-item list reads as no state here and as `Done` there: two answers to one
	// question, and the boundary rule believes the wrong one.
	const leaving = settings.stateKey ? readString(ownValue(fm, settings.stateKey)) : null;
	// Which axis keys this write LANDS, decided from one snapshot taken before `applyLinks`
	// replaces the membership and before any end is written — a check inside `applyAxis`'s
	// own loop would judge the target against a start it wrote itself. Everything but the
	// release join lands every key it names; see {@link plannedAxis}.
	const axis = plannedAxis(app, fm, settings, write);
	// Read here for `plannedAxis`' own reason — before the link it judges is replaced. A
	// settled fill-only join keeps its own spelling rather than taking the canonical one.
	const links = landsMembership(app, fm, settings, write) ? write : { ...write, release: undefined };
	applyHierarchy(app, fm, settings, write);
	applyLinks(app, fm, settings, links);
	// The stateKey may be unset (progress tracking off) — never write to an empty key.
	if (write.removeStateKey && settings.stateKey) delete fm[settings.stateKey];
	else if (write.state !== undefined && settings.stateKey) setOwn(fm, settings.stateKey, write.state);
	applySecondaryStates(fm, settings, write);
	applyStamps(fm, settings, write, leaving);
	applyAxis(fm, axis);
	applyLabels(fm, settings, write);
	// Stubs last, and only where the LIVE note still has no such key. Presence is asked
	// here rather than trusted from the plan for the reason the tag delta and the start
	// stamp are: the row that planned this can be a refresh behind the note, and a value
	// written since — by hand, by another view, by a write earlier in this same batch —
	// would be blanked by a stub that believed the plan.
	//
	// A start/target stub is narrowed the SAME question again, against the LIVE type
	// rather than the model's: `schemaEnds` is what `missingEnd` already asks the plan,
	// and a note retyped to a `Milestone` mid-batch must not gain the start key its note
	// never carries just because a stale row still asked for it.
	const liveEnds = schemaEnds(liveType);
	const stubs = write.stubs?.filter((field) => (field !== 'start' && field !== 'target') || liveEnds.includes(field));
	for (const key of stubKeys(settings, stubs)) {
		if (!rawValueOf(fm, key).present) setOwn(fm, key, '');
	}
	const applied =
		write.tags !== undefined && settings.tagsKey ? applyTagDelta(fm, settings.tagsKey, write.tags) : null;
	// Each stored delta is the one that UNDOES what was applied.
	return {
		tags: applied ? { key: settings.tagsKey, delta: { add: applied.remove, remove: applied.add } } : undefined,
		dependsOn: dependsOnRestore(app, fm, settings, write),
	};
}

/** The three hierarchy properties: the parent link (or its removal), the rank, the type. */
function applyHierarchy(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	if (write.removeParentKey) {
		delete fm[settings.parentKey];
	} else if (write.parent !== undefined) {
		if (write.parent !== null) setOwn(fm, settings.parentKey, wikilinkTo(app, write.parent, write.file.path));
		// In folder mode a deleted key would just re-infer the folder parent;
		// an explicitly empty value pins the item to the top level instead.
		else if (settings.folderHierarchy) setOwn(fm, settings.parentKey, '');
		else delete fm[settings.parentKey];
	}
	if (write.order !== undefined) setOwn(fm, settings.orderKey, write.order);
	if (write.typeName !== undefined) setOwn(fm, settings.typeKey, write.typeName);
}

/**
 * The LINK properties: the iteration, the release, the assignee. Each is one note written
 * as a wikilink spelt from the editing note's own path, an unconfigured key dropped, and
 * null deleting the key rather than blanking it.
 *
 * `applyLabels`' shape one field-kind over, and extracted for `applyLabels`' own reason:
 * these were two copies of one rule, so a third property wanting it is a row in this list
 * rather than a third restatement — the assignee is exactly that third row, joining on
 * 2026-08-28 once who an item is assigned to became a link to a `Resource` note rather
 * than a typed string. The plain LABEL properties stay in `applyLabels` because a label is
 * a string the reader picked and a link is a note — `wikilinkTo` is exactly the
 * difference, and a helper general enough to cover both would carry the link spelling past
 * the properties that must not have it.
 */
function applyLinks(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	const links: [TFile | null | undefined, string][] = [
		[write.iteration, settings.iterationKey],
		[write.release, settings.releaseKey],
		[write.assignee, settings.assigneeKey],
	];
	for (const [target, key] of links) {
		if (target === undefined || !key) continue;
		if (target === null) delete fm[key];
		else setOwn(fm, key, wikilinkTo(app, target, write.file.path));
	}
}

/**
 * The Deliverable and test workflows' own state keys — the requirements state key's rule
 * twice, pulled out of `applyInto` to keep it under the complexity cap. Both go through
 * the RESOLVED key, never the raw `deliverableStateKey`/`testStateKey`: sharing the
 * requirements property by fallback is the default configuration, and the reader uses the
 * same resolution — so a card that looks movable through it (`model.ts`'s own fallback)
 * actually lands bytes somewhere rather than resolving to the empty key `optionalKeyFor`
 * would give here.
 */
function applySecondaryStates(fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	const deliverableStateKey = resolvedDeliverableStateKey(settings);
	if (write.removeDeliverableStateKey && deliverableStateKey) delete fm[deliverableStateKey];
	else if (write.deliverableState !== undefined && deliverableStateKey) setOwn(fm, deliverableStateKey, write.deliverableState);
	const testStateKey = resolvedTestStateKey(settings);
	if (write.removeTestStateKey && testStateKey) delete fm[testStateKey];
	else if (write.testState !== undefined && testStateKey) setOwn(fm, testStateKey, write.testState);
}

/**
 * The roadmap's placement keys, by the same two rules the hierarchy and state writes
 * follow: never an unconfigured key, and a null REMOVES rather than blanks —
 * unscheduled is a state a note returns to, not a pair of empty strings.
 *
 * It takes the entries rather than the write, because WHICH of them land is decided
 * before the first one is written (`plannedAxis`): the fill-only rule the release join
 * carries has to read both ends of the live note, and this loop writes one of them.
 */
function applyAxis(fm: Record<string, unknown>, entries: AxisEntry[]): void {
	for (const { field, key, value } of entries) {
		if (value === null) {
			// A removal for a key that is not there changes nothing, and `captureInverse`
			// already reports that by capturing no inverse — but deleting a missing key
			// is also not a write, so this is the same statement made once.
			delete fm[key];
			continue;
		}
		// A HORIZON is a label, not a date, and the two rules below would both misread
		// one. `readDate` accepts a trailing group, so `2026-08-01 Planning` parses as a
		// date: picking `2026-08-01 Review` over it would compare equal and be skipped as
		// a re-pick, and a merge would carry ` Planning` onto whatever replaced it. The
		// axis fields share a writer, not a meaning.
		if (field === 'horizon') {
			setOwn(fm, key, value);
			continue;
		}
		const live = readDate(ownValue(fm, key));
		// Civil-date equality, not text equality: re-confirming `2026-8-1` must not
		// rewrite it as `2026-08-01`. The spelling on disk is the user's, and tidying it
		// is a write nobody asked for. This is the question the planner used to answer
		// from the model, where the value could be a refresh behind.
		if (!live.invalid && live.value !== null && sameCivil(live.value, readDate(value).value)) continue;
		setOwn(fm, key, mergeDate(ownValue(fm, key), value));
	}
}

/**
 * The plain LABEL properties — the risk level, the priority, and what an iteration is FOR
 * — under this module's two standing rules: never a key no property names, and a null
 * REMOVES rather than blanks, because a note nobody has judged and an iteration nobody
 * has stated a goal for carry no such key at all.
 *
 * One loop rather than a statement per property, which is the trade-off the root
 * `CLAUDE.md` said to re-examine at the fourth optional property and this is it: a label
 * needs none of the axis's civil-date equality or datetime merge, so the second one that
 * wants exactly these two lines is where a shared statement starts costing less than
 * another copy of them. The state key still guards inline and the axis keys still go
 * through `axisEntries` — this covers what is genuinely the same. The assignee LEFT this
 * list on 2026-08-28: it became a link to a `Resource` note rather than a typed string, so
 * it moved to `applyLinks`, which spells a note as a wikilink the way the iteration and the
 * release already do — a label is a string the reader picked, and a link is a note.
 */
function applyLabels(fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	const labels: [string | null | undefined, string][] = [
		[write.risk, settings.riskKey],
		[write.priority, settings.priorityKey],
		[write.iterationGoal, settings.iterationGoalKey],
	];
	for (const [value, key] of labels) {
		if (value === undefined || !key) continue;
		if (value === null) delete fm[key];
		else setOwn(fm, key, value);
	}
}

/**
 * The date stamps of one write. Never a write of their own — they mutate the same
 * frontmatter the state write just did, inside the same `processFrontMatter` call, so
 * the batch that changed the state is the batch an undo takes back.
 *
 * A stamp key is only ever written when the user named that property, exactly as the
 * state key is: every part of stamping is opt-in.
 */
function applyStamps(
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
	leaving: string | null,
): void {
	// A start records a TRANSITION, so one has to have happened. Both halves are asked
	// of the LIVE value rather than the planner's snapshot, because the row that planned
	// this can be a refresh behind the note: it must actually MOVE the note to another
	// state — a stale row can propose the state the note already holds, and stamping
	// that would date a redundant selection rather than the moment work began, and
	// spend the undo slot doing it — and the property must still be empty, so the
	// earliest start survives rework. Empty is asked through `ownValue`, never `fm[key]`:
	// a stamp key named `constructor` or `valueOf` resolves to an inherited FUNCTION on a
	// note that lacks it, which is truthy, so the blank test would read it as already
	// stamped and decline the stamp forever.
	if (
		write.startedDate !== undefined &&
		settings.startedDateKey &&
		movesState(leaving, write.state) &&
		isBlank(ownValue(fm, settings.startedDateKey))
	) {
		setOwn(fm, settings.startedDateKey, write.startedDate);
	}
	if (write.finish === undefined || !settings.finishedDateKey) return;
	// Only CROSSING the boundary writes, and the crossing is measured from the state
	// the NOTE was in. Done to done is a re-labelling — Done becoming Dropped — not a
	// new finish, and moving the date forward would rewrite the item's history to say
	// the work took longer than it did. Leaving done clears it, so a reopened item
	// never claims a finish it no longer has.
	const wasDone = isDoneValue(settings, leaving);
	if (write.finish.toDone === wasDone) return;
	if (write.finish.toDone) setOwn(fm, settings.finishedDateKey, write.finish.date);
	else delete fm[settings.finishedDateKey];
}

/**
 * Whether this write actually moves the note to a different state, by the same
 * case-insensitive match the planner and the board's columns use. A write carrying no
 * state moves nothing.
 */
function movesState(leaving: string | null, state: string | undefined): boolean {
	if (state === undefined) return false;
	return leaving === null || leaving.toLowerCase() !== state.toLowerCase();
}

/**
 * Whether a frontmatter value counts as "no date yet". Absent, null and empty text —
 * and a LIST holding nothing but those, because Obsidian writes an emptied list
 * property as `[]` and the date readers already call that absence. A stricter test
 * here would read `started: []` as a date already recorded and decline the stamp
 * forever, which is the write-once rule protecting a value that is not there.
 */
function isBlank(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === 'string') return value.trim() === '';
	if (Array.isArray(value)) return value.every((entry) => isBlank(entry));
	return false;
}

/**
 * The requested CIVIL date, wearing whatever time and offset the note currently holds.
 *
 * The merge happens here rather than in the plan because the live value is the only
 * one that can be trusted: the row that planned this can be a refresh behind the note,
 * and a suffix taken from the model would overwrite a time somebody changed in
 * between. [[Move and resize a bar]] extension 1e is the requirement — a drag re-plans
 * a date, it does not re-format a value.
 *
 * A value the reader REFUSES contributes no shape: `soon` is not a date with a time
 * attached, and carrying its text forward would write `2026-08-05soon`. Only the
 * suffix of a value that actually parses as a date rides along, which is exactly the
 * `readDate` regex's own trailing group.
 */
function mergeDate(live: unknown, requested: string): unknown {
	// The CONTAINER is part of the shape. `readDate` reads the first entry of ANY
	// non-empty list, so `[2026-08-10T09:00+02:00, …]` is an accepted datetime — and a
	// merge that only understood strings would answer it with a bare scalar, dropping
	// the time, the list and every entry after the first in one move. Unwrap the way the
	// reader unwraps: replace the entry it read, leave the rest exactly as they are.
	if (Array.isArray(live) && live.length > 0) {
		const rest = live.slice(1) as unknown[];
		return [mergeDate(live[0] as unknown, requested), ...rest];
	}
	// ASKED OF `readDate`, not of the pattern alone. A regex matching the shape is not
	// the same question as the model's reader accepting the value: `2026-02-30T09:00+02:00`
	// is datetime-shaped and refused (February has no thirtieth), so a pattern-only test
	// would carry its suffix onto the correction while this paragraph claimed refused
	// values contribute no shape. Borrowing the model's own reader is this codebase's
	// rule for every live read anyway — a stricter or looser second reader is how one
	// question came to have two answers.
	if (typeof live !== 'string' || readDate(live).value === null) return requested;
	const match = /^\d{4}-\d{1,2}-\d{1,2}([Tt\s].*)$/.exec(live.trim());
	return match ? `${requested}${match[1]}` : requested;
}

function sameCivil(a: CivilDate, b: CivilDate | null): boolean {
	return b !== null && a.year === b.year && a.month === b.month && a.day === b.day;
}

/** The pair the note currently states, read the same tolerant way the model reads it. */
function axisReadings(fm: Record<string, unknown>, settings: BacklogSettings): StatedEnds {
	const read = (field: PlacementEnd): FieldReading<CivilDate> => {
		const key = optionalKeyFor(settings, field);
		return key === '' ? absentReading() : readDate(ownValue(fm, key));
	};
	return { start: read('start'), target: read('target') };
}

/**
 * The same readings with the ends this placement does not answer for dropped to
 * absence. Tri-state in, tri-state out — `DateChange` needs the invalid flag to
 * survive this narrowing exactly as much as the values do, or a marker's ignored
 * start would carry an unrelated refusal into an announcement that never reads it.
 */
function narrowReadings(readings: StatedEnds, ends: PlacementEnd[]): StatedEnds {
	return {
		start: ends.includes('start') ? readings.start : absentReading(),
		target: ends.includes('target') ? readings.target : absentReading(),
	};
}

/**
 * Whether this write carries a planning key the note's LIVE type may not hold — the
 * TOCTOU refusal, asked of the type the note states right now rather than of the type the
 * plan was made against.
 *
 * One question over every such key, because it was two answers and the second had a hole
 * in it: the horizon's live-type check lived inside {@link refusesAxis}, which returns at
 * its first clause for a write carrying no `axis` at all, so the iteration assignment
 * (`iteration`, and the sprint's dates when it maps any) walked straight past it onto a
 * note somebody had retyped to `Release`. `canSetIteration` then refuses to offer the
 * removal, so the key could not be taken off again through any control the view draws.
 * The iteration NOTE's own goal is the same shape reached through the other field:
 * `saveIteration` re-reads the model rather than the note, which is authorization at plan
 * time — exactly what this function exists to stop trusting.
 *
 * The release membership is on that list for the same reason and not by being near it:
 * `canSetRelease` refuses a marker and a catalog note, so a membership landed on one is
 * offered by no control either, while `membershipTarget` (`domain/releases.ts`) goes on
 * reporting the note as an unresolved membership for as long as it sits there. This
 * function holds a type NAME and no item, so `inPlan` is not a question it can ask: the
 * catalog TYPES are refused inside `mayHoldField`, and the one question a name cannot
 * reach at all — what the TARGET is now — is `refusesLiveMembership`
 * (`domain/releases.ts`), called beside this one at the same boundary. All were review
 * findings on one branch (Codex, PR #201). The carrier's LADDER is deliberately not asked
 * at this boundary: it is a model decision the vault cannot answer, see that function.
 *
 * The whole batch is refused, loudly, exactly as a stale date batch is — this is a
 * gesture the user made against a note that is no longer the note they made it against.
 * `mayHoldField` is the rule; what each door does about a refusal is the door's own.
 *
 * `undoLast` reaches none of this: a replay goes through `applyRestores`, which restores
 * the RAW captured keys and asks nothing here, so a legitimate write made before a retype
 * can still be taken back.
 */
function refusesLiveType(settings: BacklogSettings, write: ItemWrite, liveType: string | null): boolean {
	// A REMOVAL is exempt, here spelled as "states a value": `null` is how every one of
	// these keys is taken off a note, and a write that only takes a key off cannot put one
	// on a type that may not hold it. The point of this guard is that the horizon and the
	// sprint link, once on a marker, are unclearable — no control the view draws offers to
	// remove them — so a guard that also refused the removal would stand against its own
	// reason. It costs nothing to allow: `applyInto` deletes, and a key that is not there
	// is deleted no differently.
	const stated = (value: unknown): boolean => value !== undefined && value !== null;
	const carried: [OptionalField, unknown][] = [
		['horizon', write.axis?.horizon],
		['start', write.axis?.start],
		['target', write.axis?.target],
		['iteration', write.iteration],
		['iterationGoal', write.iterationGoal],
		['release', write.release],
	];
	return carried.some(([field, value]) => stated(value) && !mayHoldField(liveType, field, settings));
}

/**
 * Whether an assignee write names a TARGET the vault no longer calls a `Resource` — the
 * inverse question from {@link refusesLiveType} rather than a restatement of it: that one
 * refuses a write TO a note that is a `Resource`; this refuses a write NAMING a note that
 * is no longer one. Neither substitutes for the other, and a plan can fail either
 * independently — the carrier retyped INTO a resource, or the target retyped OUT of one.
 *
 * Same shape and the same placement as {@link refusesLiveMembership} (`domain/releases.ts`),
 * called beside it at this boundary for the same reason: a plan carries the `TFile` its
 * picker was built from, and nothing between the pick and this write asks what that note
 * is now. Retype a `Resource` between the menu rendering and the write landing and the
 * link lands naming an ordinary note — which then reads as broken (`resourceLabelsOf`
 * cannot find it in the roster) and the card shelves. A REMOVAL asks nothing: `null` is
 * how the key comes off, and there is no target to be wrong about.
 *
 * **No cache is NO ANSWER, and must not be read as the wrong one.** Obsidian fills the
 * metadata cache after `vault.create` resolves, so a note this plugin has only just
 * written has no cache entry for a window of its own — and `New resource...` runs exactly
 * there: `writeResource` (`view/interactions/resourceNotes.ts`) hands the fresh `TFile`
 * straight to `chooseAssignee`. Fold that window into `!isResourceType(null)` and the one
 * flow this check was never about — create a resource and assign it — creates the note and
 * then refuses to link it. So the question is only ever asked of a cache that EXISTS: a
 * note retyped away still has one (a type REMOVED leaves the entry, with no `type` key in
 * it), which is the case this guard is for. `FakeVault.create` indexes synchronously, so
 * nothing in the suite meets this window by accident — `unindex` is how a test asks for
 * it (Codex review, PR #207).
 *
 * **A DELETED target has no cache either, and must not ride in on that.** The two are one
 * state to `getFileCache` and two states to the vault, so the vault is what separates
 * them — identity rather than existence, the same test `applyRestores` makes below: a path
 * deleted and taken again by a different note answers "still there" to a bare null check
 * while being a different file. A link to a note that is gone resolves to nothing, which
 * is the one value this whole flow must not write (Codex review, PR #207, second round).
 *
 * **Exported for `absenceNotes.ts`, which asks the identical question of the identical
 * thing.** An absence's resource is written to `settings.assigneeKey` as a link, exactly
 * as an item's assignee is, so it is the same target retyped out of the same type — one
 * guard rather than a second reader that would have to be kept in step with the two cache
 * rules above. What the absence writers do NOT share is this file's batch, gate or undo
 * slot; importing a predicate is not going through `applyWrites`.
 */
export function refusesLiveAssignee(app: App, target: TFile | null | undefined, settings: BacklogSettings): boolean {
	if (!target) return false;
	const cache = app.metadataCache.getFileCache(target);
	if (cache === null) return app.vault.getAbstractFileByPath(target.path) !== target;
	return !isResourceType(readString(ownValue(cache.frontmatter, settings.typeKey)));
}

/**
 * The same plan with the stubs this note's LIVE type may not hold dropped — the ✨
 * backfill's half of {@link refusesLiveType}'s question, and the reason it is not that
 * function: a stub is an empty key the reader is invited to fill, not a placement, so
 * refusing the batch over one would abandon every note after it for a key that carries no
 * decision. `missingKeyStubs` (`domain/writePlan.ts`) already declines to plan them;
 * authorization at plan time is not authorization at write time, and a retype between the
 * plan and this callback is exactly the window that guard cannot see.
 *
 * Returns the write itself where nothing is dropped, so the ordinary batch allocates
 * nothing and the two readers below are literally handed one object.
 */
function withHoldableStubs(write: ItemWrite, liveType: string | null, settings: BacklogSettings): ItemWrite {
	if (!write.stubs) return write;
	const stubs = write.stubs.filter((field) => mayHoldField(liveType, field, settings));
	return stubs.length === write.stubs.length ? write : { ...write, stubs };
}

/**
 * Why a date batch may not land on this note, asked of the LIVE frontmatter.
 *
 * Two questions, both about the note having moved under the plan:
 *
 * - the SHAPE. `axisEntries` applies every field the batch carries, so an external
 *   edit that turned an ordinary item into a marker would let a stale two-ended plan
 *   write the start that type may not touch — the narrowing kept everywhere else and
 *   lost at the last step.
 * - the PAIR. "No gesture may write a reversed span" is a guarantee about what lands
 *   on disk, so the effective pair is the requested end plus the live other one. Asked
 *   only where the placement HAS a pair: a marker's start is ignored and preserved, so
 *   a stale one later than the target is not a conflict, it is a value the projection
 *   never drew.
 * - the BASE, for a relative gesture. A slide means "one day further than this", and
 *   the plan already turned that into an absolute date using what the render showed. If
 *   the note moved meanwhile, that absolute date walks the other edit backwards, so
 *   every baseline the batch states is compared against the live value and any
 *   disagreement refuses the whole batch. Refused rather than rebased: the preview is
 *   the contract and release writes the dates it showed, so a rebased date is one the
 *   user was never shown.
 */
function refusesAxis(
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
	live: PlacementEnd[],
): boolean {
	const axis = write.axis;
	if (!axis) return false;
	if (axis.ends === undefined) return false;
	if (live.length !== axis.ends.length || live.some((end) => !axis.ends?.includes(end))) return true;
	const readings = axisReadings(fm, settings);
	if (axis.from && staleBase(axis.from, readings)) return true;
	if (live.length < 2) return false;
	const current: DateSpan = { start: readings.start.value, target: readings.target.value };
	const requested = (field: PlacementEnd): CivilDate | null => {
		const value = axis[field];
		if (value === undefined) return current[field];
		return value === null ? null : readDate(value).value;
	};
	return reversedSpan(requested('start'), requested('target'));
}

/**
 * True where any baseline the gesture stated is not what the note now holds. Compared as
 * civil DATES, like every other comparison here: a note respelled `2026-8-1` while a drag
 * was live has not moved, and refusing over a spelling would make a legal gesture fail
 * for a reason nobody could see. `null` means the gesture measured against an ABSENT end
 * — an open-end grip's own end, which it is there to fill — so absence is the expectation
 * and a value appearing there is exactly the conflict this catches.
 *
 * Asked of the READINGS, not of a span. Absent and unreadable are the distinction this
 * whole codebase reads dates through, and collapsing them here would let `soon`, typed
 * into an empty end while the drag was live, satisfy an expectation of nothing and be
 * overwritten by a gesture that was never shown it. An end that cannot be read has not
 * stayed empty; it has become something the reader refuses, which is a change.
 */
function staleBase(from: Partial<Record<PlacementEnd, string | null>>, live: StatedEnds): boolean {
	return (['start', 'target'] as const).some((end) => {
		const expected = from[end];
		if (expected === undefined) return false;
		const reading = live[end];
		if (expected === null) return reading.invalid || reading.value !== null;
		const parsed = readDate(expected).value;
		return reading.value === null || parsed === null || daysBetween(parsed, reading.value) !== 0;
	});
}

/**
 * The inverse of the write that just mutated `fm`: the keys whose value it
 * effectively changed, prior and written both. Null when nothing changed — a
 * state re-set to itself must not consume the caller's single undo slot.
 *
 * Exported for `storage/propertyWrite.ts`'s reuse: the identical before/after key
 * comparison used to be a parallel copy there, caught as a clone by `npm run analyze`.
 */
export function captureInverse(
	file: TFile,
	keys: string[],
	before: RawValue[],
	fm: Record<string, unknown>,
	lists: Pick<RestoreWrite, 'tags' | 'dependsOn'>,
): RestoreWrite | null {
	const changed: KeyRestore[] = [];
	keys.forEach((key, i) => {
		const written = rawValueOf(fm, key);
		if (!sameRaw(before[i], written)) changed.push({ key, prior: before[i], written });
	});
	if (changed.length === 0 && !lists.tags && !lists.dependsOn) return null;
	return { file, keys: changed, tags: lists.tags, dependsOn: lists.dependsOn };
}

/**
 * Replay captured inverses. Restoring is a compare-and-swap, never a blind write:
 * a key goes back to its prior value only where the note still holds what the
 * batch wrote — undo is not the only editor, and a key hand-edited since is newer
 * than the undo. A note deleted since the write is skipped whole; the rest of the
 * batch still restores. `onInverse` records each restore's own inverse the same
 * way `applyWrites` does, which is what makes undoing an undo redo.
 */
export async function applyRestores(
	app: App,
	restores: RestoreWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void,
): Promise<RestoreOutcome> {
	const outcome: RestoreOutcome = { conflicts: 0, missing: 0 };
	let done = 0;
	for (const restore of restores) {
		// The same NOTE, not merely the same path: a note deleted and recreated at
		// this path is a different file, and restoring into it would write history
		// that was never its own. Obsidian keeps one TFile per file, so instance
		// identity is the test — a path-only check would pass the replacement.
		if (app.vault.getAbstractFileByPath(restore.file.path) !== restore.file) {
			outcome.missing++;
			onProgress?.(++done, restores.length);
			continue;
		}
		let inverse: RestoreWrite | null = null;
		await app.fileManager.processFrontMatter(restore.file, (fm: Record<string, unknown>) => {
			inverse = restoreInto(app, fm, restore, outcome);
		});
		if (inverse) onInverse?.(inverse);
		onProgress?.(++done, restores.length);
	}
	return outcome;
}

/** Apply one file's restore into its live frontmatter; returns the redo inverse. */
function restoreInto(
	app: App,
	fm: Record<string, unknown>,
	restore: RestoreWrite,
	outcome: RestoreOutcome,
): RestoreWrite | null {
	const changed: KeyRestore[] = [];
	for (const entry of restore.keys) {
		if (!sameRaw(rawValueOf(fm, entry.key), entry.written)) {
			outcome.conflicts++;
			continue;
		}
		if (entry.prior.present) setOwn(fm, entry.key, entry.prior.value);
		else delete fm[entry.key];
		changed.push({ key: entry.key, prior: entry.written, written: entry.prior });
	}
	let tags: RestoreWrite['tags'];
	if (restore.tags) {
		const applied = applyTagDelta(fm, restore.tags.key, restore.tags.delta);
		if (applied) tags = { key: restore.tags.key, delta: { add: applied.remove, remove: applied.add } };
	}
	const dependsOn = restore.dependsOn
		? (restoreDependsOn(app, restore.file, fm, restore.dependsOn) ?? undefined)
		: undefined;
	if (changed.length === 0 && !tags && !dependsOn) return null;
	return { file: restore.file, keys: changed, tags, dependsOn };
}

export function rawValueOf(fm: Record<string, unknown>, key: string): RawValue {
	// Own properties only: 'toString' is a legal frontmatter name on a note that
	// lacks it, and `in` would report the inherited function as a prior value.
	return Object.prototype.hasOwnProperty.call(fm, key)
		? { present: true, value: fm[key] }
		: { present: false };
}

/** Equality on raw frontmatter values — plain YAML data, so structural compare is sound.
 *  Exported for `propertyWrite.ts`'s `stillExpected`, which asks this same question of a
 *  set's `expects` against the live note — the compare-and-swap `applyRestores` already
 *  makes, asked of a forward write instead of a replay. */
export function sameRaw(a: RawValue, b: RawValue): boolean {
	if (!a.present || !b.present) return a.present === b.present;
	return a.value === b.value || JSON.stringify(a.value) === JSON.stringify(b.value);
}

/**
 * Add and remove tags on whatever the note holds right now — inside processFrontMatter,
 * so the list a click was rendered from cannot overwrite a change made since. Always
 * written back as a YAML list (the shape Obsidian's own property editor writes), and
 * the key goes when the last tag does rather than leaving an empty array behind.
 * Returns the delta that actually changed the note — adds already present and removes
 * already absent drop out — or null when nothing did and the note was left alone.
 */
function applyTagDelta(fm: Record<string, unknown>, key: string, delta: TagDelta): TagDelta | null {
	const current = readTags(ownValue(fm, key));
	const removals = delta.remove ?? [];
	const removed = current.filter((tag) => hasTag(removals, tag));
	const next = current.filter((tag) => !hasTag(removals, tag));
	// Normalizing here rather than at the call site is what makes "every tag on disk is
	// one Obsidian will read" true of the write path itself, not of one caller.
	const added: string[] = [];
	for (const tag of (delta.add ?? []).map(normalizeTag)) {
		if (tag.length > 0 && !hasTag(next, tag)) {
			next.push(tag);
			added.push(tag);
		}
	}
	// A delta that changes nothing leaves the note alone, rather than rewriting the
	// value into a different shape for no reason.
	if (added.length === 0 && removed.length === 0) return null;
	if (next.length > 0) setOwn(fm, key, next);
	else delete fm[key];
	return { add: added, remove: removed };
}
