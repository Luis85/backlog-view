import { byName, LEVELS } from '../../domain/typeVocabulary';

/**
 * What a type's badge looks like — the icon and the colour class, and nothing else.
 *
 * Its own module because two callers need it and they sit on opposite sides of the
 * render graph: the rows draw a badge per item, and `view/manual/typesSection.ts` draws
 * one beside each entry of the types section. Kept in `render/rows.ts` it made a cycle —
 * the manual reaches the rows, the rows reach creation, creation reaches the manual —
 * and the fix is not an exemption but the observation that a table of icons and class
 * names depends on nothing and belongs where nothing depends back.
 *
 * Before that it was DUPLICATED in the manual on the stated grounds that reaching across
 * a module cost more than restating four lines. `Test suite` ended that: the spelling
 * rule `pbl-lvl-${name.toLowerCase()}` produces `pbl-lvl-test suite` for the first type
 * name holding a space, which `classList.add` rejects outright — so the copy became one
 * that could both disagree with the stylesheet and throw.
 */

/** Work-item icons by level position, echoing the Azure DevOps set (crown, trophy, book, check). */
const LEVEL_ICONS = ['crown', 'award', 'book-open', 'check-square'];
/**
 * Icon and badge colour per declared type that is not a rung of the PLAN's ladder, keyed
 * lowercase. The vocabulary is fixed, so this covers ALL of it: there is no fallback for
 * a declared type, because there is no declared type this file has not been told about. A
 * test renders one of each and asserts every badge got an icon and a colour the
 * stylesheet defines, which is what makes that safe to rely on rather than something to
 * remember — and is the reason a name added to the vocabulary cannot ship here unnoticed,
 * whatever the count happens to be.
 *
 * The two test types are keyed **with the space kept**, because the lookup lowercases the
 * type name and then requires an exact key: a camel-cased `testSuite` would simply never
 * be found, and nothing would report it — `Record<string, …>` accepts any key, so the
 * miss surfaces as a badge with no icon and no colour rather than as an error. They are
 * the first multi-word names in the vocabulary, so this is the first time that convention
 * is exercised with a space in it.
 */
const NAMED_TYPE_STYLE: Record<string, { icon: string; badge: string }> = {
	issue: { icon: 'circle-alert', badge: 'pbl-lvl-issue' },
	bug: { icon: 'bug', badge: 'pbl-lvl-bug' },
	idea: { icon: 'lightbulb', badge: 'pbl-lvl-idea' },
	milestone: { icon: 'diamond', badge: 'pbl-lvl-milestone' },
	iteration: { icon: 'calendar-clock', badge: 'pbl-lvl-iteration' },
	deliverable: { icon: 'package', badge: 'pbl-lvl-deliverable' },
	// `trending-up`, NOT `package`: an Improvement shares Deliverable's green (see
	// `styles/badges.css` for why), and these two are the one pair on that hue that can be
	// SIBLINGS under a single parent — both are extra types at the same rung — so the glyph
	// is the whole of what separates their badges where it matters most.
	improvement: { icon: 'trending-up', badge: 'pbl-lvl-improvement' },
	// `rocket`, NOT `package`: a release shares Deliverable's green (see `styles/badges.css`
	// for why that hue), and the icon is the whole of what separates the two badges. The
	// plan named `package` here, which is the icon Deliverable already carries — the pair
	// would have been indistinguishable in both hue and glyph, which is the one thing that
	// stylesheet's sharing rule refuses.
	release: { icon: 'rocket', badge: 'pbl-lvl-release' },
	'test suite': { icon: 'folder-check', badge: 'pbl-lvl-test-suite' },
	'test case': { icon: 'flask-conical', badge: 'pbl-lvl-test-case' },
};

/**
 * The icon and badge class for a type, asked of the name the badge SHOWS — never of
 * `item.levelIndex`, which indexes whichever ladder the item is on: a `Task` beneath a
 * `Test case` is rung 2 there and rung 3 of the plan's, so the index alone would draw it
 * as a PBI in blue. The shown name answers for both ladders without either being named
 * here, which is also what lets the two test types be ordinary entries in the table above
 * even though they ARE rungs.
 *
 * Exported because the manual draws the same badges beside its own type entries, and the
 * class spelling stopped being derivable the moment a type name held a space:
 * `pbl-lvl-${name.toLowerCase()}` yields `pbl-lvl-test suite`, which `classList.add`
 * rejects outright. One statement, so the manual and the rows cannot spell it differently.
 */
export function badgeStyleFor(typeName: string): { icon: string; badge: string } {
	const named = byName(NAMED_TYPE_STYLE, typeName);
	if (named) return named;
	const rung = LEVELS.findIndex((l) => l.toLowerCase() === typeName.toLowerCase());
	if (rung >= 0) return { icon: LEVEL_ICONS[rung], badge: `pbl-lvl-${rung}` };
	return { icon: '', badge: 'pbl-lvl-unknown' };
}
