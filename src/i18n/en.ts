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
	/** The same count once hiding has made it a pair — the whole is the point. */
	'count.shownOfTotal': '{shown} of {total}',
	'count.cards': { one: '{count} card', other: '{count} cards' },
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

	/**
	 * A card's children disclosure, as four whole sentences rather than a phrase plus a
	 * joined note. The em dash and the clause after it are English punctuation and English
	 * grammar: a locale that leads with the hidden count, or that punctuates an aside
	 * differently, cannot reach either through a `+` at the call site.
	 */
	'card.showChildren': 'Show what is under "{title}"',
	'card.hideChildren': 'Hide these',
	'card.showChildrenHiding': {
		one: 'Show what is under "{title}" — {count} more is hidden by the current view',
		other: 'Show what is under "{title}" — {count} more are hidden by the current view',
	},
	'card.hideChildrenHiding': {
		one: 'Hide these — {count} more is hidden by the current view',
		other: 'Hide these — {count} more are hidden by the current view',
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

	/**
	 * The children fold, worded once for the two surfaces that offer it — the timeline
	 * row's chevron and the card menu's entry. One key each way rather than one per
	 * surface: the row's NAME is what a screen reader gets either way, so two surfaces
	 * describing one act differently is the defect, and a shared key is what makes that
	 * impossible rather than merely agreed.
	 */
	'fold.showChildren': 'Show children',
	'fold.hideChildren': 'Hide children',
	/**
	 * A fold control's action, written as a whole sentence per direction rather than a
	 * verb swapped inside one. `Expand`/`Collapse` and `Show`/`Hide` were ternaries in
	 * the template, which is the same defect as `item${s}` with a word in place of a
	 * suffix: a language that reorders the verb, or inflects the name after it, cannot
	 * reach either half.
	 *
	 * `{name}` is a parameter because the SURFACE cannot know what it holds, not because
	 * every value is user data. A column's label and a resource's are; three are plugin
	 * constants that are still English — `SHELF_LABEL` ('Unplaced', `domain/roadmap.ts`),
	 * `NO_STATE_LABEL` ('No state', `domain/board.ts`) and `markerLaneCaption`'s row
	 * header beside it — so a translated catalog would render `Erweitern Unplaced (3)`
	 * today. All three are display-only, matched and persisted nowhere, so they belong in
	 * this catalog and are owed to the sweep; `domain/` is unswept and each is read from
	 * several surfaces, which is why they did not move here beside a fold label.
	 */
	'fold.expandColumn': 'Expand {name}',
	'fold.collapseColumn': 'Collapse {name}',
	'fold.expandShelf': 'Expand {name} ({count})',
	'fold.collapseShelf': 'Collapse {name} ({count})',
	/**
	 * A resource band's fold, in two keys rather than one with a possessive pasted on:
	 * `'s` is English grammar, and a locale that forms the possessive differently — or
	 * drops it — owns the whole sentence here. Only a resource's band folds; the markers
	 * row draws no chevron.
	 */
	'fold.showResource': "Show {name}'s work",
	'fold.hideResource': "Hide {name}'s work",

	/** The horizon chip's reason, when the value on the note is one the axis refuses. */
	'chip.horizonUnreadable': 'Unreadable horizon value',

	/** The rollup column's header — the progress bar's, and the plain count's. */
	'column.rollupProgress': 'Progress',
	'column.rollupItems': 'Items',

	/**
	 * The roadmap with no axis, as two whole bodies rather than one with a swapped middle
	 * clause: the half that is missing decides the sentence, and a locale that puts the
	 * dates first cannot reorder a clause spliced in by the caller.
	 */
	'emptyState.noAxisBody':
		'The roadmap draws whichever axis the view options declare — confidence horizons, or dates. Set "Horizon property" and "Horizons (in order)" for Now-Next-Later buckets, or set "Start date property" or "Target date property" for a timeline.',
	'emptyState.noAxisBodyHalfSet':
		'The roadmap draws whichever axis the view options declare — confidence horizons, or dates. A horizon property is set, but "Horizons (in order)" is empty — fill it to get Now-Next-Later buckets, or set "Start date property" or "Target date property" for a timeline.',

	/**
	 * The busy indicator. The counted form drops the ellipsis because the count follows it
	 * in its own element and reads as the continuation — which is the one thing a
	 * translator must keep, and the reason these are two keys and not one with a suffix.
	 */
	'toolbar.updating': 'Updating…',
	'toolbar.updatingCounted': 'Updating',
	'toolbar.updatingProgress': 'Updating {done} of {total}…',

	/**
	 * The manual's types paragraph, as ONE key rather than four concatenated template
	 * literals with a plural ternary in the middle. It is the longest entry here and that
	 * is the point: the paragraph is the unit a translator can actually render, and its
	 * `are`/`is` was the last inline plural agreement in `src/`.
	 *
	 * **Every type name in it is a PARAMETER, and none may move into this file.** `LEVELS`,
	 * `EXTRA_TYPES` and `MARKER_TYPES` are written to notes as `type:` values, so a locale
	 * that changed them would describe a vocabulary the vault does not have. The English
	 * said `an Epic, a Feature or a PBI` and now says `{parents}`, joined by
	 * `Intl.ListFormat`: the per-item articles went with the literals, because an article
	 * is grammar attached to a data value and no catalog can supply one for a name it is
	 * not allowed to know.
	 *
	 * `{ladder}` arrives pre-joined by ` → ` rather than as a list parameter — that arrow
	 * is notation, not a conjunction, and running it through `ListFormat` would render the
	 * ladder as a sentence.
	 *
	 * **`any of {parents}` earns its two words.** `grammarFor` builds a CONJUNCTION
	 * formatter and no disjunction one, so a bare `{parents}` reads `Epic, Feature, and
	 * PBI` — three rungs the + offers under at once, where the English it replaced said
	 * `an Epic, a Feature or a PBI` and meant any one of them. `any of` restores the
	 * disjunction in a form the conjunction can carry, which is cheaper than a second
	 * `Intl.ListFormat` for one sentence and leaves the choice visible to a translator.
	 * Found by review on PR #176. `{deepest}s` pluralizes a type name with a trailing `s`, the
	 * same ceiling `count.childrenOfType` carries and `Type names are data` owns.
	 */
	'manual.typesIntro':
		'{ladder} is a ladder: each level holds the next one down. {extras} sit beside it — the + offers one under any of {parents}, but its rank is pinned: its children are always {deepest}s, wherever it hangs. {markers} are neither: no + offers to create one as a child, and none draws a + of its own — though nothing stops a drag or Set type from doing either by hand.',

	'settings.sharedKey': 'The {properties} properties share the key "{key}".',
} as const;
