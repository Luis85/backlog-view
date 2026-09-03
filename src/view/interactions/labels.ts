import { Menu, TFile } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { inCatalog, isIterationType, isMarkerType, mayHoldField } from '../../domain/itemTypes';
import { BacklogItem, inPlan } from '../../domain/model';
import { sameValue, todayCivil } from '../../domain/noteFields';
import { NamedTarget, namedTargets, ResourceNote } from '../../domain/readItems';
import {
	computeAssigneeWrites,
	computeIterationWrites,
	computePriorityWrites,
	computeReleaseWrites,
	computeRiskWrites,
	ItemWrite,
} from '../../domain/writePlan';
import { promptNewResource } from './resourceNotes';

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
 * and priority's vocabularies are DECLARED strings, while the assignee's is the `Resource`
 * notes the base returned — a note, not a string, so it is a bespoke builder
 * (`addAssigneeItems`) rather than another call into `addLabelItems`. What it shares with
 * the other two is the shape: a list, one checkmark asked of the plan, a foot that removes
 * the key.
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
 * Whether the frame on screen is the one whose ROWS this property draws. Asked once now,
 * in `chooseAssignee`, to route a pick to `performResourceMove`'s announcing path rather
 * than straight through the gate — Set assignee's own vocabulary left this axis entirely
 * on 2026-08-28 (Task 4): it offers the `Resource` notes the base returned, not the
 * drawn rows, so there is no second "what the menu offers" question left for this
 * function to answer.
 */
function onResourceAxis(host: BacklogViewHost): boolean {
	return host.projection === 'roadmap' && host.roadmap?.roadmap.axis === 'resources';
}

/**
 * What picking a note DOES. On the resources axis it takes the DRAG's own path, so a pick
 * and a drop onto the same row are one write, one gate and — the part only this path can
 * supply — one announcement, said once by `performResourceMove` rather than by each input
 * separately. Elsewhere there is no frame to announce into and the planned write goes
 * straight through the gate. `chooseHorizon` splits on the roadmap for this reason and
 * `chooseState` on the board.
 */
async function chooseAssignee(host: BacklogViewHost, item: BacklogItem, target: TFile | null): Promise<unknown> {
	// On-axis the move declares it, so this branch does not — once per path, never twice.
	if (onResourceAxis(host)) return host.performResourceMove(item, target);
	return host.applySafely(computeAssigneeWrites(item, target));
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
	},
): void {
	const apply = (value: string | null) => void host.applySafely(spec.writes(value));
	for (const value of spec.choices) {
		menu.addItem((si) => {
			si.setTitle(value).onClick(() => apply(value));
			if (spec.writes(value).length === 0) si.setChecked(true);
		});
	}
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
 * What Set assignee offers: the `Resource` notes the base returned, and nothing else.
 *
 * One source where there were three. A roster is no longer a recommendation on top of
 * observed names — it is the notes, so an observed string is not a vocabulary this base
 * recommends to anybody and the item's own unresolved value earns no entry either: a
 * value that is not a link resolves to nobody, which is a fact to render rather than an
 * option to offer. Scoped through the model's own list, which `divertResource` already
 * scoped to the results.
 */
function assigneeTargets(host: BacklogViewHost): ResourceNote[] {
	return host.model?.resources ?? [];
}

/**
 * Set assignee's entries — the resource notes the base returned, the way to make one,
 * and the way to clear the key.
 *
 * Not through `addLabelItems`: its choices are notes rather than strings, so it is a
 * bespoke builder over `namedTargets` — the same disambiguation `Set iteration` and
 * `Set release` already share.
 */
export function addAssigneeItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	// Named apart only where two collide, through `namedTargets` — the helper Set
	// iteration and Set release already share for exactly this: two resource notes with
	// one basename in different folders are two distinct targets the path-keyed model
	// tells apart, and two menu entries reading the same word the reader cannot.
	const targets = namedTargets(assigneeTargets(host));
	for (const target of targets) {
		menu.addItem((si) => {
			si.setTitle(target.label).onClick(() => void chooseAssignee(host, item, target.item.file));
			if (computeAssigneeWrites(item, target.item.file).length === 0) si.setChecked(true);
		});
	}
	// A menu with nothing to pick says why rather than opening empty, and the reason is
	// always the same one — the base returned no resources.
	if (targets.length === 0) menu.addItem((si) => si.setTitle(t('menu.noResources')).setDisabled(true));
	menu.addItem((si) =>
		si
			.setTitle(t('menu.newResource'))
			.setIcon('plus')
			.onClick(() => promptNewResource(host, (file) => void chooseAssignee(host, item, file))),
	);
	// The clear goes LAST, after `New resource...`: the choices, then the way to make a
	// new one, then a separator and the way out. Gated on PRESENCE independently of
	// whether any resource is offered — an empty roster is exactly when an item most
	// needs its leftover value cleared, and withholding it would leave the note itself as
	// the only way out.
	if (!item.ownKeys.assignee) return;
	menu.addSeparator();
	menu.addItem((si) =>
		si
			.setTitle(t('menu.clearAssignee'))
			.setIcon('eraser')
			.onClick(() => void chooseAssignee(host, item, null)),
	);
}

/**
 * One NOTE a row may be put into: the note, and the name the entry wears. The two are
 * separate fields because they can differ — see `namedTargets` (`domain/readItems.ts`,
 * moved there when `BacklogModel.resourceLabels` became its second caller) — and the
 * value behind an entry is always the note, never its label.
 */
type NoteTarget = NamedTarget<BacklogItem>;

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
 * while the field rule refuses the `Milestone` that `inPlan` admits.
 * They overlap on the catalog TYPES, deliberately — the field rule carries that half
 * because `refusesLiveType` (`storage/frontmatter.ts`) asks it with a name and no item.
 *
 * **The field rule's `Release` term is unreachable HERE**, and this sentence named it as
 * live until 2026-08-25. `mayHoldField(…, 'release', …)` refuses a `Release` through
 * `!isMarkerType` — `MARKER_TYPES` holds all three — and `inPlan` beside it has refused one
 * outright since 2026-08-24, so no row reaches the field rule with that name. The term is
 * still live at the WRITING end, where `refusesLiveType` (`storage/frontmatter.ts`) asks
 * `mayHoldField` with a type name and no item to put an `inPlan` question to; it is dead
 * only at this call site, which is one of the unreachable statements collected in
 * `docs/issues/A release is refused in several places.md`.
 * The LADDER half reaches no further than this pick: `refusesLiveMembership`
 * (`domain/releases.ts`) asks the TARGET alone, because which ladder a row is on is a model
 * decision the vault cannot re-derive — a reparent between this pick and the write is a
 * race nothing at the write boundary catches, recorded in `docs/issues/A carrier
 * reparented into the catalog keeps its release.md`.
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
 * `neverStubbed` (`domain/rankBackfill.ts`) refuses a release stub for its own reason — an
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
 * the plan's LINK component alone because a re-pick there re-syncs the sprint's dates. This
 * plan carries two dates of its own now ([[Joining a release dates the work]]), and the
 * register's unnarrowed rule still applies — an entry is checked exactly when picking it
 * would write nothing — because the dates ride the JOIN and only the join: extension 2a
 * makes an unchanged link plan nothing at all, dates included. Asked of the PLAN either
 * way, never by a comparison written beside the plan and expected to agree with it.
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
	// One reading of the clock for the whole menu, passed in because `domain/` reads none.
	const today = todayCivil();
	const writes = (target: BacklogItem | null): ItemWrite[] => computeReleaseWrites(item, target, host.settings, today);
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
