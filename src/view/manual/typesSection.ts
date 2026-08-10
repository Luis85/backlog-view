import { ManualEntry, ManualSection } from '../../ui/manualDialog';
import { ALL_TYPES, EXTRA_TYPES, LEVELS, MARKER_TYPES } from '../../domain/settings';
import { badgeStyleFor } from '../render/badges';

/**
 * What each type is FOR. Keyed by type name and checked for completeness against
 * `ALL_TYPES` (`test/view/manualTypes.test.ts`), so a type added to the vocabulary
 * without an explanation fails a test rather than shipping as a gap.
 */
const INTENT: Record<string, string> = {
	Epic: 'A body of work with a reason to exist — the top of the ladder; nothing is a rung above it.',
	Feature: 'One coherent slice of the work above it, stated as an outcome someone would notice.',
	PBI: 'What a person does, step by step. The rung work is usually planned at.',
	Task:
		'A piece of engineering, and the deepest rung. A Task can still hold another Task — the level ' +
		'offered clamps here rather than running out.',
	Issue: 'A question, a decision taken, or a limitation accepted. Holds Tasks, wherever it hangs.',
	Bug: 'What went wrong, what fixed it, and what it taught. Holds Tasks, wherever it hangs.',
	Idea: 'Something worth considering but not committed to. Holds Tasks, wherever it hangs.',
	Deliverable:
		'Something the team must produce rather than build — a design, a concept. Holds Tasks, ' +
		'wherever it hangs.',
	Milestone:
		'A date the plan answers to. The + never offers to create one as a child, and draws no + of ' +
		'its own — but that is what is OFFERED: nothing stops a drag from nesting one under an ' +
		'existing row, or Set type from turning any row into one.',
	'Test suite':
		'A walkable group of end-to-end tests, and a root by nature — it hangs from nothing and ' +
		'lives in the test catalog rather than in the plan. Holds Test cases.',
	'Test case':
		'One test somebody can execute: its preconditions, steps and expected result are the note ' +
		'body, not properties. Holds Tasks, so the fix a failure provokes hangs where it was found.',
};

/**
 * The badge class the row renderer would give this type — taken FROM that renderer now
 * rather than mirrored beside it. It used to be a four-line spelling rule duplicated
 * here on the grounds that reaching across the module cost more than restating it, and
 * `Test suite` is what ended that: `pbl-lvl-${typeName.toLowerCase()}` produces
 * `pbl-lvl-test suite`, a token `classList.add` rejects outright, so the manual's copy
 * became the first spelling that could disagree with the stylesheet AND throw. Resolved
 * in `view/`, not in `ui/`, because `ui/manualDialog.ts` may not import `domain/` to know
 * what a rung even is.
 */
function badgeClass(typeName: string): string {
	return badgeStyleFor(typeName).badge;
}

function entryFor(typeName: string): ManualEntry {
	return {
		term: typeName,
		// No `?? ''` fallback: `INTENT` is checked complete against `ALL_TYPES` by
		// `test/view/manualTypes.test.ts`, and a fallback here would be a branch that
		// test can never exercise. A type added without an entry should throw on the
		// missing explanation's `.length`, not pass silently as an empty one.
		text: INTENT[typeName],
		badge: { text: typeName, cls: badgeClass(typeName) },
	};
}

/**
 * The types section, generated from the vocabulary (`ALL_TYPES` in `domain/settings.ts`)
 * rather than hand-listed beside it, so a type added later without an explanation here
 * fails `test/view/manualTypes.test.ts` instead of shipping as a silent gap.
 *
 * The entries after the type list state what is invisible on screen: how the `+` decides
 * what it offers (`childTypeChoices`, `domain/itemTypes.ts`), that an untyped item still
 * reads at a level, that a move does not re-type by default, and that the type ladder is
 * advisory rather than enforced.
 */
export function typesSection(): ManualSection {
	return {
		id: 'types',
		title: 'Item types',
		intro:
			`${LEVELS.join(' → ')} is a ladder: each level holds the next one down. ` +
			`${EXTRA_TYPES.join(', ')} sit beside it — the + offers one under an Epic, a Feature or a ` +
			`PBI, but its rank is pinned: its children are always ${LEVELS[LEVELS.length - 1]}s, wherever ` +
			`it hangs. ${MARKER_TYPES.join(', ')} is neither: no + offers to create one as a child, ` +
			`and none draws a + of its own — though nothing stops a drag or Set type from doing ` +
			`either by hand.`,
		entries: [
			...ALL_TYPES.map(entryFor),
			{
				term: 'A child is one rung down',
				text:
					'The level offered under a parent is the next rung, clamped at the deepest — so the + ' +
					'on a Task offers another Task, not nothing.',
			},
			{
				term: 'An untyped item still has a level',
				text:
					'It is shown at the level its position implies: a child of a Feature reads as a PBI, ' +
					'wherever that Feature sits.',
			},
			{
				term: 'A move does not re-type',
				text:
					'Dragging an item leaves its type alone, unless Assign item type when moving is on — ' +
					'it is off by default. On, it retypes the ladder levels in a moved subtree to match ' +
					'their new position; see "Moving and ranking" → "A move does not re-type" for exactly ' +
					'what it skips.',
			},
			{
				term: 'Type is advisory, not enforced',
				text:
					'The + narrows to what childTypeChoices names for this parent. Set type does not: in ' +
					'the tree and the roadmap it offers the whole vocabulary, because assigning a type by ' +
					"hand is advisory like a drag — a board's menu narrows only to what that board can show, " +
					'a different question from what fits the ladder. No drag is ever refused for what it ' +
					"would type something as. Other drops still are — onto an item's own descendant, or into " +
					'a sibling group a reorder cannot reach right now — neither of which is about type.',
			},
		],
	};
}
