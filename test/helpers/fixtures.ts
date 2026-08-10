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
import { FakeVault } from './vault';

/** The one note the Base does not return — the parent that renders as a context row. */
const OUTSIDE = 'Retired platform.md';

/** Add a note to `vault`, the one shape every fixture below builds a backlog out of. */
function add(vault: FakeVault, title: string, frontmatter: Record<string, unknown>, parent?: string): void {
	vault.addFile(`${title}.md`, { frontmatter, parentLink: parent });
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
	return ['note.status', 'note.horizon', 'note.risk', 'note.tags'];
}

/**
 * The notes. Two live epics with real subtrees, one epic outside the filter parenting a
 * feature that is inside it, a scattering of items with no state, no horizon and no
 * dates (which is what puts cards on the shelf and in the no-state column), and one
 * milestone for the line across the plan.
 */
export function demoVault(): FakeVault {
	const vault = new FakeVault();
	add(vault, 'Onboarding', { type: 'Epic', order: 10, status: 'Active', horizon: 'Now', start: '2026-07-01', due: '2026-09-30' });
	add(vault, 'Sign-up flow', { type: 'Feature', order: 10, status: 'Active', horizon: 'Now', start: '2026-07-01', due: '2026-08-20' }, 'Onboarding');
	add(vault, 'Email and password', { type: 'PBI', order: 10, status: 'Done', started: '2026-07-02', finished: '2026-07-18', horizon: 'Now' }, 'Sign-up flow');
	add(vault, 'Validate the address', { type: 'Task', order: 10, status: 'Done' }, 'Email and password');
	add(vault, 'Rate-limit the endpoint', { type: 'Task', order: 20, status: 'Done' }, 'Email and password');
	// The three risk cases the chip has to draw, on rows that sit near each other: a level
	// from the declared list here, one the list does not name on `Offline-first sync`, and
	// every other row unjudged — which is the dashed, inviting chip and the commonest face.
	add(vault, 'Single sign-on', { type: 'PBI', order: 20, status: 'Review', started: '2026-07-20', horizon: 'Now', start: '2026-07-20', due: '2026-08-15', risk: '1 - High' }, 'Sign-up flow');
	add(vault, 'Provider handshake', { type: 'Task', order: 10, status: 'Active' }, 'Single sign-on');
	add(vault, 'Token refresh', { type: 'Task', order: 20 }, 'Single sign-on');
	add(vault, 'Welcome tour', { type: 'Feature', order: 20, status: 'Ready', horizon: 'Next' }, 'Onboarding');
	// Dated while its parent is not, so `Welcome tour` draws an INFERRED bar: outlined,
	// no grips at all, and still a connector — a link claims no date, so it needs no
	// baseline the way a grip does.
	add(vault, 'Highlight the sidebar', { type: 'PBI', order: 10, status: 'New', horizon: 'Next', start: '2026-08-24', due: '2026-09-05' }, 'Welcome tour');
	add(vault, 'Skip and resume', { type: 'PBI', order: 20 }, 'Welcome tour');
	// An extra type at the SHALLOWEST legal parent, and the one place the pinned rank is
	// visible rather than merely true: it sits among Features and its child is a Task, the
	// rung two below the Epic holding it. Dated, so an extra type draws a bar as well.
	// Waits for `Single sign-on`, which ends 08-15 — after this one starts. A CONFLICT
	// arrow, and the marker on this row.
	add(vault, 'Offline-first sync', { type: 'Idea', order: 30, status: 'Active', horizon: 'Next', start: '2026-08-10', due: '2026-10-15', dependsOn: '[[Single sign-on]]', risk: 'Existential' }, 'Onboarding');
	add(vault, 'Survey the storage APIs', { type: 'Task', order: 10, status: 'Active' }, 'Offline-first sync');
	// A bar exactly one day wide — start and target on the same date, an ordinary PBI
	// rather than a Milestone, so it draws the diamond from its GEOMETRY. The case where
	// a bar is narrower than its own handles, and both the end grip and the connector
	// still have to be reachable.
	add(vault, 'Cut the release branch', { type: 'PBI', order: 40, status: 'Ready', start: '2026-09-14', due: '2026-09-14' }, 'Sign-up flow');
	// The second hop of a chain: this waits for `Offline-first sync`, which waits for
	// `Single sign-on`. Dragging from here, `Single sign-on` must be refused THROUGH the
	// chain and not merely as a direct neighbour — the transitive half of the rule, in
	// the picture rather than only in a unit test.
	add(vault, 'Sync conflict UX', { type: 'PBI', order: 50, status: 'New', start: '2026-10-20', due: '2026-11-30', dependsOn: '[[Offline-first sync]]' }, 'Onboarding');

	// Waits for `Sign-up flow`, which ends 08-20 — well before this starts. The ORDINARY
	// arrow, so the picture has one of each rather than only the loud one.
	add(vault, 'Billing', { type: 'Epic', order: 20, status: 'New', horizon: 'Later', start: '2026-10-01', due: '2027-01-31', dependsOn: '[[Sign-up flow]]' });
	add(vault, 'Invoicing', { type: 'Feature', order: 10, status: 'New', horizon: 'Later' }, 'Billing');
	add(vault, 'Monthly statement', { type: 'PBI', order: 10, status: 'New' }, 'Invoicing');
	// SHELVED with a stated, readable start (its target precedes it), and its prerequisite
	// runs past that start — `Arrows between bars` 2b: a conflict stated on the shelf card
	// with no arrow drawn, since a shelved dependent has no bar to carry one.
	add(vault, 'Dunning emails', { type: 'PBI', order: 20, start: '2026-08-05', due: '2026-07-01', dependsOn: '[[Sign-up flow]]' }, 'Invoicing');
	// An extra type at the DEEPEST legal parent, drawn level with the two PBIs above it.
	add(vault, 'Usage-based pricing', { type: 'Idea', order: 30, status: 'New', horizon: 'Later' }, 'Invoicing');
	// A MILESTONE, and its dependency case is the one that survives the type's rule: a
	// milestone waits for nothing, so it declares nothing — but it may be waited FOR, and
	// `Launch checklist` below is what waits on it. Its own `dependsOn` is deliberately
	// absent rather than present-and-ignored: the fixture draws what the view supports.
	add(vault, 'Ship 1.0', { type: 'Milestone', order: 30, due: '2026-09-30' }, 'Billing');
	// Waits on that milestone — the arrow INTO a diamond, which is the direction a
	// milestone still takes part in. Also names a note this base does not have, so it
	// carries the BROKEN case (1d) too: no arrow for that entry, and the row's glyph.
	// That case lived on `Ship 1.0` until milestones stopped declaring anything.
	add(
		vault,
		'Launch checklist',
		{ type: 'PBI', order: 40, status: 'New', start: '2026-10-05', due: '2026-10-20', dependsOn: ['[[Ship 1.0]]', 'Contract signed'] },
		'Billing',
	);

	// A parent the Base excludes, with a child it returns: the context row on screen.
	// Carries a risk too, so the context row draws the STATIC chip beside the static state.
	vault.addFile(OUTSIDE, { frontmatter: { type: 'Epic', order: 30, status: 'Done', risk: '3 - Low' } });
	add(vault, 'Legacy importer', { type: 'Feature', order: 10, status: 'Ready' }, 'Retired platform');

	// Deliverables, on their own workflow: one per column so the fourth projection draws
	// a full board, hanging from three different rungs so the tree shows the pinned rank.
	// `Runbook` carries a requirements `status` as well as its own `docStatus`, which is
	// what the shared state column has to tell apart — it reads `In review` on the tree
	// beside rows reading their own workflow, and never `Done`.
	add(vault, 'Onboarding guide', { type: 'Deliverable', order: 30, docStatus: 'Published', horizon: 'Now' }, 'Onboarding');
	add(vault, 'Draft the copy', { type: 'Task', order: 10, status: 'Done' }, 'Onboarding guide');
	add(vault, 'Auth sequence diagram', { type: 'Deliverable', order: 30, docStatus: 'In review' }, 'Sign-up flow');
	add(vault, 'Runbook', { type: 'Deliverable', order: 40, docStatus: 'In review', status: 'Done' }, 'Billing');
	add(vault, 'Pricing one-pager', { type: 'Deliverable', order: 50, docStatus: 'Draft', horizon: 'Next' });
	add(vault, 'Brand refresh brief', { type: 'Deliverable', order: 60 });

	// The test catalog: its own ladder, so the fifth projection draws a real one and the
	// plan's four go on drawing none of it. A suite with two cases is the smallest fixture
	// that exercises the move section, whose every entry is defined by a visible NEIGHBOUR.
	add(vault, 'Sign-up smoke tests', { type: 'Test suite', order: 60 });
	add(vault, 'Register with an email address', { type: 'Test case', order: 10, status: 'Ready' }, 'Sign-up smoke tests');
	add(vault, 'Register with a provider', { type: 'Test case', order: 20, status: 'Draft' }, 'Sign-up smoke tests');
	// A `Task` under a case: the row that belongs to the catalog by what it hangs from
	// rather than by its own name, and so the one that tells the membership rule from a
	// list of type names.
	add(vault, 'Fix the provider redirect', { type: 'Task', order: 10, status: 'Active' }, 'Register with a provider');
	// A case with no `type` at all — drawn as a `Test case` and badged as an IMPLIED one,
	// which is where the test axis and `.pbl-implied` have to compose rather than collide.
	add(vault, 'Resume an abandoned sign-up', { order: 30 }, 'Sign-up smoke tests');
	// The advisory mis-drag, both ways: a case parented to a PBI is drawn as a promoted
	// root of the catalog, and the PBI beneath a case is a promoted root of the plan. No
	// legal item is invisible in every projection, and this is the pair that shows it.
	add(vault, 'Verify the rate limit', { type: 'Test case', order: 40 }, 'Single sign-on');

	// Neither typed nor dated nor triaged: the shelf's whole reason to exist.
	add(vault, 'Spike: offline mode', { order: 40 });
	add(vault, 'Accessibility sweep', { type: 'Issue', order: 50, status: 'New' });
	// Parentless and untriaged, which is two branches at once: a declared type belongs with
	// no parent at all, and the shelf groups by type, so a second extra type is what shows
	// its grouping and its type filter doing something rather than listing one name.
	add(vault, 'Voice control', { type: 'Idea', order: 60 });

	return vault;
}

/**
 * The results the Base hands the view — everything except the note above. A context row
 * cannot be built from a vault alone: it is the difference between what the vault holds
 * and what the query returned, so the fixture has to say which is which.
 */
export function demoResults(vault: FakeVault): ReturnType<FakeVault['entries']> {
	return vault.entries().filter((entry) => entry.file.path !== OUTSIDE);
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
	add(vault, 'Platform', { type: 'Epic', order: 10, status: 'Active' });
	// Clipped at BOTH edges regardless of what today is, so this fixture does not rot
	// with the calendar: an eight-year span always exceeds the 1830-day budget.
	add(vault, 'The long migration', { type: 'PBI', order: 10, status: 'Active', start: '2022-01-01', due: '2030-12-31' }, 'Platform');
	// Ordinary, inside the clamped window, so the clipped bar has something to be
	// compared against and something legal to be dragged onto.
	add(vault, 'Nearby work', { type: 'PBI', order: 20, status: 'New', start: '2026-08-04', due: '2026-08-28' }, 'Platform');
	add(vault, 'One day only', { type: 'PBI', order: 30, status: 'Ready', start: '2026-08-12', due: '2026-08-12' }, 'Platform');
	return vault;
}
