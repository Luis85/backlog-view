/**
 * The English catalog — the source, the fallback, and in this round the only one that
 * ships (`docs/requirements/English ships alone.md`).
 *
 * **Data, not code.** No imports, no logic, no computed keys: a translator copies this
 * file and replaces the values without reading the plugin. Everything that reads it is
 * in `t.ts`.
 *
 * Two rules for whoever edits it:
 *
 * - **A key is named for the surface and the meaning, never for the English words.**
 *   Rename a key when the meaning changes, not when the wording does — a catalog keyed
 *   on its own text has to be re-keyed by every locale on every copy edit.
 * - **Two keys holding identical English text is expected, and must not be
 *   deduplicated.** They diverge in the first language that separates them.
 *
 * A `{name}` in a message is a parameter, and the set of them is what `t()` demands of
 * its caller. An entry with plural forms carries `{count}`; the form is chosen by
 * `Intl.PluralRules` for THIS catalog's locale, so a catalog supplies only the
 * categories its own language has — English has `one` and `other`.
 *
 * What is NOT here, and must never be: anything the plugin writes, matches or
 * persists. Type names, state values, view-option keys, tags, file names. Those are
 * data, and a locale that changed them would write notes another locale cannot read.
 */
export const en = {
	/** A bare count of items, standing alone as a label. */
	'count.items': { one: '{count} item', other: '{count} items' },
	/** The same count, once a filter has made it a pair — the whole is the point. */
	'count.shownOfTotal': '{shown} of {total}',
	'count.cards': { one: '{count} card', other: '{count} cards' },
	'count.cardsMatching': '{count} of {total} cards match',
	'count.children': { one: '{count} child', other: '{count} children' },
	/**
	 * A count of children that all share a type. The type is user data and arrives as a
	 * parameter; the trailing `s` pluralizes a word this catalog did not write, which is
	 * the known ceiling `childrenLabel` has always carried and `Type names are data`
	 * owns.
	 */
	'count.childrenOfType': { one: '{count} {type}', other: '{count} {type}s' },

	'toolbar.ignoredNotes': { one: '{count} note ignored', other: '{count} notes ignored' },
	'toolbar.ignoredTooltip': {
		one: '{count} note in this base is not backlog items — no supported type and no parent. Turn off "Ignore notes outside the hierarchy" in the view options to show them.',
		other:
			'{count} notes in this base are not backlog items — no supported type and no parent. Turn off "Ignore notes outside the hierarchy" in the view options to show them.',
	},

	'emptyState.ignored': {
		one: '{count} note in this base has no supported type and no parent, so it is not treated as backlog items. Create your first {topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.',
		other:
			'{count} notes in this base have no supported type and no parent, so they are not treated as backlog items. Create your first {topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.',
	},
	'emptyState.allDone': {
		one: 'All {count} item is done and hidden.',
		other: 'All {count} items are done and hidden.',
	},

	/** A named group on the roadmap — a horizon bucket, or the shelf — with its count. */
	'roadmap.groupLabel': { one: '{name}, {count} item', other: '{name}, {count} items' },
	'roadmap.groupLabelCollapsed': {
		one: '{name}, collapsed, {count} item',
		other: '{name}, collapsed, {count} items',
	},
	'lane.absenceClash': {
		one: 'Crosses an absence, {cost}: {spans}',
		other: 'Crosses {count} absences, {cost}: {spans}',
	},
	/** The {cost} above, when the stretch takes part of the bar — and when it takes it whole. */
	'lane.daysLost': { one: '{count} day lost to absence', other: '{count} days lost to absence' },
	'lane.daysLostWhole': { one: 'all {count} day lost', other: 'all {count} days lost' },

	'card.hiddenChildren': {
		one: '{count} more is hidden by the current view',
		other: '{count} more are hidden by the current view',
	},
	'row.searchMatches': {
		one: '{count} search match below',
		other: '{count} search matches below',
	},

	'undo.conflicts': {
		one: '{count} value was edited since and kept',
		other: '{count} values were edited since and kept',
	},
	'undo.missing': {
		one: '{count} note no longer exists',
		other: '{count} notes no longer exist',
	},
	'init.updatedItems': { one: 'updated {count} item', other: 'updated {count} items' },

	'settings.sharedKey': 'The {properties} properties share the key "{key}".',

	/** The estimation view's own states — loading, unconfigured, misconfigured, and its
	 * own empty result set. The table's row and cell text is not here yet: it lands with
	 * the table in a later task. */
	'estimation.loading': 'Loading estimation view…',
	'estimation.empty.unconfigured': 'No estimation model is configured for this view.',
	'estimation.empty.hint': 'Name the score properties in the view options, or use the setup action once it is available.',
	'estimation.problems.lead': 'Fix the estimation model first:',
	'estimation.empty.noResults': 'No results to estimate.',
} as const;
