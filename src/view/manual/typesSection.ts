import { t } from '../../i18n/t';
import { ManualEntry, ManualSection } from '../../ui/manualDialog';
import { ALL_TYPES, EXTRA_TYPES, LEVELS, MARKER_TYPES } from '../../domain/typeVocabulary';
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
	Iteration:
		'A time box items are scheduled into. Items link to an iteration rather than hanging from ' +
		'one, so like a Milestone it holds nothing. It is the only type no New menu offers and ' +
		'no tree row draws: an iteration is the container a board is scoped to rather than work ' +
		'the backlog holds, and the board\'s own scope picker is what makes one.',
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
 * reads at a level, that a move never re-types, and that the type ladder is
 * advisory rather than enforced.
 */
export function typesSection(): ManualSection {
	return {
		id: 'types',
		title: 'Item types',
		// One key, not four joined pieces: the paragraph is what a translator renders, and
		// its `are`/`is` was the last inline plural agreement in `src/`. Every type name
		// rides in as a parameter — they are `type:` values written to notes, so the
		// catalog may not hold them. `parents` is the ladder minus its deepest rung, which
		// is what "the + offers one under" has always meant; it was spelled out as
		// `an Epic, a Feature or a PBI` and drifts the moment a rung is added.
		intro: t('manual.typesIntro', {
			ladder: LEVELS.join(' → '),
			extras: EXTRA_TYPES,
			parents: LEVELS.slice(0, -1),
			deepest: LEVELS[LEVELS.length - 1],
			markers: MARKER_TYPES,
		}),
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
					'Dragging an item leaves its type alone, wherever it lands, and so does every other ' +
					'way of re-parenting it. Set type is the only thing that writes a type to a note ' +
					'that already has one.',
			},
			{
				term: 'Type is advisory, not enforced',
				text:
					'The + narrows to the types that fit under this parent, and on a board to what that board ' +
					'can show as well. Set type narrows too — in every projection rather than only on a ' +
					'board, because each offers what it can show. So Test suite and Test case are not ' +
					'offered on a plan row, and nothing from the plan\'s side is offered in the test ' +
					'catalog — except Task, on a row that hangs from a test, since it is the rung both ' +
					'ladders share. Inside a ladder nothing is enforced, and no move is ' +
					'refused for what it would type something as: a Task under an Epic stays a Task, at its ' +
					'own level, however oddly it sits. What a move can be refused for is leaving the ' +
					'projection it is drawn on, because the row would vanish off the screen it was moved on ' +
					'— a drag, an outdent and the two menu entries that remove the parent link are all ' +
					'withheld for it. Only two rows can cross that line, and only between the plan and the test ' +
					'catalog: a Task, the rung both ladders share, and a note with no type at all, which ' +
					"takes its parent's. Every other type keeps its own ladder wherever it lands, so a " +
					'backlog with no tests in it is refused nothing here. Other drops still are — onto an ' +
					"item's own descendant, or into a sibling group a reorder cannot reach right now — " +
					'neither of which is about type.',
			},
		],
	};
}
