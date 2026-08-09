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
		deliverableStateProperty: 'note.docStatus',
		deliverableStateValues: 'Concept, Draft, In review, Published',
		deliverableDoneValues: 'Published',
		showProperties: false,
	};
}

/**
 * The notes. Two live epics with real subtrees, one epic outside the filter parenting a
 * feature that is inside it, a scattering of items with no state, no horizon and no
 * dates (which is what puts cards on the shelf and in the no-state column), and one
 * milestone for the line across the plan.
 */
export function demoVault(): FakeVault {
	const vault = new FakeVault();
	const add = (title: string, frontmatter: Record<string, unknown>, parent?: string) =>
		vault.addFile(`${title}.md`, { frontmatter, parentLink: parent });

	add('Onboarding', { type: 'Epic', order: 10, status: 'Active', horizon: 'Now', start: '2026-07-01', due: '2026-09-30' });
	add('Sign-up flow', { type: 'Feature', order: 10, status: 'Active', horizon: 'Now', start: '2026-07-01', due: '2026-08-20' }, 'Onboarding');
	add('Email and password', { type: 'PBI', order: 10, status: 'Done', started: '2026-07-02', finished: '2026-07-18', horizon: 'Now' }, 'Sign-up flow');
	add('Validate the address', { type: 'Task', order: 10, status: 'Done' }, 'Email and password');
	add('Rate-limit the endpoint', { type: 'Task', order: 20, status: 'Done' }, 'Email and password');
	add('Single sign-on', { type: 'PBI', order: 20, status: 'Review', started: '2026-07-20', horizon: 'Now', start: '2026-07-20', due: '2026-08-15' }, 'Sign-up flow');
	add('Provider handshake', { type: 'Task', order: 10, status: 'Active' }, 'Single sign-on');
	add('Token refresh', { type: 'Task', order: 20 }, 'Single sign-on');
	add('Welcome tour', { type: 'Feature', order: 20, status: 'Ready', horizon: 'Next' }, 'Onboarding');
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
	add('Offline-first sync', { type: 'Idea', order: 30, status: 'Active', horizon: 'Next', start: '2026-08-10', due: '2026-10-15', dependsOn: '[[Single sign-on]]' }, 'Onboarding');
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
	// SHELVED with a stated, readable start (its target precedes it), and its prerequisite
	// runs past that start — `Arrows between bars` 2b: a conflict stated on the shelf card
	// with no arrow drawn, since a shelved dependent has no bar to carry one.
	add('Dunning emails', { type: 'PBI', order: 20, start: '2026-08-05', due: '2026-07-01', dependsOn: '[[Sign-up flow]]' }, 'Invoicing');
	// An extra type at the DEEPEST legal parent, drawn level with the two PBIs above it.
	add('Usage-based pricing', { type: 'Idea', order: 30, status: 'New', horizon: 'Later' }, 'Invoicing');
	// Names a note this base does not have: BROKEN (1d). No arrow, and the row carries the
	// glyph — the case that used to be visible to a screen reader and to nobody else.
	add('Ship 1.0', { type: 'Milestone', order: 30, due: '2026-09-30', dependsOn: 'Contract signed' }, 'Billing');

	// A parent the Base excludes, with a child it returns: the context row on screen.
	vault.addFile(OUTSIDE, { frontmatter: { type: 'Epic', order: 30, status: 'Done' } });
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

	// Neither typed nor dated nor triaged: the shelf's whole reason to exist.
	add('Spike: offline mode', { order: 40 });
	add('Accessibility sweep', { type: 'Issue', order: 50, status: 'New' });
	// Parentless and untriaged, which is two branches at once: a declared type belongs with
	// no parent at all, and the shelf groups by type, so a second extra type is what shows
	// its grouping and its type filter doing something rather than listing one name.
	add('Voice control', { type: 'Idea', order: 60 });

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
	const add = (title: string, frontmatter: Record<string, unknown>, parent?: string) =>
		vault.addFile(`${title}.md`, { frontmatter, parentLink: parent });

	add('Platform', { type: 'Epic', order: 10, status: 'Active' });
	// Clipped at BOTH edges regardless of what today is, so this fixture does not rot
	// with the calendar: an eight-year span always exceeds the 1830-day budget.
	add('The long migration', { type: 'PBI', order: 10, status: 'Active', start: '2022-01-01', due: '2030-12-31' }, 'Platform');
	// Ordinary, inside the clamped window, so the clipped bar has something to be
	// compared against and something legal to be dragged onto.
	add('Nearby work', { type: 'PBI', order: 20, status: 'New', start: '2026-08-04', due: '2026-08-28' }, 'Platform');
	add('One day only', { type: 'PBI', order: 30, status: 'Ready', start: '2026-08-12', due: '2026-08-12' }, 'Platform');
	return vault;
}
