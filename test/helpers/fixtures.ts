/**
 * A backlog worth LOOKING at — the fixture the browser harness mounts.
 *
 * The per-suite fixtures beside this one (`fixture()`, `boardVault()`, `horizonVault()`)
 * are deliberately four notes each: a test asserting on three rows should not be reading
 * past thirty. This one has the opposite job. It has to give all FOUR projections
 * something to draw at once, so every branch of the render path a person might want to
 * look at is on screen without configuring anything: depth in the tree, every board
 * column including the stateless one, both roadmap axes, the shelf, a context row, a
 * milestone, and Deliverables on a workflow of their own.
 *
 * The **extra types** are three notes rather than one for the same reason. What makes one
 * a type rather than a rung is that its rank is pinned wherever it hangs, and a single
 * example cannot show that — so there is one under an Epic and one under a Feature, drawn
 * level with each other and each level with the PBIs beside it, the shallow one carrying
 * the Task child that the pinning is what produces. The third has no parent and nothing
 * placed, which is the pair of branches the other two cannot cover: a declared type
 * belongs with no parent at all, and the shelf groups by type.
 *
 * No existing suite is rewritten onto it. It is a fourth fixture, not a replacement.
 */
import { FakeVault, FakeViewConfig } from './vault';
import { resolveEstimationSettings } from '../../src/domain/estimationSettings';
import { computeTotal, stampValue } from '../../src/domain/weightedScore';

/** The one note the Base does not return — the parent that renders as a context row. */
const OUTSIDE = 'Retired platform';

/**
 * How a fixture FILES its notes, which is a different question from what the backlog is.
 *
 * `flat` is one folder of notes joined by `parent` links — what the plugin ships as its
 * default. `folders` is the vault a folder-note user already has: every note is the note
 * of its own folder, its children live inside that folder, and NOTHING carries a `parent`
 * key, so the path is the only thing placing a row. The same backlog either way, which is
 * the point — the tree drawn from the second is the tree drawn from the first, and a
 * fixture that stated a different backlog could not show that.
 */
export type Layout = 'flat' | 'folders';

/**
 * The `add` one fixture builds its notes with. It is a closure rather than a free
 * function because the folder layout needs the parent's FOLDER, which only the calls
 * already made can say.
 *
 * `container` names a folder with no note of its own — `Use cases` in the screenshot this
 * layout came from. It is the case folder inference has to walk straight through
 * (`Folder note hierarchy` extension 2a) and it is ignored in the flat layout, where a
 * folder means nothing.
 */
function adder(vault: FakeVault, layout: Layout) {
	const dirs = new Map<string, string>();
	return function add(
		title: string,
		frontmatter: Record<string, unknown>,
		parent?: string,
		container?: string,
	): void {
		if (layout === 'flat') {
			vault.addFile(`${title}.md`, { frontmatter, parentLink: parent });
			return;
		}
		// Loud rather than misfiled: a parent named before it is added would otherwise land
		// its child at the vault root and quietly rename the case the fixture was making.
		if (parent !== undefined && !dirs.has(parent)) throw new Error(`fixture parent not added yet: ${parent}`);
		const under = [parent === undefined ? '' : dirs.get(parent), container].filter(Boolean).join('/');
		const dir = under === '' ? title : `${under}/${title}`;
		dirs.set(title, dir);
		if (under !== '') vault.folders.add(under);
		vault.folders.add(dir);
		vault.addFile(`${dir}/${title}.md`, { frontmatter });
	};
}

/**
 * View options configuring all four projections at once: the workflow the board columns
 * come from, the horizon vocabulary the buckets come from, the two date properties the
 * dated axis reads, and the Deliverable workflow on its OWN key — the configuration that
 * puts two different properties under one state column, which is the arrangement worth
 * looking at rather than the shared-key fallback where the two coincide.
 */
export function demoOptions(): Record<string, unknown> {
	return {
		stateProperty: 'note.status',
		stateValues: 'New, Ready, Active, Review, Done',
		doneValues: 'Done',
		startedStates: 'Active, Review',
		horizonProperty: 'note.horizon',
		horizonValues: 'Now, Next, Later',
		dependsOnProperty: 'note.dependsOn',
		startProperty: 'note.start',
		targetProperty: 'note.due',
		startedDateProperty: 'note.started',
		finishedDateProperty: 'note.finished',
		// The levels are left at the shipped default, so the harness draws the chip against
		// the vocabulary a vault gets by pressing ✨ rather than one invented here.
		riskProperty: 'note.risk',
		// The second declared ladder, left at ITS shipped default for the same reason — so
		// the harness draws the MoSCoW chip a vault gets from pressing ✨, beside the risk
		// chip it has to be told apart from at a glance.
		priorityProperty: 'note.priority',
		// A key and nothing beside it — the whole configuration the CHIP takes, and the
		// reason the harness can draw it against a vocabulary the fixture's own notes
		// supply rather than one declared here.
		assigneeProperty: 'note.assignee',
		// The resources axis, which needs the assignee key above plus the dates it already
		// has. Every row is a `Resource` note now (Task 5, 2026-08-28) — `demoVault()` adds
		// one each for Dana, Kim, Priya and Sam below — and `Priya` is on nothing, so her
		// row draws empty: a resource exists whether or not work has reached them, and
		// nothing else in the fixture can show that.
		// The tags column has been in `demoOrder()` from the start and drew EMPTY on every
		// row until 2026-08-15, because the key was never named and no note carried one:
		// the pills, their remove buttons and the whole editing surface were unreachable in
		// the tool built for looking. A property named in the order but not in the options
		// is a plain column, so this line is what makes it the TAGS column.
		tagsProperty: 'note.tags',
		// A WIP limit and a column policy, which are shipped board features that nothing in
		// the harness could draw. `Active` holds more than two cards in the fixture below,
		// so the limit is drawn AND breached — the count badge, its warning icon and the
		// over-limit column all at once, rather than a limit that is merely stated. `Review`
		// carries the policy instead, so the two read separately.
		'wipLimit.active': '2',
		'columnPolicy.review': 'Two reviewers, one of them outside the team',
		// Two states painted and three left on their palette slot, which is what the colour
		// feature looks like in use rather than as a demo of itself: a NAMED colour and a
		// hand-typed hex are the two shapes `stateColorPaint` resolves differently, and the
		// unpainted states beside them are what says the slot colours are still doing their
		// job. Nothing here was drawable in the harness before 2026-08-15 — the chips, the
		// column heads and the legend all read the same paint.
		'stateColor.active': 'blue',
		'stateColor.review': '#b07cc6',
		deliverableStateProperty: 'note.docStatus',
		deliverableStateValues: 'Concept, Draft, In review, Published',
		deliverableDoneValues: 'Published',
	};
}

/**
 * What the harness's Bases properties menu shows, in its order. It has to be stated
 * now: the columns ARE this list, so a harness with an empty order draws a bare tree
 * and answers nothing about the layout. A chip is deliberately not first and not last —
 * the point of the page is that a chip sits wherever the menu puts it.
 */
export function demoOrder(): string[] {
	// The two date ends are here so the page draws their chips at all, and they sit
	// between the assignee and the tags rather than at either end for the reason above.
	// `demoVault()` already carries every face they have — a note with both dates, one
	// with neither, a milestone whose start cell must draw NOTHING, and the context row —
	// so no note had to be added to show them.
	//
	// `note.points` is the one column here that is NOT one of ours: a plain Bases value,
	// which is what `renderCell` falls through to and what every vault has. Nothing in any
	// fixture drew that branch until 2026-08-15.
	return [
		'note.status',
		'note.horizon',
		'note.risk',
		'note.priority',
		'note.assignee',
		'note.start',
		'note.due',
		'note.points',
		'note.tags',
	];
}

/**
 * `demoOptions()` with folder inference on — the configuration `demoVault('folders')` has
 * to be mounted under. The two go together: the folder fixture writes no `parent` key at
 * all, so with the option off every one of its notes is a root.
 */
export function folderOptions(): Record<string, unknown> {
	return { ...demoOptions(), inferFolderHierarchy: true };
}

/**
 * The notes. Two live epics with real subtrees, one epic outside the filter parenting a
 * feature that is inside it, a scattering of items with no state, no horizon and no
 * dates (which is what puts cards on the shelf and in the no-state column), and one
 * milestone for the line across the plan.
 *
 * `layout` decides only where those notes SIT — see `Layout`. Mount the `folders` one with
 * `folderOptions()`.
 *
 * `extra` appends that many GENERATED notes after the curated ones — see `addBulk`. It
 * defaults to none, so every existing caller gets the fixture it always got.
 */
export function demoVault(layout: Layout = 'flat', extra = 0): FakeVault {
	const vault = new FakeVault();
	const add = adder(vault, layout);
	// The roster: one `Resource` note per name this vault assigns anything to, plus `Priya`
	// on nothing at all — a row is a note now (Task 5, 2026-08-28), so the resources axis
	// draws exactly these four names and nobody else, in this order.
	add('Dana', { type: 'Resource' });
	add('Kim', { type: 'Resource' });
	add('Priya', { type: 'Resource' });
	add('Sam', { type: 'Resource' });
	add('Onboarding', { type: 'Epic', order: 10, status: 'Active', horizon: 'Now', start: '2026-07-01', due: '2026-09-30' });
	add('Sign-up flow', { type: 'Feature', order: 10, status: 'Active', horizon: 'Now', start: '2026-07-01', due: '2026-08-20' }, 'Onboarding');
	// The two PBIs under this Feature sit in a `Use cases` folder that has no note of its
	// own, which is the shape a real folder-organised vault has and the one case folder
	// inference must walk straight THROUGH — `Folder note hierarchy` extension 2a. Their
	// sibling `Cut the release branch` below stays outside it, so the container holds some
	// of a sibling group rather than all of it.
	add('Email and password', { type: 'PBI', order: 10, status: 'Done', started: '2026-07-02', finished: '2026-07-18', horizon: 'Now' }, 'Sign-up flow', 'Use cases');
	add('Validate the address', { type: 'Task', order: 10, status: 'Done' }, 'Email and password');
	add('Rate-limit the endpoint', { type: 'Task', order: 20, status: 'Done' }, 'Email and password');
	// The three risk cases the chip has to draw, on rows that sit near each other: a level
	// from the declared list here, one the list does not name on `Offline-first sync`, and
	// every other row unjudged — which is the dashed, inviting chip and the commonest face.
	// The priority chip's three faces are the same three, on the same rows and for the same
	// reason, which is also what puts two ladders side by side: the widest MoSCoW rung here,
	// an unlisted `P0` on `Offline-first sync`, and the dashed invitation everywhere else.
	// The assignee chip's two faces sit beside the risk chip's for the same reason: a name
	// here and on `Welcome tour` below, every other row unassigned — the dashed, inviting
	// chip, which is the commonest face of both.
	// Tags, in the three shapes the cell has to draw: several on one row (which is where
	// they wrap and where the row's own width is spent), exactly one, and — everywhere
	// else — none, since an empty tags cell is the commonest face of that column and the
	// one a row full of pills has to be read against.
	add('Single sign-on', { type: 'PBI', order: 20, status: 'Review', started: '2026-07-20', horizon: 'Now', start: '2026-07-20', due: '2026-08-15', risk: '1 - High', priority: '2 - Should', assignee: 'Dana', tags: ['auth', 'security', 'needs-design'] }, 'Sign-up flow', 'Use cases');
	add('Provider handshake', { type: 'Task', order: 10, status: 'Active' }, 'Single sign-on');
	add('Token refresh', { type: 'Task', order: 20 }, 'Single sign-on');
	add('Welcome tour', { type: 'Feature', order: 20, status: 'Ready', horizon: 'Next', assignee: 'Kim', tags: ['onboarding'] }, 'Onboarding');
	// Dated while its parent is not, so `Welcome tour` draws an INFERRED bar: outlined,
	// no grips at all, and still a connector — a link claims no date, so it needs no
	// baseline the way a grip does.
	add('Highlight the sidebar', { type: 'PBI', order: 10, status: 'New', horizon: 'Next', start: '2026-08-24', due: '2026-09-05' }, 'Welcome tour');
	add('Skip and resume', { type: 'PBI', order: 20 }, 'Welcome tour');
	// An extra type at the SHALLOWEST legal parent, and the one place the pinned rank is
	// visible rather than merely true: it sits among Features and its child is a Task, the
	// rung two below the Epic holding it. Dated, so an extra type draws a bar as well.
	// Waits for `Single sign-on`, which ends 08-15 — after this one starts. A CONFLICT
	// arrow, and the marker on this row.
	add('Offline-first sync', { type: 'Idea', order: 30, status: 'Active', horizon: 'Next', start: '2026-08-10', due: '2026-10-15', dependsOn: '[[Single sign-on]]', risk: 'Existential', priority: 'P0' }, 'Onboarding');
	add('Survey the storage APIs', { type: 'Task', order: 10, status: 'Active' }, 'Offline-first sync');
	// A bar exactly one day wide — start and target on the same date, an ordinary PBI
	// rather than a Milestone, so it draws the diamond from its GEOMETRY. The case where
	// a bar is narrower than its own handles, and both the end grip and the connector
	// still have to be reachable.
	add('Cut the release branch', { type: 'PBI', order: 40, status: 'Ready', start: '2026-09-14', due: '2026-09-14' }, 'Sign-up flow');
	// The second hop of a chain: this waits for `Offline-first sync`, which waits for
	// `Single sign-on`. Dragging from here, `Single sign-on` must be refused THROUGH the
	// chain and not merely as a direct neighbour — the transitive half of the rule, in
	// the picture rather than only in a unit test.
	add('Sync conflict UX', { type: 'PBI', order: 50, status: 'New', start: '2026-10-20', due: '2026-11-30', dependsOn: '[[Offline-first sync]]' }, 'Onboarding');

	// Waits for `Sign-up flow`, which ends 08-20 — well before this starts. The ORDINARY
	// arrow, so the picture has one of each rather than only the loud one.
	add('Billing', { type: 'Epic', order: 20, status: 'New', horizon: 'Later', start: '2026-10-01', due: '2027-01-31', dependsOn: '[[Sign-up flow]]' });
	add('Invoicing', { type: 'Feature', order: 10, status: 'New', horizon: 'Later' }, 'Billing');
	add('Monthly statement', { type: 'PBI', order: 10, status: 'New' }, 'Invoicing');
	// The one shelved PARENT, and the only reason it exists is that until 2026-08-21 there
	// was none: every one of the shelf's nineteen cards was a leaf, so the disclosure a card
	// draws over its children could not be seen on that band at all. What that hid is in
	// [[Cards or a list on the shelf]] 3b — a compact row laid out as a flex row put the
	// disclosure and its expanded list at the END of the line rather than beneath it, which
	// three rounds of screenshots could not show because nothing here drew one.
	add('Reconcile the ledger', { type: 'Task', order: 10, status: 'New' }, 'Monthly statement');
	// SHELVED with a stated, readable start (its target precedes it), and its prerequisite
	// runs past that start — `Arrows between bars` 2b: a conflict stated on the shelf card
	// with no arrow drawn, since a shelved dependent has no bar to carry one.
	add('Dunning emails', { type: 'PBI', order: 20, start: '2026-08-05', due: '2026-07-01', dependsOn: '[[Sign-up flow]]' }, 'Invoicing');
	// An extra type at the DEEPEST legal parent, drawn level with the two PBIs above it.
	add('Usage-based pricing', { type: 'Idea', order: 30, status: 'New', horizon: 'Later' }, 'Invoicing');
	// A MILESTONE, and its dependency case is the one that survives the type's rule: a
	// milestone waits for nothing, so it declares nothing — but it may be waited FOR, and
	// `Launch checklist` below is what waits on it. Its own `dependsOn` is deliberately
	// absent rather than present-and-ignored: the fixture draws what the view supports.
	add('Ship 1.0', { type: 'Milestone', order: 30, due: '2026-09-30' }, 'Billing');
	// Waits on that milestone — the arrow INTO a diamond, which is the direction a
	// milestone still takes part in. Also names a note this base does not have, so it
	// carries the BROKEN case (1d) too: no arrow for that entry, and the row's glyph.
	// That case lived on `Ship 1.0` until milestones stopped declaring anything.
	add(
		'Launch checklist',
		{ type: 'PBI', order: 40, status: 'New', start: '2026-10-05', due: '2026-10-20', dependsOn: ['[[Ship 1.0]]', 'Contract signed'] },
		'Billing',
	);

	// A RELEASE, which is the dated axis's second full-height mark ([[A release on the dated
	// axis]]) and no row of anything: it hangs from nothing, is drawn by no projection, and
	// contributes a line across the grid and a legend swatch. Dated a fortnight after
	// `Ship 1.0` so the release line and the milestone line are separate marks on one screen
	// — which is the whole of what "visually distinct from a milestone" can be looked at for.
	// Its date is `target-date`, the key `releaseDateProperty` ships pointing at, so this
	// draws with no option set for it.
	add('1.2.0', { type: 'Release', version: '1.2.0', 'target-date': '2026-10-14', status: 'Planned' });
	// A SECOND release, on `Ship 1.0`'s own day — the case the first one cannot show and the
	// one a review found broken (PR #211): two full-height marks at one x drew two lines a
	// pixel apart and two opaque 140px labels on top of each other, so whichever pass ran
	// first lost its name outright. What is drawn now is ONE label naming both and the
	// release's line stepped aside by the scale's line width, and neither half of that is
	// visible where every mark stands alone. Dated by `target-date` like its sibling above.
	add('1.1.0', { type: 'Release', version: '1.1.0', 'target-date': '2026-09-30', status: 'Planned' });

	// Four unavailable stretches, which are the resources axis's second SOURCE and are not
	// work items at all — no parent, no rank, no state. One in a row that already has bars,
	// so a stretch reads against the work it crosses; one for a resource nobody is assigned
	// to and no roster names, which MINTS a row of its own, the case where an absence is the
	// only reason a row is on screen at all — also the case whose window the grid used to
	// size without it. One that has ENDED, the case the band header's readout must count as
	// nothing: a fixed past date rather than a today-relative one, so it stays past as the
	// clock moves. And a fourth, overlapping the offsite, so the harness draws a two-sub-lane
	// header — the case `packLanes` exists for.
	add('Dana is at the offsite', { type: 'Absence', assignee: 'Dana', start: '2026-08-10', due: '2026-08-14' });
	add('Sam is on leave', { type: 'Absence', assignee: 'Sam', start: '2026-09-01', due: '2026-09-18' });
	add('Dana was at a conference', { type: 'Absence', assignee: 'Dana', start: '2026-07-06', due: '2026-07-10' });
	add('Dana has a training week', { type: 'Absence', assignee: 'Dana', start: '2026-08-12', due: '2026-08-18' });

	// A parent the Base excludes, with a child it returns: the context row on screen.
	// Carries a risk, a priority and an assignee too, so the context row draws all three STATIC chips beside
	// the static state — and its name is one the menus must never offer to a result.
	add(OUTSIDE, { type: 'Epic', order: 30, status: 'Done', risk: '3 - Low', priority: '3 - Could', assignee: 'Dana' });
	add('Legacy importer', { type: 'Feature', order: 10, status: 'Ready' }, 'Retired platform');

	// Deliverables, on their own workflow: one per column so the fourth projection draws
	// a full board, hanging from three different rungs so the tree shows the pinned rank.
	// `Runbook` carries a requirements `status` as well as its own `docStatus`, which is
	// what the shared state column has to tell apart — it reads `In review` on the tree
	// beside rows reading their own workflow, and never `Done`.
	add('Onboarding guide', { type: 'Deliverable', order: 30, docStatus: 'Published', horizon: 'Now' }, 'Onboarding');
	add('Draft the copy', { type: 'Task', order: 10, status: 'Done' }, 'Onboarding guide');
	add('Auth sequence diagram', { type: 'Deliverable', order: 30, docStatus: 'In review' }, 'Sign-up flow');
	add('Runbook', { type: 'Deliverable', order: 40, docStatus: 'In review', status: 'Done' }, 'Billing');
	add('Pricing one-pager', { type: 'Deliverable', order: 50, docStatus: 'Draft', horizon: 'Next' });
	add('Brand refresh brief', { type: 'Deliverable', order: 60 });

	// The test catalog: its own ladder, so the fifth projection draws a real one and the
	// plan's four go on drawing none of it. A suite with two cases is the smallest fixture
	// that exercises the move section, whose every entry is defined by a visible NEIGHBOUR.
	add('Sign-up smoke tests', { type: 'Test suite', order: 60 });
	add('Register with an email address', { type: 'Test case', order: 10, status: 'Ready' }, 'Sign-up smoke tests');
	add('Register with a provider', { type: 'Test case', order: 20, status: 'Draft' }, 'Sign-up smoke tests');
	// A `Task` under a case: the row that belongs to the catalog by what it hangs from
	// rather than by its own name, and so the one that tells the membership rule from a
	// list of type names.
	add('Fix the provider redirect', { type: 'Task', order: 10, status: 'Active' }, 'Register with a provider');
	// A case with no `type` at all — drawn as a `Test case` and badged as an IMPLIED one,
	// which is where the test axis and `.pbl-implied` have to compose rather than collide.
	add('Resume an abandoned sign-up', { order: 30 }, 'Sign-up smoke tests');
	// The advisory mis-drag, both ways: a case parented to a PBI is drawn as a promoted
	// root of the catalog, and the PBI beneath a case is a promoted root of the plan. No
	// legal item is invisible in every projection, and this is the pair that shows it.
	add('Verify the rate limit', { type: 'Test case', order: 40 }, 'Single sign-on');

	// Neither typed nor dated nor triaged: the shelf's whole reason to exist.
	add('Spike: offline mode', { order: 40 });
	add('Accessibility sweep', { type: 'Issue', order: 50, status: 'New' });
	// Parentless and untriaged, which is two branches at once: a declared type belongs with
	// no parent at all, and the shelf groups by type, so a second extra type is what shows
	// its grouping and its type filter doing something rather than listing one name.
	add('Voice control', { type: 'Idea', order: 60 });

	// A PLAIN property column — a number Bases hands the view as a value rather than a
	// property this plugin knows anything about. Every column in `demoOrder()` before this
	// was one of ours (a chip, the tags cell), so the ordinary case — the one every vault
	// has and the one `renderCell` falls through to — drew in no fixture at all. Two rows
	// carry one and the rest do not, since an empty cell is what keeps the columns after it
	// from shifting and is the commonest face of any property column.
	vault.entryValues.set(pathIn(layout, 'Single sign-on', 'Onboarding/Sign-up flow/Use cases'), { 'note.points': 8 });
	vault.entryValues.set(pathIn(layout, 'Welcome tour', 'Onboarding'), { 'note.points': 3 });

	addBulk(add, extra);
	return vault;
}

/**
 * Where a note ENDED UP, which only the layout knows: the flat fixture files everything at
 * the root and the folder one nests each note inside its own folder under its parent's.
 * `entryValues` is keyed by path, so a value written against the flat path would silently
 * attach to nothing in the other layout — the cell would just be empty, which is a legal
 * thing for it to be and so not a failure anyone would see.
 */
function pathIn(layout: Layout, title: string, under: string): string {
	return layout === 'flat' ? `${title}.md` : `${under}/${title}/${title}.md`;
}

/**
 * A backlog's worth of generated notes, for asking the harness what the view COSTS at a
 * size no curated fixture is ever going to reach (`?notes=800`). Nothing here is worth
 * looking at; every case worth looking at is above.
 *
 * The shape is a backlog's rather than a list's — one Epic per 25, five Features under
 * it, PBIs and Tasks under those, and one Deliverable — because a flat thousand rows
 * measures a different render path from a tree that nests, and nesting is what a real
 * vault does. The Deliverable is there so that ALL FOUR projections grow with `?notes=`:
 * the fourth draws only its own type, so without one its row on the panel reported the
 * curated handful at every size while sitting beside three rows that scaled.
 *
 * The values ROTATE through the vocabularies `demoOptions()` declares, which is the
 * difference between measuring the projections and measuring their empty states: 800
 * untriaged notes would put every card on the shelf and in the no-state column, and the
 * board and the roadmap would be timed drawing almost nothing. One in seven is left
 * without a horizon anyway, so the shelf is populated rather than empty.
 *
 * Titles carry a prefix no curated note uses, so a test that finds a row by title cannot
 * be reached by one of these.
 */
function addBulk(add: ReturnType<typeof adder>, count: number): void {
	const states = ['New', 'Ready', 'Active', 'Review', 'Done'];
	const horizons = ['Now', 'Next', 'Later'];
	const docStates = ['Concept', 'Draft', 'In review', 'Published'];
	let epic = '';
	let feature = '';
	let pbi = '';
	for (let i = 0; i < count; i++) {
		const at = i % 25;
		const fm: Record<string, unknown> = {
			order: (i + 1) * 10,
			status: states[i % states.length],
			...(i % 7 === 0 ? {} : { horizon: horizons[i % horizons.length] }),
			start: bulkDate(i),
			// `i`, then twenty days on from THAT — never `bulkDate(i + 20)`, which wraps the
			// window and lands one note in six with a target before its own start. Those
			// read as unplaceable and go to the shelf, so a sixth of the roadmap sample
			// would have been measuring the shelf instead of the bars. (Codex, PR #128.)
			due: bulkDate(i, 20),
			...(i % 11 === 0 ? { risk: '2 - Medium' } : {}),
			...(i % 7 === 0 ? { priority: '1 - Must' } : {}),
			...(i % 13 === 0 ? { assignee: 'Dana' } : {}),
		};
		if (at === 0) add((epic = `Bulk epic ${i + 1}`), { ...fm, type: 'Epic' });
		else if (at % 5 === 1) add((feature = `Bulk feature ${i + 1}`), { ...fm, type: 'Feature' }, epic);
		else if (at % 5 === 2 || at % 5 === 3) add((pbi = `Bulk PBI ${i + 1}`), { ...fm, type: 'PBI' }, feature);
		// One per 25, on the OWN workflow the Deliverable state property declares — checked
		// before the task branch it would otherwise fall into. Without it the fourth
		// projection drew the same handful of curated cards at every size, so its row on the
		// panel sat beside three that scaled and implied a scale it had not been asked to
		// draw. A minority of the backlog, because that is what a Deliverable is.
		// (Codex, PR #128.)
		else if (at === 24) {
			add(`Bulk deliverable ${i + 1}`, { ...fm, type: 'Deliverable', docStatus: docStates[i % docStates.length] }, feature);
		} else add(`Bulk task ${i + 1}`, { ...fm, type: 'Task' }, pbi);
	}
}

/**
 * A civil date `i` days into the fixture's 120-day window, so generated bars spread
 * across it, plus `span` days — added AFTER the wrap, which is the whole point of the
 * second argument: a span folded into `i` comes back round to the start of the window and
 * states a target before its own start.
 */
function bulkDate(i: number, span = 0): string {
	return new Date(Date.UTC(2026, 6, 1 + (i % 120) + span)).toISOString().slice(0, 10);
}

/**
 * The results the Base hands the view — everything except the note above. A context row
 * cannot be built from a vault alone: it is the difference between what the vault holds
 * and what the query returned, so the fixture has to say which is which.
 */
export function demoResults(vault: FakeVault): ReturnType<FakeVault['entries']> {
	// By BASENAME, not by path: the same note is `Retired platform.md` in one layout and
	// `Retired platform/Retired platform.md` in the other, and which note the Base leaves
	// out is a fact about the backlog rather than about where the fixture filed it.
	return vault.entries().filter((entry) => entry.file.basename !== OUTSIDE);
}

/**
 * The cases that cannot live in `demoVault()` without wrecking it.
 *
 * A clipped bar needs the window to exceed `MAX_TIMELINE_DAYS`, which clamps the grid to
 * 1830 days around today — every other bar in the demo becomes a sliver. So the everyday
 * fixture keeps its job and this one takes the awkward cases, the same split the harness
 * already makes between projections with `?view=`.
 *
 * Deliberately small: it is a set of cases, not a second backlog.
 */
export function edgeCaseVault(): FakeVault {
	const vault = new FakeVault();
	const add = adder(vault, 'flat');
	add('Platform', { type: 'Epic', order: 10, status: 'Active' });
	// Clipped at BOTH edges regardless of what today is, so this fixture does not rot
	// with the calendar: an eight-year span always exceeds the 1830-day budget.
	add('The long migration', { type: 'PBI', order: 10, status: 'Active', start: '2022-01-01', due: '2030-12-31' }, 'Platform');
	// Ordinary, inside the clamped window, so the clipped bar has something to be
	// compared against and something legal to be dragged onto.
	add('Nearby work', { type: 'PBI', order: 20, status: 'New', start: '2026-08-04', due: '2026-08-28' }, 'Platform');
	add('One day only', { type: 'PBI', order: 30, status: 'Ready', start: '2026-08-12', due: '2026-08-12' }, 'Platform');

	// Three rollup labels of three different WIDTHS, side by side under one parent,
	// because the rollup column is a fixed lane and a label that outgrows it moves the
	// bar rather than being clipped — reported from a vault of 800-odd PBIs (2026-08-15),
	// where the bars of `x/y`, `xx/yy` and `xxx/yyy` rows do not line up.
	//
	// Nothing generated reaches this: `addBulk` nests one Epic per 25 notes, so the widest
	// label at ANY `?notes=` is two digits over two, and the case was unreachable in the
	// harness at every size. Under 'Counts' rather than 'Platform' so the timeline cases
	// above keep a readable grid.
	// The malformed and the unvocabularied, which are what a real vault produces by hand
	// and no configured fixture has: a parent link naming a note nothing resolves to, a
	// `type` the vocabulary does not carry, a state outside the declared workflow and a
	// horizon outside the declared buckets. Each draws its own mark — the orphan glyph, the
	// unknown badge, a stray board column, an undeclared bucket — and every one of them was
	// unreachable in the harness before 2026-08-15, so the marks could be read only in a
	// vault that already had the mess.
	add('Imported from the old tracker', { type: 'PBI', order: 40, status: 'Blocked', horizon: 'Someday' }, 'No such epic');
	add('Untyped leftovers', { order: 50, status: 'Blocked' }, 'Platform');
	add('Crash on empty title', { type: 'Bug', order: 60, status: 'Active' }, 'Platform');
	add('Filed under a word nobody declared', { type: 'Curiosity', order: 70, horizon: 'Someday' }, 'Platform');

	add('Counts', { type: 'Epic', order: 20, status: 'Active' });
	add('Three deep', { type: 'Feature', order: 10, status: 'Active' }, 'Counts');
	add('Ten deep', { type: 'Feature', order: 20, status: 'Active' }, 'Counts');
	add('A hundred and twenty deep', { type: 'Feature', order: 30, status: 'Active' }, 'Counts');
	for (const [parent, count] of [
		['Three deep', 3],
		['Ten deep', 10],
		['A hundred and twenty deep', 120],
	] as const) {
		for (let i = 1; i <= count; i += 1) {
			// A third of each group done, so the FILL differs between the three as well as
			// the label — a bar that has moved and a bar that is a different length are two
			// different complaints, and one fixture should be able to tell them apart.
			add(`${parent} ${i}`, { type: 'PBI', order: i * 10, status: i % 3 === 0 ? 'Done' : 'Active' }, parent);
		}
	}
	return vault;
}

/**
 * The estimation view's own thirteen write targets, all bound, plus a WIDENED range on
 * one dimension so `.pbl-est-points` has something to wrap — the shipped 1-5 default
 * never spills past one row of buttons. `estimationVault()` below is the notes this
 * configures against, and it is a NAMED VARIANT rather than more properties on the
 * backlog's own notes — this file's own header rule ("or a named variant if it would
 * distort the backlog fixtures"): a stale total, a foreign stamp, an orphan and a
 * clamped answer say nothing about the backlog `demoVault()` exists to draw, and the
 * estimation view reads none of `demoVault()`'s notes anyway — it is a second Bases
 * view, mounted on its own, never the tree/board/roadmap's projections of one backlog.
 * `edgeCaseVault()`'s reasoning below, applied to a second, unrelated view.
 */
export function estimationOptions(): Record<string, unknown> {
	return {
		valueProperty: 'note.business-value',
		stampProperty: 'note.business-value-model',
		'dimProperty.strategic-alignment': 'note.strategic-alignment',
		'dimProperty.customer-value': 'note.customer-value',
		'dimProperty.business-impact': 'note.business-impact',
		'dimProperty.reach': 'note.reach',
		'dimProperty.risk-reduction': 'note.risk-reduction',
		'dimProperty.compliance': 'note.compliance',
		'dimProperty.time-criticality': 'note.time-criticality',
		'dimProperty.enablement': 'note.enablement',
		confidenceProperty: 'note.confidence',
		effortProperty: 'note.effort',
		complexityProperty: 'note.complexity',
		'dimRange.enablement': '1-12',
		...Object.fromEntries(ENABLEMENT_WIDE_RUBRIC.map((sentence, i) => [`dimRubric.enablement.${i + 1}`, sentence])),
	};
}

/** Twelve sentences for `enablement`'s widened range — `modelProblems` refuses a range
 *  whose rubric is shorter than its point count, so a wide range needs one per point
 *  rather than falling back to the shipped five. */
const ENABLEMENT_WIDE_RUBRIC: string[] = [
	'No dependencies at all',
	'Minor dependencies',
	'A few optional dependents',
	'Enables a couple of related items',
	'Enables several items',
	'Enables many items',
	'Meaningful platform capability',
	'Significant platform capability',
	'Broad platform capability',
	'Foundational prerequisite for one major capability',
	'Foundational prerequisite for several capabilities',
	'Foundational prerequisite for everything the roadmap depends on',
];

/**
 * Eleven notes, each one state the estimation view's own vocabulary needs to be looked
 * at whole — the currency word end to end (current, stale, foreign, handwritten, orphan,
 * none), the clamp note, the between-points note, and the derived-line guards for a
 * zero and a negative effort. Flat and parentless: this view builds no tree and reads
 * every result straight off `vault.entries()`, so there is nothing here for `parent` or
 * `order` to do.
 *
 * The stamps are computed through the real `resolveEstimationSettings` /
 * `computeTotal` / `stampValue`, against the SAME `estimationOptions()` the harness
 * configures the view with — the one way to hand-author a "current" or a "stale" note
 * without silently drifting from what the real model would compute for it.
 */
export function estimationVault(): FakeVault {
	const vault = new FakeVault();
	const model = resolveEstimationSettings(new FakeViewConfig(estimationOptions())).model;

	const FULL: Record<string, number> = {
		'strategic-alignment': 5,
		'customer-value': 4,
		'business-impact': 4,
		reach: 3,
		'risk-reduction': 2,
		compliance: 1,
		'time-criticality': 4,
		enablement: 3,
	};

	// The 8/8 profile: scored, stamped and matching, so `currencyOf` reads it 'current'.
	// The only note with a positive effort, so it is also where the adjusted-value and
	// value-to-effort derived lines are on screen at all — and, whichever note is
	// selected, `enablement`'s widened range draws on every panel, so this is also
	// where the wrapped row is looked at.
	const full = computeTotal(model, new Map(Object.entries(FULL)))!;
	vault.addFile('Full profile.md', {
		frontmatter: {
			...FULL,
			confidence: 4,
			effort: 3,
			complexity: 2,
			'business-value': full.total,
			'business-value-model': stampValue(model, full.coverage),
		},
	});

	// 3 of 8, nothing stored yet — the coverage cell reads "3/8" beside an empty total.
	vault.addFile('Partial profile.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3, reach: 2 } });

	// Nothing answered at all — coverage, total and currency all draw the empty dash.
	vault.addFile('Nothing answered.md', { frontmatter: {} });

	// Scored and stamped from FULL, then one answer changed afterwards: the coverage
	// count still matches (8/8), so the stamp's own fingerprint still resolves — only
	// the TOTAL disagrees, which is what makes this stale rather than foreign.
	const stale = computeTotal(model, new Map(Object.entries(FULL)))!;
	vault.addFile('Stale total.md', {
		frontmatter: {
			...FULL,
			'customer-value': 2,
			'business-value': stale.total,
			'business-value-model': stampValue(model, stale.coverage),
		},
	});

	// A well-formed stamp naming a fingerprint no model here produced.
	vault.addFile('Foreign stamp.md', { frontmatter: { ...FULL, 'business-value': 61, 'business-value-model': '8/8 deadbeef' } });

	// A total with no stamp key at all — typed by hand rather than written by this view.
	vault.addFile('Hand-written total.md', { frontmatter: { 'strategic-alignment': 4, 'business-value': 72 } });

	// A total (and a stamp) with every scored key since deleted out of band — the
	// inputs are gone, so `item.result` is null and this reads 'orphan' regardless of
	// what the stamp says.
	vault.addFile('Orphan total.md', { frontmatter: { 'business-value': 50, 'business-value-model': '0/8 deadbeef' } });

	// Answered past its own declared range (1-5) — clamps to 5 and reports it.
	vault.addFile('Out-of-range answer.md', { frontmatter: { 'strategic-alignment': 9, 'customer-value': 3 } });

	// Answered BETWEEN two points — counted as it stands, named as a fraction rather
	// than clamped.
	vault.addFile('Fractional score.md', { frontmatter: { 'customer-value': 3.5, reach: 2 } });

	// Effort 0 — the value-to-effort line's own guard: a stored zero would divide into
	// `Infinity`, so the line is omitted rather than shown.
	vault.addFile('Zero effort.md', { frontmatter: { 'strategic-alignment': 4, confidence: 3, effort: 0 } });

	// A negative effort — the same guard, the other side of zero.
	vault.addFile('Negative effort.md', { frontmatter: { 'strategic-alignment': 4, confidence: 3, effort: -2 } });

	return vault;
}
