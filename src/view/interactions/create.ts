import { Notice, TFile } from 'obsidian';
import { BacklogViewHost } from '../host';
import { IterationPromptModal, IterationResult, TitlePromptModal } from '../../ui/prompts';
import { manualLink } from '../../ui/manualDialog';
import { manualSections } from '../manual/sections';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { focusTarget, folderForType, isIterationType } from '../../domain/itemTypes';
import { AxisWrite, computeIterationNoteWrites, ORDER_SPACING } from '../../domain/writePlan';
import { createBacklogItem } from '../../storage/createNote';
import { iterationNoteName, nextIterationDates, nextIterationName, previousIteration } from '../../domain/iterations';
import { ITERATION_TYPE, LEVELS } from '../../domain/typeVocabulary';
import { daysBetween, formatCivil } from '../../domain/timeline';
import { readDate, todayCivil } from '../../domain/noteFields';
import { statedEnds } from '../../domain/bars';
import { BacklogSettings } from '../../domain/settings';
import { configProblems } from '../../domain/settingsConsistency';
import { t } from '../../i18n/t';

/**
 * Type for the primary New button: whatever the view is focused on when it is focused —
 * a level or an extra type, since both can be focused — else the top level. Named for
 * the TYPE it returns rather than the level it used to, because focusing a Bug is now
 * as ordinary as focusing a PBI.
 */
export function newItemType(settings: BacklogSettings, model: BacklogModel): string {
	if (model.focused) {
		const focus = focusTarget(settings);
		if (focus) return focus;
	}
	return LEVELS[0];
}

/**
 * Where a projection asks a new note to land, beyond the hierarchy: the roadmap's
 * buckets create in place, so the bucket's own value rides the creation write.
 * Absent everywhere else — a placement nobody chose is not one to write.
 */
export interface CreatePlacement {
	horizon?: string;
}

/**
 * Ask for a title (and folder, when nothing is configured) and create the note.
 *
 * `choices` is what this parent may hold — one type under a Task, several under a rung
 * that also takes the extra types. The modal only asks when there is something to ask.
 * `placement` is what the surface the user created FROM adds to that note, and it
 * changes nothing else: every rule below — the config gate, the type folders, folder
 * mode, the inference — governs a bucket's new note exactly as it governs the toolbar's.
 */
export function promptCreateItem(
	host: BacklogViewHost,
	choices: string[],
	parentItem: BacklogItem | null,
	placement: CreatePlacement = {},
): void {
	// Creation writes frontmatter too — the same config guard as applySafely.
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return;
	}
	// Judge existence and infer folders from the FULL tree — a focused view with no
	// matching rows still knows where the hidden items live.
	const hasItems = (host.model?.realRoots.length ?? 0) > 0;
	// In folder mode, children belong next to their parent's folder note — unless that
	// parent is only here as context, because its folder is where the Base's filter
	// isn't: the new note would vanish on the next refresh. Its explicit parent link
	// keeps the hierarchy right wherever it lands, so fall back to the usual folder.
	const parentFolder =
		host.settings.folderHierarchy && parentItem && !parentItem.outsideFilter
			? normalizeFolder(parentItem.file.parent?.path)
			: null;
	// Walked once, not per type: where the backlog already lives does not depend on
	// which type is being created.
	const inferred = hasItems ? inferFolder(host.model) : '';
	/**
	 * Where a new item of this type lands. Folder mode's "beside the parent's folder
	 * note" rule stays on top — there the folder tree IS the hierarchy, and an opt-in
	 * mode should not be quietly overruled by a filing default. Below it the type's own
	 * folder wins over the home folder, so a Bug files itself under `docs/bugs` even in
	 * a base whose items otherwise live together. Where the existing items live is the
	 * last resort before asking, since both folders above are configurable and a
	 * configured folder is an answer where a guess from the vault is not.
	 */
	const chosen = (typeName: string): string => folderForType(typeName, host.settings) || host.settings.homeFolder;
	const folderFor = (typeName: string): string => parentFolder ?? (chosen(typeName) || inferred);
	// Without items or a configured folder there is nothing to infer from, and a note
	// in the vault root would most likely fall outside this base's filter — ask instead.
	// A type that files itself needs no asking, so this only fires when one of the
	// offered types would have nowhere to go.
	// Only when nothing at all can answer: no parent folder, no items to learn from, and
	// no folder configured or defaulted for any type on offer.
	const askFolder = parentFolder === null && !hasItems && choices.every((type) => chosen(type) === '');

	new TitlePromptModal(host.app, {
		// With a choice to make the heading cannot name the type, since the type is the
		// thing being chosen; without one it still says exactly what is being created.
		heading: choices.length > 1 ? 'New item' : `New ${choices[0]}`,
		detail: askFolder ? undefined : (typeName: string) => promptDetail(parentItem, folderFor(typeName)),
		types: choices,
		askFolder,
		// `root: el` — the prompt's own `contentEl`, which is genuinely stable here: unlike
		// the tree and the toolbar, nothing external rebuilds a modal's content while it is
		// open, so the shell this door is drawn into IS the container to resolve it from.
		help: (el) =>
			manualLink(el, host.app, manualSections(), { sectionId: 'creating', label: t('create.whereLabel'), root: el }),
		onSubmit: ({ title, folder, typeName }) => {
			void createFromPrompt(host, {
				levelName: typeName,
				parentItem,
				title,
				folder: askFolder ? folder ?? '' : folderFor(typeName),
				persistFolder: askFolder,
				horizon: placement.horizon,
			});
		},
	}).open();
}

/** Where the new item will land, e.g. `Under "Epic X" · in folder "Backlog"`. */
function promptDetail(parentItem: BacklogItem | null, folder: string): string {
	const where = folder ? `in folder "${folder}"` : 'in the vault root';
	return parentItem ? `Under "${parentItem.title}" · ${where}` : `${where[0].toUpperCase()}${where.substring(1)}`;
}

/**
 * The iteration a new card joins, and the timeframe that comes with it — everything
 * `createBacklogItem` needs to make a card that BELONGS to the board it was made on.
 *
 * This exists because a card created on an iteration board without it would draw once
 * and vanish on the next refresh: the population is the notes that NAME the iteration, so
 * a card that names none is not in it. `A board scoped to one iteration` extension 5c is
 * the criterion; the horizon's own "created in a bucket claims that bucket in the same
 * write" is the precedent, and the dates are that rule read one property further — a card
 * scheduled outside the sprint it was created on is the same incoherence.
 *
 * Asked of `effectiveScope` rather than of the projection, which is the same question one
 * step earlier: a scope that no longer resolves has already fallen the whole view back to
 * the product board, and a card made there is a product card.
 */
function iterationOf(host: BacklogViewHost): { iteration?: TFile; axis?: AxisWrite } {
	const scope = host.effectiveScope;
	const iteration = scope === null ? undefined : host.model?.byPath.get(scope);
	if (!iteration) return {};
	// `statedEnds` reads what the ITERATION carries, gated on the date keys being
	// configured — so an unconfigured end is absent here rather than dropped downstream,
	// and an end the sprint does not state is never invented for the card.
	const ends = statedEnds(iteration);
	const axis: AxisWrite = {};
	for (const end of ['start', 'target'] as const) {
		const date = ends[end].value;
		if (date !== null) axis[end] = formatCivil(date);
	}
	return { iteration: iteration.file, ...(axis.start || axis.target ? { axis } : {}) };
}

interface CreateRequest {
	levelName: string;
	parentItem: BacklogItem | null;
	title: string;
	folder: string;
	persistFolder: boolean;
	horizon?: string;
}

async function createFromPrompt(host: BacklogViewHost, request: CreateRequest): Promise<void> {
	if (request.persistFolder && request.folder) {
		try {
			host.config.set('homeFolder', request.folder);
		} catch (e) {
			console.error('Product Backlog: could not save folder to the view options', e);
		}
	}
	// The new child has to be visible under its parent, collapsed or not.
	const parentItem = request.parentItem;
	if (parentItem) host.setCollapsed(parentItem.file.path, false);

	try {
		const file = await createBacklogItem(host.app, host.settings, {
			folder: request.folder,
			title: request.title,
			typeName: request.levelName,
			parent: parentItem?.file ?? null,
			// Parentless items rank among the real top level, not the focus rows.
			order: endOfSiblingsOrder(parentItem ? parentItem.children : host.model?.realRoots ?? []),
			horizon: request.horizon,
			...iterationOf(host),
		});
		new Notice(t('create.created', { name: file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to create item', e);
		new Notice(t('create.failed'));
	}
}

/** An order value placing a new item after every ranked sibling. */
function endOfSiblingsOrder(siblings: BacklogItem[]): number {
	let maxOrder = 0;
	for (const s of siblings) {
		if (s.order !== null && s.order > maxOrder) maxOrder = s.order;
	}
	return Math.floor(maxOrder) + ORDER_SPACING;
}

function normalizeFolder(path: string | undefined): string {
	return !path || path === '/' ? '' : path;
}

/** Without a configured folder, place new items where most existing items live. */
function inferFolder(model: BacklogModel | null): string {
	const counts = new Map<string, number>();
	const visit = (items: BacklogItem[]) => {
		for (const item of items) {
			// Ancestors loaded from outside the filter live wherever they live — often
			// outside the base's folder entirely. Counting them would aim new notes
			// there, straight out of the view they were created from.
			if (!item.outsideFilter) {
				const path = item.file.parent?.path ?? '';
				counts.set(path, (counts.get(path) ?? 0) + 1);
			}
			visit(item.children);
		}
	};
	visit(model?.realRoots ?? []);
	let best = '';
	let bestCount = 0;
	for (const [path, count] of counts) {
		if (count > bestCount) {
			best = path;
			bestCount = count;
		}
	}
	return best === '/' ? '' : best;
}

/**
 * Make an iteration, or edit the one this board is scoped to — the two entries under the
 * scope picker, and the one dialog behind both.
 *
 * **Both gate `configProblems` before OPENING.** `createBacklogItem` performs no
 * validation of its own — the ordinary New flow runs the gate before reaching it — so a
 * toolbar action calling it directly would be a creation surface accepting a
 * configuration every other one refuses: with the goal property colliding with the type
 * key, the goal overwrites `type: Iteration` and the new note is not an iteration at all.
 * `runInit` is the precedent and the reason. Gated on open rather than on submit, so the
 * reader is told what to fix before typing a name and two dates.
 */
export function promptNewIteration(host: BacklogViewHost, model: BacklogModel): void {
	if (refusedByConfig(host)) return;
	// The FOCUS-IMMUNE population, the same one the scope picker reads (`model.byPath`):
	// `model.results` is narrowed to the focused forest, so with a `PBI` focus retained
	// this found no predecessor and prefilled from today — while the picker beside it went
	// on offering a later sprint, and accepting the prefill would create an iteration
	// overlapping it. Found by review (Codex, PR #154).
	const population = [...model.byPath.values()].filter((item) => !item.outsideFilter);
	const previous = previousIteration(population);
	const dates = nextIterationDates(previous, todayCivil(), host.settings.iterationLengthDays);
	openIterationPrompt(host, {
		heading: t('create.iterationHeading'),
		cta: t('create.iterationCta'),
		// Numbered, so a folder of iterations sorts in the order they run — and a prefill
		// like every other field here, typed over by anyone who names their sprints.
		name: nextIterationName(population),
		start: dates.start,
		target: dates.target,
		goal: '',
		onSubmit: (result) => void createIteration(host, result),
	});
}

export function promptEditIteration(host: BacklogViewHost, item: BacklogItem): void {
	if (refusedByConfig(host)) return;
	const ends = statedEnds(item);
	openIterationPrompt(host, {
		heading: t('create.iterationEditHeading', { title: item.title }),
		cta: t('create.iterationEditCta'),
		// No name field: renaming an iteration is renaming a note, and Obsidian does that
		// better — the stored scope already follows a rename either way.
		name: null,
		start: ends.start.value === null ? '' : formatCivil(ends.start.value),
		target: ends.target.value === null ? '' : formatCivil(ends.target.value),
		goal: item.iterationGoalValue ?? '',
		onSubmit: (result) => void saveIteration(host, item, result),
	});
}

/**
 * The edit, re-asked of the LIVE note before it is planned.
 *
 * A dialog stays open across refreshes, so the `BacklogItem` it was opened on is a
 * snapshot: the note can be retyped or deleted while the reader is typing, and an
 * unconditional write would then put an iteration's dates and goal onto a work item — or
 * onto a `Milestone`, whose own target the axis write would overwrite. `applySafely`
 * cannot catch it, because it checks the configuration and the filter and neither has
 * changed. Found by review (Codex, PR #154).
 *
 * A view-layer re-read rather than an expectation carried into the write boundary, and
 * the narrower fix is deliberate: this closes the one path a reader can actually take,
 * while the general question — whether a plan should carry what it expected the note to
 * be, so `storage/` can refuse a stale batch — is open across `writePlan.ts` and
 * `labels.ts` and is escalated rather than answered here.
 */
function saveIteration(host: BacklogViewHost, item: BacklogItem, result: IterationResult): void {
	const live = host.model?.byPath.get(item.file.path);
	if (!live || !isIterationType(live.typeName)) {
		new Notice(t('create.iterationGone'));
		return;
	}
	void host.applySafely(
		computeIterationNoteWrites(live, {
			axis: axisFrom(host, result),
			// A cleared goal REMOVES the key here, which is the edit path's own case:
			// the key exists, and taking it off is what clearing means.
			goal: host.settings.iterationGoalKey ? (result.goal || null) : undefined,
		}),
	);
}

/**
 * Whether the confirmed pair runs backwards. Read through `readDate`, the same tolerant
 * reader the model uses, so a value this view cannot read is not called reversed — the
 * refusal is about an order, never about a spelling.
 */
function reversed(start: string, target: string): boolean {
	const from = readDate(start).value;
	const to = readDate(target).value;
	return from !== null && to !== null && daysBetween(from, to) < 0;
}

function refusedByConfig(host: BacklogViewHost): boolean {
	const problems = configProblems(host.settings);
	if (problems.length === 0) return false;
	new Notice(t('config.fixFirst', { problem: problems[0] }));
	return true;
}

/** The two ends a confirmed entry states — absent where no property could hold one. */
function axisFrom(host: BacklogViewHost, result: IterationResult): AxisWrite {
	const axis: AxisWrite = {};
	if (host.settings.startKey) axis.start = result.start || null;
	if (host.settings.targetKey) axis.target = result.target || null;
	return axis;
}

/**
 * The dialog itself, with the one validation both paths share: a confirmed target before
 * its start is refused HERE rather than at the write, because the write path's honest
 * answer to a reversed span is to shelve the note — and a dialog that produced one on
 * purpose would be a control creating the thing the roadmap has to apologise for.
 */
function openIterationPrompt(
	host: BacklogViewHost,
	spec: {
		heading: string;
		cta: string;
		name: string | null;
		start: string;
		target: string;
		goal: string;
		onSubmit: (result: IterationResult) => void;
	},
): void {
	new IterationPromptModal(host.app, {
		...spec,
		description: t('create.iterationDates'),
		fields: {
			start: host.settings.startKey !== '',
			target: host.settings.targetKey !== '',
			goal: host.settings.iterationGoalKey !== '',
		},
		validate: (result) => {
			if (spec.name !== null && result.name === '') return 'Give the iteration a name.';
			if (result.start && result.target && reversed(result.start, result.target)) {
				return 'The target is before the start.';
			}
			return null;
		},
	}).open();
}

/**
 * The create half — one write carrying the type, the folder, both dates and the goal, so
 * the note is never momentarily an iteration its own frontmatter does not describe.
 *
 * A blank goal is an OMITTED field rather than an empty string: `createBacklogItem`
 * writes what it is given, so `''` would land as `goal: ''` — a key the register says is
 * not written at all, and the placeholder the board is refused from drawing.
 */
async function createIteration(host: BacklogViewHost, result: IterationResult): Promise<void> {
	const axis = axisFrom(host, result);
	try {
		const file = await createBacklogItem(host.app, host.settings, {
			folder: folderForType(ITERATION_TYPE, host.settings) || host.settings.homeFolder,
			title: iterationNoteName(result.name, result.goal),
			typeName: ITERATION_TYPE,
			parent: null,
			order: endOfSiblingsOrder(host.model?.realRoots ?? []),
			axis: { ...(axis.start ? { start: axis.start } : {}), ...(axis.target ? { target: axis.target } : {}) },
			...(host.settings.iterationGoalKey && result.goal ? { iterationGoal: result.goal } : {}),
		});
		// **Not opened**, like every other creation this plugin makes. It was opened for
		// one round on the argument that an iteration draws nowhere and would otherwise be
		// a note to go and find; the user's answer is that making a sprint is a planning
		// act and taking the reader off the board they are planning ON is the cost that
		// argument did not count. The scope picker names it either way.
		new Notice(t('create.iterationCreated', { name: file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to create iteration', e);
		new Notice(t('create.iterationFailed'));
	}
}
