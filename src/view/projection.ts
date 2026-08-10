import { inCatalog, isDeliverableType, ladderFor } from '../domain/itemTypes';
import { BacklogItem, BacklogModel, ProjectionPopulation } from '../domain/model';
import { BacklogViewHost, Projection } from './host';
import { ALL_TYPES } from '../domain/typeVocabulary';

/**
 * What a projection IS, asked rather than compared — the three questions every gate in
 * the view used to answer with an equality check against one name.
 *
 * A projection added beside `'tree'` rather than *as* a tree fails each of those gates
 * silently and differently, which is why they are here and not spelled where they are
 * asked: no column fitting, no refit on resize, the fit classes cleared as though this
 * were a card projection, two dead toolbar buttons, and a row menu with no Move
 * up/down/top/bottom and no indent or outdent — on a tree whose whole point is an order
 * somebody chose. A lint rule (`no-restricted-syntax`) forbids a bare
 * `projection === 'tree'` outside this file, so the predicate holds for a gate nobody has
 * written yet rather than merely existing beside the ones that do.
 *
 * It is its own module rather than a pair of functions on `host.ts`, which stays free of
 * runtime code so imports cannot cycle.
 */

/**
 * Which forest a question is asked about. **Not a preference — the two surfaces are
 * asking about different populations**, and one index cannot answer for both.
 *
 * `focused` is the rendered forest (`model.roots`), which a focus level narrows: the
 * tree, the requirements board and the roadmap all render out of it. `whole` is the
 * entire tree (`model.realRoots`), which is what the Deliverables board's population
 * (`model.deliverableResults`) is built from — deliberately focus-immune, so that a
 * focus set on another projection can never hide a Deliverable there.
 *
 * This started as one index that the Deliverables board also consulted, and it took
 * three separate fixes to keep patching the gap: the out-of-focus Deliverable that was
 * never indexed, then its matching ANCESTOR that was not either, then a focused row
 * BELOW one that the patch wrote to and should not have. Each fix was correct and each
 * was one case short, because a single set was being asked two questions. Two indexes
 * over one rule cannot drift: neither is a special case of the other, and neither can
 * write into the other.
 */
export type FilterScope = 'focused' | 'whole';

/** Whether this projection draws ROWS — indentation, disclosure, a rank somebody chose. */
export function treeShaped(projection: Projection): boolean {
	return projection === 'tree' || projection === 'catalog';
}

/**
 * Whether this projection hides fully-done subtrees. Two opt out, and it is now ONE reason
 * rather than two: what this hides is `subtreeDone`, which is the REQUIREMENTS rollup —
 * `item.done`, read through `settings.stateKey` against `settings.doneValues`, times a
 * descendant count. Neither board nor catalog tracks its item's completion that way. The
 * Deliverables board's cards answer through the Deliverable workflow; a catalog row answers
 * through the test workflow (`ownWorkflowReading`), and `assignAll` counts a child only
 * where child and parent are both plan rows, so a catalog row's rollup halves are always
 * zero and `subtreeDone` degenerates to that row's requirements flag.
 *
 * Tests DO have states, and a done one styles its row `pbl-done` (`render/rows.ts`, through
 * `ownWorkflowReading`) — so this is not "there is nothing to hide". It is that hiding here
 * would hide by a flag this projection neither reads nor draws, which agrees with the test
 * workflow only for as long as the two keys are the same property. Do not enable the
 * filtering on the grounds that the states arrived; the missing thing is a subtree
 * completion, and `docs/requirements/Tests stay out of the plan.md` 3c priced that pass and
 * declined it.
 *
 * Both also withhold the button, and this is the other half of that rather than a
 * duplicate of it: a toggle withheld while its filtering stays on is the worst of both,
 * since a row disappears and nothing on screen offers to bring it back. A projection
 * opting out of a feature opts out of the COMPUTATION, not just the control.
 */
export function hidesCompleted(projection: Projection): boolean {
	return projection !== 'deliverables' && projection !== 'catalog';
}

/**
 * Whether THIS projection's rendered forest is a synthetic focus grouping.
 *
 * `model.focused` is one flag for the whole model, and the catalog is built from the
 * UNFOCUSED tree — so a focus stored for the plan leaves that flag true while the catalog
 * draws every suite. Anything gated on it would then be wrong here in the direction that
 * looks like a working screen: the pane wears `pbl-focused`, and `rootDropTarget` refuses
 * every drop, so a mis-parented case cannot be repaired at the catalog root until the user
 * goes back to a plan projection and clears a focus they never set here.
 *
 * This is the third time on this feature that withholding a CONTROL did not disable its
 * BEHAVIOUR — the completed toggle, the focus button, and now the narrowing behind it. The
 * rule to carry into any fourth: a projection opting out of a feature opts out of the
 * computation, not just the button.
 */
export function effectivelyFocused(projection: Projection, model: BacklogModel): boolean {
	return model.focused && projection !== 'catalog';
}

/**
 * The population this projection draws — its rendered roots, every row beneath them, and
 * the results among those.
 *
 * The catalog and the plan each publish one, computed by the same rule with opposite
 * membership predicates (`projectionForest`, `domain/model.ts`). The three card
 * projections draw the plan's, because they narrow it further themselves — the
 * Deliverables board to `deliverableResults`, the requirements board and the roadmap by
 * their own rules — and none of them roots a tree.
 *
 * Every consumer that walks the tree from its roots to decide what the user SEES or ACTS
 * ON takes this: the renderer, the quick filter's match index, the keyboard's visible-row
 * walk, the drop targets, the indent/outdent sibling lists, and which roots a new one is
 * created among. A consumer left on `model.roots` does not fail visibly — it disagrees
 * with the screen, which is the failure this rule exists to prevent, arriving one surface
 * at a time.
 *
 * What it is NOT is the ranking group. An `order` is a number scoped to the notes sharing
 * a parent, and a `Test suite` and an `Epic` share the null one — so what number a new
 * root gets, and which notes a renumber rewrites, come from `model.realRoots` and no
 * projection may narrow that. Three lists, and conflating any two of them breaks
 * something; see `docs/requirements/A projection for the tests.md` 2d.
 */
export function projectionPopulation(projection: Projection, model: BacklogModel): ProjectionPopulation {
	if (projection === 'catalog') return model.catalog;
	return model;
}

/**
 * Whether this projection draws this item — the membership rule, read from whichever
 * direction the caller happens to be facing, so the catalog and the plan cannot both
 * claim a row or both disown one.
 *
 * It is asked in `rowHidden` beside the quick filter and the completed toggle rather than
 * at each surface, and that placement is what makes the rest of this feature small: the
 * renderer, the keyboard's move targets, the board's cards, the roadmap's rows and every
 * count measured against them all consult that one predicate already. A membership test
 * added per surface is the shape that leaves the sixth one behind.
 *
 * It is NOT how a projection finds its ROOTS. Hiding a row does not lift its children —
 * `renderForest` drops a hidden sibling without descending through it — so the forest is
 * computed (`projectionForest`) and this hides what is left inside it: a `PBI` mis-dragged
 * under a `Test case` is a catalog root's child, hidden here, and a root of the plan's own
 * forest over there.
 */
export function projectionMember(projection: Projection): (item: { ladder: string[] }) => boolean {
	return projection === 'catalog' ? inCatalog : (item) => !inCatalog(item);
}

/**
 * Whose vocabulary a ROW's menus offer — the population that row belongs to.
 *
 * Per ROW rather than per projection, because both directions of it are wrong the other
 * way round. Scoped to the plan alone, one test on `Ready` with no plan row on `Ready`
 * would put `Ready` out of reach for every other test. Shared between the two, a `Task`
 * beneath a `Test case` carrying a status nothing in the plan uses would mint a board
 * column no plan card can ever land in. The two criteria are each other's failure mode.
 *
 * `model` and `model.catalog` both carry the same three `observed*` lists, so this is one
 * ternary rather than a lookup: the plan's are collected from the whole tree minus the
 * catalog and the catalog's from its own whole population, both unfocused, so neither
 * narrows with what is on screen.
 */
export function rowVocabulary(model: BacklogModel, item: BacklogItem): ProjectionPopulation | BacklogModel {
	return inCatalog(item) ? model.catalog : model;
}

/**
 * Which of `types` this projection may offer, for every surface that offers one —
 * `Set type`, a row's `New <child>`, and (through this same function) the toolbar's two
 * creators.
 *
 * The rule is one sentence and it cuts BOTH ways: **a projection offers only the types
 * it can show.** The requirements board excludes Deliverables
 * (`renderRequirementsBoard`), so it withholds that one; the Deliverables board shows
 * nothing else (`renderDeliverablesBoard`), so it withholds every other — including a
 * Deliverable card's `New Task`, which would write a note that vanishes on the pass that
 * created it. Withheld, not disabled — the "absent rather than inert" rule the state
 * chip and the axis actions already follow. The tree and the roadmap show everything and
 * narrow nothing. A new surface that offers a type calls this rather than reading
 * `ALL_TYPES` or `childTypeChoices` straight.
 */
export function offerableTypes(host: BacklogViewHost, types: string[] = ALL_TYPES, row: BacklogItem | null = null): string[] {
	// The two boards narrow by TYPE, and they do it on every path — a row's own `+`
	// included, since an Epic card on the requirements board offering `New Deliverable` is
	// the same broken creation this function exists to close.
	const projected = byProjectionType(host.projection, types);
	// A row's own `+` is already right in both directions and must not be touched: its
	// vocabulary is `childTypeChoices(item)`, whose answers are catalog members under a
	// test and never a test type under a plan row. Filtering it again by the rule below
	// would EMPTY the `+` on a `Test case`, whose one choice is `Task` — a plan type by
	// name. The two paths have to be told apart, and `types` is what tells them apart.
	if (types !== ALL_TYPES) return projected;

	// The catalog cuts both ways like the two boards, and it is the first one
	// where the answer is not a filter over type NAMES. `Task` is the whole reason: created
	// UNDER a test it is a catalog item, created with no parent it falls back to its own
	// type's ladder and lands in the plan — the same name, answered differently by whether
	// a parent is in hand.
	//
	// So the question is MEMBERSHIP AFTER THE WRITE, never the type's name, and asking it
	// of the row's own parent answers every caller from one rule. `Set type` is the one
	// that needs a row; the top-level creator, the primary button's default and the focus
	// picker pass none, and a null parent ladder is exactly what "at the top level" means.
	//
	// Two rows show why a projection-wide list of names is wrong in OPPOSITE directions.
	// A `PBI` dragged under a test is drawn in the plan as a promoted root; `Task` is a
	// plan type by name, so a name-based list offers it — and retyping makes the row
	// inherit its test parent's membership and vanish into the catalog. Withheld here. A
	// `Test case` under a `Test suite` is the mirror: `Task` is not a test type, so a
	// catalog-wide list of test types would withhold it — and retyping that row leaves it
	// in the catalog under the same suite. Offered here.
	//
	// It COMPOSES with the type narrowing above rather than replacing it, and that is the
	// bug this shape was written to fix: the board's early return meant every
	// whole-vocabulary caller there still offered `Test suite` and `Test case` — a New
	// menu creating a note that vanished into the catalog on the pass that made it, a
	// Set type moving a card off the screen it was acted on, and a focus picker offering
	// a type that emptied the board. The requirements board is a PLAN projection first and
	// a Deliverable-less one second; the two narrowings are both true of it.
	const wanted = host.projection === 'catalog';
	return projected.filter((t) => inCatalog({ ladder: ladderFor(t, row?.parent?.ladder ?? null) }) === wanted);
}

/** The two boards' own narrowing: one shows no Deliverable, the other shows nothing else. */
function byProjectionType(projection: Projection, types: string[]): string[] {
	if (projection === 'board') return types.filter((type) => !isDeliverableType(type));
	if (projection === 'deliverables') return types.filter((type) => isDeliverableType(type));
	return types;
}

/**
 * What `Set type` may offer on THIS row — `offerableTypes` with the row in hand, which is
 * the only caller that has one.
 *
 * Its own export rather than the call spelled at the menu, so `interactions/menu.ts` does
 * not import `ALL_TYPES` to pass it back: the lint rule banning that import is the
 * statement of this whole rule, and a file re-importing the vocabulary just to hand it to
 * the function that narrows it is exactly the shape the rule exists to stop.
 */
export function retypeChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	return offerableTypes(host, ALL_TYPES, item);
}

/**
 * Which of the quick filter's two indexes this projection's questions are answered from.
 *
 * Decided ONCE rather than at each of the three call sites, because getting it wrong at
 * one of them is invisible until somebody types into the box on that exact projection.
 * The Deliverables board renders `deliverableResults`, built from the whole unfocused
 * tree; every other projection renders out of the forest a focus level narrows. The
 * catalog is `'focused'` like the rest and that is not an oversight — its own forest is
 * what `recompute` indexed, and a focus level cannot narrow it, so the two agree.
 *
 * Beside `treeShaped` and `hidesCompleted` rather than on the view, for the reason all
 * three share: it is a fact about the projection, not about the object drawing it.
 */
export function filterScopeFor(projection: Projection): FilterScope {
	return projection === 'deliverables' ? 'whole' : 'focused';
}
