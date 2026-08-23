import { Menu } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { inCatalog, isIterationType, isMarkerType, mayHoldField } from '../../domain/itemTypes';
import { BacklogItem, inPlan } from '../../domain/model';
import { sameValue } from '../../domain/noteFields';
import { assignableLanes } from '../../domain/roadmap';
import { mergedValues } from '../../domain/settings';
import { resolveSettings } from '../../domain/settingsResolve';
import {
	computeAssigneeWrites,
	computeIterationWrites,
	computePriorityWrites,
	computeReleaseWrites,
	computeRiskWrites,
	ItemWrite,
} from '../../domain/writePlan';
import { ValuePromptModal } from '../../ui/prompts';
import { rowVocabulary } from '../projection';

/**
 * What the row offers for the three LABEL properties — the risk level, the priority, and
 * who the item is assigned to. Each is one plain value chosen from a list, set from a
 * submenu whose foot clears the key, so they sit together rather than beside the state and
 * placement actions in `menu.ts`, which is what the ROW is offered rather than what a
 * label means.
 *
 * `Set iteration` is at the foot of this file and is the third of that shape without being
 * a label at all: its value is a NOTE, so its entries carry a derived name and its refusals
 * are about what an iteration MEANS rather than about a key being configured. What it
 * shares — a list, one checkmark asked of the plan, a foot that removes the key — is why it
 * is here and not in `menu.ts`; what it does not share is why it is not `addLabelItems`.
 *
 * Where they differ is the only interesting thing about them, and it is the list: risk's
 * and priority's vocabularies are DECLARED and nothing else, while the assignee's is a
 * union of everything that can name a person — an optional roster, the names the results
 * carry, the rows its own axis draws — and is extended by typing on top of all three. That
 * difference is stated in `declaredChoices` and `assigneeChoices` and nowhere else; the
 * writes, the checkmarks and the clear entries are the same two rules for all three.
 */

/**
 * What Set risk and Set priority offer: the DECLARED levels, plus the item's own value
 * when that list does not name it, so the current one can always render checked.
 *
 * Declared alone, deliberately — not the horizon's declared ∪ observed union. That union
 * exists because an undeclared horizon is a bucket a drag can already drop into, so a
 * menu offering less than the roadmap could reach would be the one input that goes quiet.
 * Neither ladder feeds a projection, so neither has a second surface to fall short of, and
 * an unexpected value on one note is not a vocabulary this base recommends to the rest.
 *
 * Takes the list and the value rather than the host and the item, which is what lets the
 * two ladders share it: the rule is about a vocabulary and a current value, and naming the
 * item would have made it about risk with priority as a copy.
 */
function declaredChoices(values: string[], current: string | null): string[] {
	// The empty key the ✨ backfill leaves behind adds no nameless entry here, and that
	// is `readString`'s doing rather than this line's: it answers null for a blank, so
	// the value is a level or nothing and never the empty string. Guarding for `''`
	// beside this would be a second, unreachable statement of a rule the reader already
	// keeps — the shape `stateChoices` has, for the same reason.
	if (current === null || values.some((v) => sameValue(v, current))) return values;
	return [...values, current];
}

/**
 * What Set assignee offers: the DRAWN rows where its own axis is on screen, then the
 * DECLARED roster, then every name the RESULTS carry, then the item's own when nothing
 * else names it — three sources and one list, the horizon menu's union with one more
 * source in front of it.
 *
 * **The roster is optional and is offered wherever it is named**, which is the difference
 * between this property and the two beside it. Risk offers its declared list and nothing
 * observed; the assignee offered everything observed and nothing declared, and that was
 * right only while nobody could declare who exists. `resourceNames` arrived with the
 * resources axis ([[Showing a resources axis on the roadmap]]) and until 2026-08-14 it
 * reached this menu on that axis alone, through the drawn rows — so a reader who had
 * just typed a team into the view options was offered them on the roadmap and not in the
 * tree, which reads as the setting not working. Naming a resource is naming a resource
 * wherever the row menu opens.
 *
 * The DRAWN rows still lead where the axis draws them — `horizonChoices`' rule for its
 * buckets, and the board's Set state for its columns — and they are still not redundant
 * with the roster: a row minted by an observed name or by a logged absence is a target a
 * drag can reach and nothing declares. Everything else follows it, so what is reachable
 * never depends on what is on screen.
 *
 * A name none of the three carries is still reachable through **New assignee...** below,
 * and that is what keeps an empty vocabulary from being an empty menu — the reason this
 * feature needs only a key named, where risk needs a key and a list.
 */
function assigneeChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	// Through `rowVocabulary` like the state, horizon and tag menus, and for their reason:
	// a vocabulary is scoped to the population of the projection that offers it. Read off
	// the model directly — which is what this did until review — a name only a test carries
	// is offered on every plan row, and a catalog row cannot reuse a name observed on
	// another test. Per ROW rather than per projection, because both directions of a
	// projection-wide answer are wrong: see `rowVocabulary`'s own comment.
	//
	// The DECLARED roster is deliberately NOT scoped that way and needs no equivalent: it
	// is one statement the view options make about this base, not a fact gathered off a
	// population, so there is no other projection's names for it to leak.
	const observed = host.model ? rowVocabulary(host.model, item).observedAssignees : [];
	// `assignableLanes`, not the lanes: the milestones' row is drawn on this axis and is
	// nobody, so offering it would assign ordinary work to a synthetic row. Shared with the
	// Alt+arrow ladder, which offered it too.
	const drawn = onResourceAxis(host) ? assignableLanes(host.roadmap?.roadmap).map((lane) => lane.name) : [];
	const values = mergedValues(drawn, host.settings.resourceNames, observed);
	const current = item.assigneeValue;
	if (current === null || values.some((v) => sameValue(v, current))) return values;
	return [...values, current];
}

/**
 * Whether the frame on screen is the one whose ROWS this property draws. Asked twice —
 * for what the menu offers, and for where a pick goes — and stated once, because a menu
 * offering the drawn rows while its picks bypassed the move would be exactly the
 * disagreement routing the two together exists to prevent.
 */
function onResourceAxis(host: BacklogViewHost): boolean {
	return host.projection === 'roadmap' && host.roadmap?.roadmap.axis === 'resources';
}

/**
 * What picking a name DOES. On the resources axis it takes the DRAG's own path, so a pick
 * and a drop onto the same row are one write, one gate and — the part only this path can
 * supply — one announcement, said once by `performResourceMove` rather than by each input
 * separately. Elsewhere there is no frame to announce into and the planned write goes
 * straight through the gate. `chooseHorizon` splits on the roadmap for this reason and
 * `chooseState` on the board.
 */
async function chooseAssignee(host: BacklogViewHost, item: BacklogItem, value: string | null): Promise<unknown> {
	// On-axis the move declares it, so this branch does not — once per path, never twice.
	if (onResourceAxis(host)) return host.performResourceMove(item, value);
	const outcome = await host.applySafely(computeAssigneeWrites(item, value));
	// After the write landed, `performResourceMove`'s own order: a pick the gate refused
	// must not amend the `.base` behind the refusal, and a no-op re-pick declares nobody.
	if (outcome?.changed) declareResource(host, value);
	return outcome;
}

/**
 * Put a name the reader has just ASSIGNED onto the declared roster, where it is not there
 * already. Naming somebody through this view is naming them, so the row they get is a
 * declared row rather than a stray one carrying "not one of the declared resources" — a
 * hint that is right about a name the view options have never seen and merely noise about
 * one the reader typed in a moment ago.
 *
 * **A write to the `.base`, and the second in this plugin that is a side effect of an
 * ordinary action** — `runInit` binds properties, and `createBacklogItem`'s prompt
 * persists the home folder. The same argument holds for all three: the option exists to be
 * filled in, and asking the reader to go and fill it in with a value they have already
 * given is a second statement of one decision. It goes at the END, so the roster keeps
 * declared ORDER as an order the reader built rather than one this function sorted.
 *
 * Guarded four ways, and each guard is a case that reaches here: `null` is a REMOVAL and
 * declares nobody; a name the roster already carries writes nothing, case-insensitively
 * through `sameValue` like every other comparison of these values; an unconfigured
 * assignee key means the property this roster is about is not in use, where writing a
 * roster would configure half a feature nobody asked for; and a name holding the list
 * SEPARATOR is refused, because the roster round-trips through one comma-separated
 * option — `resolveSettings` splits it back on commas, so declaring "Doe, Jane" would
 * hand the next resolve two entries nobody is called. The note still takes such a name
 * exactly as typed; only the roster declines it.
 *
 * Both callers run this AFTER their write lands, never before it — the ordering
 * `test/view/resourceRoster.test.ts` states from the rule.
 *
 * The list it appends to is read from the CONFIG at commit time, never from
 * `host.settings` — a snapshot taken at the last data update, while this write lands
 * after an awaited one, so two declarations between two refreshes had the second replace
 * the first's name instead of joining it. Through `resolveSettings` rather than a second
 * reading of the raw option: the split, the trim and the dedupe are that function's, and
 * parsing the string here would be a second opinion about what the roster is.
 * **It closes the window it can see, and only that one.** Whether one pane's `set` is
 * visible to another pane's `get` before its own refresh is an Obsidian internal nothing
 * here can answer, so two panes declaring two new names in the same instant may still
 * leave one of them undeclared — a live-vault question, recorded on PR #134.
 */
export function declareResource(host: BacklogViewHost, name: string | null): void {
	if (name === null || name.includes(',') || host.settings.assigneeKey === '') return;
	const roster = resolveSettings(host.config).resourceNames;
	if (roster.some((declared) => sameValue(declared, name))) return;
	host.config.set('resourceNames', [...roster, name].join(', '));
}

/**
 * Render one label menu's offers, checking the one the item already holds, and the way
 * back out of them.
 *
 * Checked is asked of the PLAN — an entry is checked exactly when picking it would write
 * nothing — never by a comparison written beside the plan and expected to agree with it.
 * The Clear entry appears only while the note carries the key (`ownKeys`, presence not
 * value), so no entry here can write nothing, and it removes the key rather than blanking
 * it: unassigned and unjudged are states a note returns to, and a blank value would read
 * as a name or a level with nothing in it.
 */
function addLabelItems(
	menu: Menu,
	host: BacklogViewHost,
	item: BacklogItem,
	spec: {
		choices: string[];
		writes: (value: string | null) => ItemWrite[];
		present: boolean;
		clearTitle: string;
		/** Drawn after the choices and before the clear entry — the assignee's way to type one. */
		extra?: () => void;
		/**
		 * What a pick DOES, where that is more than handing the plan to the gate — the
		 * assignee's route through `performResourceMove` while its own axis is drawn. The
		 * CHECKMARK still asks `writes`, and must: an entry is checked exactly when picking
		 * it would write nothing, which is a question about the plan and not about who
		 * applies it.
		 */
		apply?: (value: string | null) => void;
	},
): void {
	const apply = spec.apply ?? ((value: string | null) => void host.applySafely(spec.writes(value)));
	for (const value of spec.choices) {
		menu.addItem((si) => {
			si.setTitle(value).onClick(() => apply(value));
			if (spec.writes(value).length === 0) si.setChecked(true);
		});
	}
	spec.extra?.();
	if (!spec.present) return;
	menu.addSeparator();
	menu.addItem((si) =>
		si
			.setTitle(spec.clearTitle)
			.setIcon('eraser')
			.onClick(() => apply(null)),
	);
}

/** Set risk's entries — the declared levels, then the way to clear the key. */
export function addRiskItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	addLabelItems(menu, host, item, {
		choices: declaredChoices(host.settings.riskValues, item.riskValue),
		writes: (value) => computeRiskWrites(item, value),
		present: item.ownKeys.risk,
		clearTitle: t('menu.clearRisk'),
	});
}

/** Set priority's entries — {@link addRiskItems} over the other declared ladder. */
export function addPriorityItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	addLabelItems(menu, host, item, {
		choices: declaredChoices(host.settings.priorityValues, item.priorityValue),
		writes: (value) => computePriorityWrites(item, value),
		present: item.ownKeys.priority,
		clearTitle: t('menu.clearPriority'),
	});
}

/**
 * Set assignee's entries — the observed names, the way to type one that is not there
 * yet, and the way to clear the key.
 *
 * The **New assignee...** entry sits between the names and the clear, and it is what
 * makes this menu safe to draw on a named key alone: with nothing observed the list is
 * empty, and a menu that could then set nothing is exactly what the risk menu's absence
 * when its levels are cleared exists to prevent.
 */
export function addAssigneeItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	addLabelItems(menu, host, item, {
		choices: assigneeChoices(host, item),
		writes: (value) => computeAssigneeWrites(item, value),
		present: item.ownKeys.assignee,
		clearTitle: t('menu.clearAssignee'),
		apply: (value) => void chooseAssignee(host, item, value),
		extra: () =>
			menu.addItem((si) =>
				si
					.setTitle(t('menu.newAssignee'))
					.setIcon('plus')
					.onClick(() => promptNewAssignee(host, item)),
			),
	});
}

/**
 * Free-text entry, suggesting the names already in use so spellings stay consistent.
 *
 * Through `chooseAssignee` like every other pick: a name typed here is a fourth input to
 * the same move, not a second plan beside it, so on the resources axis it announces itself
 * exactly as a drop into that row would.
 */
function promptNewAssignee(host: BacklogViewHost, item: BacklogItem): void {
	new ValuePromptModal(host.app, {
		title: t('menu.assignTitle'),
		fieldName: t('menu.assignField'),
		placeholder: t('menu.assignPlaceholder'),
		ctaLabel: t('menu.assignCta'),
		known: assigneeChoices(host, item),
		onSubmit: (value) => void chooseAssignee(host, item, value.trim()),
	}).open();
}

/**
 * One NOTE a row may be put into: the note, and the name the entry wears. The two are
 * separate fields because they can differ — see {@link namedTargets} — and the value
 * behind an entry is always the note, never its label.
 */
interface NoteTarget {
	item: BacklogItem;
	label: string;
}

/**
 * Candidates, named apart only where two of them collide: the basename, and the whole
 * path (minus the extension) for the notes that share one.
 *
 * Only where they collide, because qualifying every entry to separate a rare pair makes
 * the ordinary case unreadable — and the write is unaffected either way, since the plan
 * carries the FILE and `wikilinkTo` spells the link from the editing note's own path.
 *
 * One function for both pickers rather than the same lines twice. `Set iteration` and
 * `Set release` both name NOTES, so they face one question — which of these two is the
 * reader picking — and two copies of the answer would be one edit from two spellings of
 * it. What each picker still owns is its own POPULATION, above.
 */
function namedTargets(found: BacklogItem[]): NoteTarget[] {
	const seen = new Map<string, number>();
	for (const target of found) seen.set(target.title, (seen.get(target.title) ?? 0) + 1);
	return found.map((target) => ({
		item: target,
		label:
			(seen.get(target.title) ?? 0) > 1
				? target.file.path.slice(0, -(target.file.extension.length + 1))
				: target.title,
	}));
}

/**
 * Every `Iteration` this row may join.
 *
 * Read off `model.byPath` and never off the results or the rendered forest: a focus set
 * on another projection re-roots what is DRAWN, and an iteration hangs from nothing, so
 * a top-level one would go unofferable exactly when a reader had narrowed the tree to
 * the rung they were assigning. Context rows are excluded for the ordinary reason — an
 * excluded note is not this base's vocabulary — while the row's OWN refusals live in
 * {@link canSetIteration}.
 */
function iterationTargets(host: BacklogViewHost): NoteTarget[] {
	return namedTargets(
		[...(host.model?.byPath.values() ?? [])].filter(
			(candidate) => isIterationType(candidate.typeName) && !candidate.outsideFilter,
		),
	);
}

/**
 * Every `Release` this row may be put in — `model.releases`, which is that same read off
 * `byPath` rather than off the rendered forest, with the context rows already dropped.
 * So "never offered for a release the Base excluded" holds by construction here rather
 * than by a filter this file would have to remember; the row's OWN refusals are in
 * {@link canSetRelease}.
 */
function releaseTargets(host: BacklogViewHost): NoteTarget[] {
	return namedTargets(host.model?.releases ?? []);
}

/**
 * Whether this row is offered `Set iteration` at all. Four refusals, each a different
 * rule, and the fifth — a context row — is the caller's `editable` gate, which withholds
 * every entry that edits the row's own frontmatter.
 *
 * **The KEY gate follows from none of the others.** A vault can hold `Iteration` notes
 * while the property is unnamed, so the target list is non-empty and every other refusal
 * passes; the submenu would then render a full list, tick one of them, and write nothing
 * on each pick, because `computeIterationWrites` returns `[]` with no key. It cannot be
 * had from the plan's emptiness either: an empty plan is also what a CORRECT no-op pick
 * returns, so hiding the entries whose plan is empty would hide the current iteration.
 *
 * **The marker refusal is `isMarkerType`, never `isIterationType`.** A marker occupies no
 * rung, holds nothing and hangs from nothing — it is not work, and a sprint is a
 * commitment to finish some. Written as the narrow name a `Milestone` passes every
 * refusal and is offered the action, and a pick writes the iteration's two dates over the
 * milestone's own target. A milestone IS its date; there is nothing else in it to keep.
 *
 * A catalog member is refused because the population it would join is the plan's, so the
 * link would be stored where no card can draw it. And with neither a link nor a target
 * there is genuinely nothing to do — which is not the same as no TARGETS: an item holding
 * a link keeps the submenu, with `None` alone, since this is the only place offering to
 * take that value off.
 *
 * **A link, asked of the parsed ENTRY, and not of key presence** — which is where this
 * gate and `computeIterationWrites` deliberately disagree, so read both before making them
 * match. ✨ Assign missing properties stubs `iteration: ''` onto every eligible note
 * (`missingKeyStubs` skips only `horizon` and `dependsOn`), so in a vault where it ran
 * before any `Iteration` note existed, presence is true on EVERY row while there is
 * neither an assignment to clear nor anywhere to go: `Set iteration` on all of them,
 * holding `None` alone. `iterationEntry` is non-null for a resolved link and for a broken
 * one alike (`readLinkList` keeps `{ raw, file: null }`) and null for a blank stub, which
 * is the question this gate is actually asking. What a `None` pick WRITES stays key
 * presence, and must: that is what keeps a reader-refused value (`iteration: ''`,
 * `iteration: 12`) clearable whenever the menu is shown at all.
 *
 * The corner that accepts: a note whose key holds a refused non-empty value in a vault
 * with no `Iteration` notes AT ALL is offered nothing, so that value is unclearable until
 * one exists. Deliberate — far narrower than a `None`-only menu on every row, and the
 * first iteration created brings the menu back with the clear in it.
 */
export function canSetIteration(host: BacklogViewHost, item: BacklogItem): boolean {
	if (!host.settings.iterationKey) return false;
	if (isMarkerType(item.typeName)) return false;
	if (inCatalog(item)) return false;
	return item.iterationEntry !== null || iterationTargets(host).length > 0;
}

/**
 * Set iteration's entries — every iteration in the model, then the way back out of one.
 *
 * Not through `addLabelItems` above: a label is a plain string that IS its own entry
 * title, while an iteration is a NOTE whose title is derived and can differ from it, so
 * the shared helper would have to carry a label accessor two of its three callers pass as
 * the identity. What it shares instead is that helper's rules, one of them narrowed.
 * Checked is asked of the PLAN, never by a comparison written beside the plan and
 * expected to agree with it — but of the plan's LINK component alone, see below. And
 * `None` is unconditional, always the last entry, and checked exactly like every other
 * one — when `computeIterationWrites(item, null, …)` is empty, which is precisely an
 * item with no `iteration` key at all. Hiding it while unassigned was the inverted
 * version of this: `None` is the entry that MARKS "in no iteration", not a write guard —
 * `writes(null)` being empty is `None`'s own current-state case, not a reason to hide it.
 */
export function addIterationItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const writes = (target: BacklogItem | null): ItemWrite[] => computeIterationWrites(item, target, host.settings);
	const targets = iterationTargets(host);
	for (const target of targets) {
		menu.addItem((si) => {
			si.setTitle(target.label).onClick(() => void host.applySafely(writes(target.item)));
			// Narrowed deliberately when the plan grew a timeframe. The register's usual
			// rule — checked exactly when picking it would write nothing — was the same
			// question as "which iteration is this item in" only while the plan held ONE
			// write. Now a re-pick of the current iteration re-syncs its dates, so an item
			// whose dates have drifted plans something for every entry and NO entry would
			// show as current. The menu's question is the second one, so it asks the
			// component that answers it. Still asked of the plan, so nothing compares
			// values beside it — which is the drift the original rule exists to prevent.
			if (!writes(target.item).some((w) => w.iteration !== undefined)) si.setChecked(true);
		});
	}
	if (targets.length > 0) menu.addSeparator();
	menu.addItem((si) => {
		si.setTitle(t('menu.clearIteration'))
			.setIcon('eraser')
			.onClick(() => void host.applySafely(writes(null)));
		if (writes(null).length === 0) si.setChecked(true);
	});
}

/**
 * Whether this row is offered `Set release` at all — {@link canSetIteration}'s four
 * refusals asked again, with one of them borrowed rather than restated.
 *
 * **The type half is the READER's own pair**, `inPlan` and `mayHoldField(…, 'release', …)`
 * — exactly what `membershipTarget` (`domain/releases.ts`) refuses a carrier for, so no
 * pick here can write a membership the release view will then report as unresolved. The
 * two are not redundant, and what each buys is what the other cannot see: `inPlan` reads
 * the LADDER, so it refuses a `Task` under a test suite that no type NAME could answer,
 * while the field rule refuses the `Milestone` and the `Release` that `inPlan` admits.
 * They overlap on the catalog TYPES, deliberately — the field rule carries that half
 * because `refusesLiveType` (`storage/frontmatter.ts`) asks it with a name and no item.
 * The LADDER half reaches that door too, as `refusesLiveMembership`'s live parent walk: a
 * reparent between this pick and the write is the same race a retype is.
 * Written as one of them alone, a hand-edit and a menu pick would disagree about what may
 * hold a release, which is the one thing the reader's refusals exist to prevent.
 *
 * **The KEY gate follows from none of the others**, exactly as it does for the iteration:
 * a vault can hold `Release` notes with the property unnamed, so the target list is
 * non-empty and every other refusal passes, while `computeReleaseWrites` plans nothing for
 * any pick. It cannot be had from the plan's emptiness either — an empty plan is also what
 * a correct no-op pick returns, so hiding the entries whose plan is empty would hide the
 * release the item is already in.
 *
 * **A membership, asked of KEY PRESENCE** — which is where this gate and `canSetIteration`
 * deliberately differ, so read both before making them match. That one asks the parsed
 * ENTRY because ✨ Assign missing properties stubs `iteration: ''` onto every eligible note,
 * so presence there would put a `None`-only menu on every row in a vault with no sprint yet.
 * `neverStubbed` (`domain/writePlan.ts`) refuses a release stub for its own reason — an
 * empty membership is not an empty slot — so presence here is true only where somebody
 * WROTE the key, and it is the same question `computeReleaseWrites` asks to plan the
 * removal. Asking the entry instead left the corner `canSetIteration` accepts: a value the
 * reader refuses (`release: ''`, `release: 2.4`, an object) in a base holding no `Release`
 * note at all was reported as unresolved and offered nothing that could take it off
 * (Codex, PR #201). The iteration keeps that corner because its stub makes the alternative
 * worse; the release has no stub, so it costs nothing to close.
 *
 * The fifth refusal is the caller's `editable` gate, which withholds every entry that
 * edits the row's own frontmatter — a context row is never a write target.
 */
export function canSetRelease(host: BacklogViewHost, item: BacklogItem): boolean {
	if (!host.settings.releaseKey) return false;
	if (!inPlan(item) || !mayHoldField(item.typeName, 'release', host.settings)) return false;
	return item.ownKeys.release || releaseTargets(host).length > 0;
}

/**
 * Set release's entries — every release in the model, then the way back out of one.
 *
 * `addIterationItems`' shape with its narrowing removed rather than copied: that menu asks
 * the plan's LINK component alone because a re-pick there re-syncs the sprint's dates, and
 * this plan has ONE component (`computeReleaseWrites` copies no timeframe), so the
 * register's unnarrowed rule applies — an entry is checked exactly when picking it would
 * write nothing. Asked of the PLAN either way, never by a comparison written beside the
 * plan and expected to agree with it.
 *
 * `No release` is unconditional, always the last entry, and checked exactly like every
 * other one — when `computeReleaseWrites(item, null, …)` is empty, which is precisely a
 * note with no membership key at all.
 *
 * Every pick lands on `performReleaseMove` and none of them plans a write beside it: one
 * move, and this menu plus the keyboard that opens it are two INPUTS to it rather than two
 * ideas of what the move is. The checkmark still asks the planner directly, and must — an
 * entry is checked exactly when picking it would write nothing, which is a question about
 * the plan and not about who applies it.
 */
export function addReleaseItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const writes = (target: BacklogItem | null): ItemWrite[] => computeReleaseWrites(item, target, host.settings);
	const targets = releaseTargets(host);
	for (const target of targets) {
		menu.addItem((si) => {
			si.setTitle(target.label).onClick(() => void host.performReleaseMove(item, target.item));
			if (writes(target.item).length === 0) si.setChecked(true);
		});
	}
	if (targets.length > 0) menu.addSeparator();
	menu.addItem((si) => {
		si.setTitle(t('menu.clearRelease'))
			.setIcon('eraser')
			.onClick(() => void host.performReleaseMove(item, null));
		if (writes(null).length === 0) si.setChecked(true);
	});
}
