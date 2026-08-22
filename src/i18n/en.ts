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
	'emptyState.loading': 'Loading backlog…',
	'emptyState.noItems': 'No backlog items',
	/**
	 * `{type}` is a TYPE NAME and arrives as a parameter throughout this block, never as a
	 * word this catalog spells: the vocabulary is what `type:` frontmatter holds, so a
	 * locale that translated it would write notes another locale cannot read.
	 */
	'emptyState.noTypeItems': 'No {type} items',
	'emptyState.newItem': 'New {type}',
	'emptyState.whatShowsHere': 'What shows here?',
	'emptyState.focusedHint':
		'Nothing typed "{type}" matches this view. Switch the focus button in the toolbar back to "All types", or create a {type}.',
	'emptyState.filterHint':
		"Point this base's filter at your backlog folder, then create your first {type}. New items automatically get the parent, order and type properties this view needs.",

	'emptyState.noTests': 'No tests yet',
	/**
	 * The trailing `s` on `{caseType}` pluralizes a word this catalog did not write — the
	 * same known ceiling `count.childrenOfType` carries, and `Type names are data` owns.
	 */
	'emptyState.noTestsBody':
		'The test catalog is a list of its own: a {suite} holds {caseType}s, and a case carries its preconditions, steps and expected result as ordinary markdown. It is not a branch of the plan — nothing here shows up in the tree, the board or the roadmap. Create your first {suite} to start one.',
	'emptyState.whatIsSuite': 'What is a test suite?',

	/**
	 * Two boards, two bodies, one title — and the titles are separate keys on purpose
	 * (`en.ts`'s own rule: identical English is expected and must not be deduplicated).
	 *
	 * Each body quotes a view option by its LABEL, spelled here as English rather than
	 * taken as a parameter. That matches `emptyState.ignored` and `toolbar.ignoredTooltip`
	 * above and is the same debt they carry: `Every surface translated`'s second acceptance
	 * criterion wants one parameter from one key, and the labels are
	 * `domain/viewOptions.ts`'s, which is [[View options and config warnings]] and unswept.
	 * Keying them here would be keying somebody else's string.
	 */
	'emptyState.noWorkflow': 'No workflow to show',
	'emptyState.noWorkflowBody':
		'The board is a projection of your workflow, and this view has no state property yet. Set "State property" in the view options — and optionally "Workflow states (in order)" — and the board will draw one column per state.',
	'emptyState.noDeliverableWorkflow': 'No workflow to show',
	'emptyState.noDeliverableWorkflowBody':
		'The Deliverables board projects a workflow, and this view has neither state property set. Set "Deliverable state property" in the view options to give Deliverables a workflow of their own, or set "State property" and they share the requirements one. Either draws a column per state, and "Deliverable workflow states (in order)" names them.',

	/**
	 * "the Deliverables board" names a PROJECTION and stays in the sentence; the quoted
	 * `{type}` beside it is the value `type:` frontmatter holds and is a parameter. The two
	 * read as the same word in English and are different kinds of thing.
	 *
	 * Which is why a BARE `Deliverables` may not appear here at all. This sentence used to
	 * carry one — "Deliverables are managed on their own board" — that the paragraph above
	 * did not cover and read as neither: not the board's name, and not the parameter, but
	 * the type spelled as ordinary translatable prose. It says "items of that type" now, so
	 * every remaining mention is one kind or the other.
	 */
	'emptyState.excludedFocus': 'Nothing to show under this focus',
	'emptyState.excludedFocusBody':
		'The focus level is "{type}", and items of that type are managed on the Deliverables board — this one never shows them. Clear the focus to see the rest of the backlog, or switch to that board.',
	'emptyState.showAllTypes': 'Show all types',

	/**
	 * Both mentions are the same `{type}` parameter, and the second one is the reason: it
	 * tells the user which value to PICK from a menu, so a translated word there names a
	 * type the plugin cannot match. "Set type" beside it is the menu's own label and is
	 * prose, the same split the focus sentence above makes.
	 */
	'emptyState.noDeliverables': 'No deliverables yet',
	'emptyState.noDeliverablesBody':
		'Nothing in this base is typed "{type}". Create one from the toolbar\'s New button, or type an existing note as "{type}" from its Set type menu.',

	/**
	 * `{name}` is the iteration note's own title — vault content, never translated. When
	 * there is no note to name, the caller passes `emptyState.thisIteration` rather than a
	 * literal: a parameter is not exempt from the catalog just because it usually carries
	 * vault content, and an English fallback spliced into a translated sentence is the one
	 * shape that reads as correct in every test written under the English catalog.
	 */
	'emptyState.thisIteration': 'this iteration',
	'emptyState.emptyIteration': 'No items in this iteration yet',
	'emptyState.emptyIterationBody':
		"Nothing names {name} yet. Put work in it with Set iteration from any row's or card's menu, which also takes the iteration's own start and target dates.",

	'emptyState.noAxis': 'No axis to show',
	'emptyState.addDefaults': 'Add the default properties',
	'emptyState.showCompleted': 'Show completed items',

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

	/**
	 * Every row chip's accessible name. `{label}` is the COLUMN's display name — the
	 * user's own word for the property — and `{value}` is what the note carries, so both
	 * are data and neither is this catalog's to translate.
	 */
	'chip.set': 'Set {label}',
	'chip.change': 'Change {label} (currently {value})',

	/**
	 * A chip's tooltip, per property and in two shapes: what a result's chip offers, and
	 * what a context row's static chip says instead. Whole sentences per property rather
	 * than one frame with the property's name spliced in — the name is a word of THIS
	 * catalog, and a language that inflects it after "change", or orders the clause
	 * differently, cannot reach either through a parameter.
	 */
	'chip.stateStatic': "Not in this base's filter — state can't be changed here",
	'chip.stateChange': 'Change state',
	'chip.horizonStatic': "Not in this base's filter — horizon can't be changed here",
	'chip.horizonChange': 'Change horizon',
	'chip.riskStatic': "Not in this base's filter — risk can't be changed here",
	'chip.riskChange': 'Change risk',
	'chip.priorityStatic': "Not in this base's filter — priority can't be changed here",
	'chip.priorityChange': 'Change priority',
	'chip.assigneeStatic': "Not in this base's filter — assignee can't be changed here",
	'chip.assigneeChange': 'Change assignee',
	'chip.startStatic': "Not in this base's filter — start date can't be changed here",
	'chip.startChange': 'Change start date',
	'chip.startUnreadable': 'Unreadable start date',
	'chip.targetStatic': "Not in this base's filter — target date can't be changed here",
	'chip.targetChange': 'Change target date',
	'chip.targetUnreadable': 'Unreadable target date',

	/**
	 * What an unset LABEL chip says — the property, because there is no value to show.
	 * The date chips take the column's display name instead and so have no key here; see
	 * `DATE_CHIPS` for why a fixed word would name a key the vault does not have.
	 */
	'chip.riskPlaceholder': 'Risk',
	'chip.priorityPlaceholder': 'Priority',
	'chip.assigneePlaceholder': 'Assignee',
	/** The state chip's own placeholder, on a result with no state written yet. */
	'chip.statePlaceholder': 'State',

	/**
	 * What the pane calls itself, per projection — its accessible name, and the only
	 * place a reader who switched projections is told which one they are in. Lowercase
	 * `backlog` throughout: these are sentences about the view, not the plugin's own
	 * NAME, which `Every surface translated` says is never translated.
	 */
	'projection.tree': 'Product backlog',
	'projection.catalog': 'Test catalog',
	'projection.board': 'Product backlog board',
	'projection.iteration': 'Iteration board',
	'projection.deliverables': 'Deliverables board',
	'projection.roadmap': 'Product backlog roadmap',

	/**
	 * The tree row's own markers. `{type}` is the level's shown NAME and is data;
	 * `{action}` is the toolbar button this sentence tells the reader to press, taken as
	 * a parameter from `toolbar.assignMissing` so it quotes the label they can actually
	 * find rather than an English one spelled twice.
	 *
	 * `row.badgeImplied` is the whole tooltip including its separator, not the plain
	 * badge text with an explanation appended: the aside and its punctuation are English
	 * grammar, and a locale that leads with the reason cannot reach that through a `+`.
	 */
	'row.badgeImplied': '{type} · Type property not set — level implied from position. Use "{action}" to write it.',
	'row.orphan': 'Parent is set but not part of this view',
	'row.contextMarker': "Not in this base's filter — shown to keep the hierarchy",
	/**
	 * The add button, where the row can hold more than one type and so cannot promise
	 * which. With exactly one it reads `menu.newChild` — the same act the context menu's
	 * own New entry performs, so the two are one key rather than two that can disagree.
	 */
	'row.addChild': 'New child item',

	/**
	 * The board's own text. `{name}` is a COLUMN's label and `{state}` the value a note
	 * carries — both data — and the counts are plural entries of the whole sentence
	 * rather than a rendered count spliced in, `roadmap.groupLabel`'s shape exactly.
	 *
	 * Six column labels rather than one frame with clauses appended: the fold, the limit
	 * and the overage each change the sentence, and a language that orders them
	 * differently, or that puts the count last, cannot reach any of that through a `+`.
	 */
	'board.columnLabel': { one: '{name}, {count} card', other: '{name}, {count} cards' },
	'board.columnLabelFolded': {
		one: '{name}, collapsed, {count} card',
		other: '{name}, collapsed, {count} cards',
	},
	'board.columnLabelLimit': {
		one: '{name}, {count} card, limit {limit}',
		other: '{name}, {count} cards, limit {limit}',
	},
	'board.columnLabelFoldedLimit': {
		one: '{name}, collapsed, {count} card, limit {limit}',
		other: '{name}, collapsed, {count} cards, limit {limit}',
	},
	'board.columnLabelOver': {
		one: '{name}, {count} card, limit {limit}, over by {over}',
		other: '{name}, {count} cards, limit {limit}, over by {over}',
	},
	'board.columnLabelFoldedOver': {
		one: '{name}, collapsed, {count} card, limit {limit}, over by {over}',
		other: '{name}, collapsed, {count} cards, limit {limit}, over by {over}',
	},
	/** The `{name}` above, where a drop on this column is what REMOVES the key. */
	'board.clearingColumn': '{label} — dropping here clears the state',

	/**
	 * The two undeclared-column advisories, each quoting its own view option by the
	 * label spelled here as English. That is the debt `emptyState.noWorkflowBody` and
	 * its three siblings already carry, paid the same way: the labels belong to
	 * `domain/viewOptions.ts`, and keying them here would be keying somebody else's
	 * string. `Every surface translated`'s second acceptance criterion is what collects
	 * all of them, in [[View options and config warnings]].
	 */
	'board.undeclaredColumn':
		'"{state}" is not one of the configured workflow states. Add it to "Workflow states (in order)" in the view options, or move its cards.',
	'board.undeclaredDeliverableColumn':
		'"{state}" is not one of the configured workflow states. Add it to "Deliverable workflow states (in order)" in the view options, or move its cards.',

	'board.stripTooltip': 'Drop a card here to clear its state',
	'board.noStateColumn': 'Items without the state property — dropping a card here removes it',
	'board.contextMarker': "Not in this base's filter — shown to place its items",
	'board.contextCard': "Outside this base's filter — shown for context",
	'board.cardParent': 'Under "{title}"',
	/** The board's hidden shortcut instructions, read by `aria-describedby`. */
	'board.instructions':
		'Arrow keys move between cards and columns. Alt with left or right arrow moves the selected card one column, writing the same change a drop writes. The menu key opens the card menu, where set state offers every column — the path that works without a drag on every device. Enter opens the note.',

	/**
	 * The shelf and the context strip beside it. `{span}` is a rendered date range and
	 * `{type}` / `{bucket}` are vault data; only the frames are this catalog's.
	 */
	'shelf.removeHorizon': 'Results this axis cannot place — dropping a card here removes its horizon',
	'shelf.removeAssignee': 'Results this axis cannot place — dropping a card here removes its assignee',
	'shelf.removeDates': 'Results this axis cannot place — dropping a bar here removes its dates',
	'shelf.removalKeeps': 'Keeps {span}',
	/**
	 * The iteration board's own shelf: the work in no iteration, and what a drop on it
	 * means. Its own two keys rather than the roadmap's — this shelf holds results the
	 * board could pull IN, which is the opposite statement from "the axis cannot place
	 * these", and `placement.unplaced` names a placement no board has.
	 */
	'shelf.backlog': 'Backlog',
	'shelf.removeIteration': 'Work in no iteration — dropping a card here takes it out of this iteration',
	'shelf.sort': 'Sort the shelf',
	'shelf.filterByType': 'Filter the shelf by type',
	'shelf.layout': 'Shelf layout',
	/** One key for the context strip's name, drawn as its heading AND as its group label. */
	'shelf.context': 'Context',
	'shelf.contextTooltip': "Not in this base's filter — shown for the hierarchy, never counted",

	/**
	 * The roadmap's bucket furniture. `roadmap.undeclaredBucket` carries the same view
	 * option debt `board.undeclaredColumn` above states.
	 */
	'roadmap.undeclaredBucket':
		'"{value}" is not one of the declared horizons. Add it to "Horizons (in order)" in the view options, or re-place its items.',
	'roadmap.newInBucket': 'New {type} in {bucket}',
	'roadmap.newInBucketTooltip': 'New {type} in "{bucket}"',

	/**
	 * The timeline's key. Four of the five name FURNITURE this view draws; `legend.done`
	 * is the fallback caption for the green swatch where no workflow declares a done
	 * value of its own to name it with.
	 */
	'legend.today': 'Today',
	'legend.unavailable': 'Unavailable',
	'legend.daysLost': 'Days lost',
	'legend.done': 'Done',
	'legend.other': 'Other',

	'timeline.todayLine': 'Today — {date}',
	/**
	 * The dependency arrow's tooltip. `{items}` is a LIST and is joined as grammar by
	 * `Intl.ListFormat` rather than by a `', '` at the call site — the same move the undo
	 * report made, and for the same reason: a joiner is punctuation and punctuation is a
	 * locale's. Each entry is one of the three keys below, so the parenthetical that says
	 * WHY an entry is named is inside the sentence rather than concatenated onto it.
	 */
	'timeline.waitsFor': 'Waits for {items}',
	'timeline.prerequisiteConflict': '{name} (conflict)',
	'timeline.prerequisiteBroken': '{name} (broken)',

	/** The tag cell's own controls. `{tag}` is vault data throughout. */
	'column.addTag': 'Add tag',
	'column.removeTag': 'Remove tag {tag}',
	'column.removeTagTooltip': 'Remove #{tag}',

	/** A card's children entry, one per child with no card of its own. */
	'card.openChild': 'Open "{title}"',

	/**
	 * What an item's rollup says in full — the tree's cell and the bar's row alike.
	 *
	 * It was `` `${done} of ${total} items done` ``, a template whose FIRST quasi is empty,
	 * which is the one shape `UI_TEXT_LITERAL` states it cannot see — and an AST walk over
	 * the directory missed it for the same reason, since every quasi in it is lowercase or
	 * blank. The runtime half is what found it (2026-08-21), which is the whole argument
	 * for having one.
	 *
	 * Plural on the TOTAL, which is what `items` agrees with; the fixed `s` it carried
	 * before was an English defect and is not preserved.
	 */
	'column.rollupTooltip': {
		one: '{done} of {count} item done',
		other: '{done} of {count} items done',
	},

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
	/** The door beside the busy indicator, into the manual's own section on writes. */
	'toolbar.busyHelp': 'What is happening',

	/**
	 * `{type}` is the value `type:` frontmatter holds and never a word this file may
	 * spell — `emptyState.noDeliverablesBody`'s rule, on the one button whose label the
	 * focus level moves.
	 */
	'toolbar.newItem': 'New {type}',
	'toolbar.newOtherType': 'New item of another type',

	'toolbar.expandAll': 'Expand all',
	'toolbar.collapseAll': 'Collapse all',
	'toolbar.openManual': 'Open the manual',
	'toolbar.assignMissing': 'Assign missing properties',
	/**
	 * NO VIEW IN THE NAME, because there is one undo slot for the whole vault. ADR 0030
	 * put `lastUndo` on the plugin-wide `WriteLock` on purpose — a slot per view would be
	 * two views racing with two ideas of what the last batch was — so this button really
	 * can take back a batch the reader made in another view, and a label promising
	 * otherwise was the only wrong part. The estimation toolbar shares this key rather
	 * than owning a second one saying "estimation".
	 */
	'toolbar.undo': 'Undo last change',
	'toolbar.overflow': 'More toolbar actions',

	'toolbar.groupingIgnored': 'Grouping ignored',
	'toolbar.groupingIgnoredTooltip':
		"The hierarchy is the tree's grouping and the workflow is the board's — the group by setting has no effect in this view.",
	'toolbar.checkViewOptions': 'Check view options',
	'toolbar.configHelp': 'What to fix',
	/**
	 * A type with a count, for the item-count tooltip's breakdown. Not
	 * `count.childrenOfType`: that one pluralizes the type name, and this list never does
	 * — it names each type once as the vault spells it.
	 */
	'toolbar.levelCount': '{count} {type}',
	/** What that breakdown calls a note whose own type is unreadable. */
	'toolbar.untyped': 'Untyped',

	/**
	 * The completed toggle, as three whole labels rather than one with a counted suffix:
	 * the count is a clause inside the sentence, and a locale that puts it first cannot
	 * reorder a fragment the caller appended.
	 */
	'toolbar.hideCompleted': 'Hide completed items',
	'toolbar.showCompleted': 'Show completed items',
	'toolbar.showCompletedHidden': 'Show completed items ({count} hidden)',
	'toolbar.clickAction': 'Clicking a row folds it',

	/**
	 * The focus picker. Its accessible name is two whole keys picked between rather than
	 * one frame around a value that is sometimes a type and sometimes the words "all
	 * types" — `emptyState.noAxisBody`'s shape, for its reason.
	 */
	'toolbar.focusAll': 'Focus: all types',
	'toolbar.focusOn': 'Focus: {type}',
	'toolbar.allTypes': 'All types',
	'toolbar.showAllTypes': 'Show all types',
	'toolbar.focusTooltip': 'Focus — show one type as the top of the tree',

	/**
	 * The three projections whose focus control is a static label, and the label is the
	 * PROJECTION's name — the board or the catalog you are looking at, which is the kind
	 * of thing `emptyState.excludedFocusBody` calls "the Deliverables board" and keeps in
	 * the sentence. The `type:` values that read alike are never these: the tip beside
	 * each takes the type as `{type}` where it needs one.
	 */
	'toolbar.focusDeliverablesLabel': 'Deliverables',
	'toolbar.focusDeliverablesTip': 'This board always shows every {type} — the focus level has no effect here',
	'toolbar.focusCatalogLabel': 'Tests',
	'toolbar.focusCatalogTip':
		"The focus level names the plan's own levels, so it has no effect on the test catalog",
	'toolbar.focusIterationLabel': 'Iteration',
	'toolbar.focusIterationTip': 'This board shows every item in the chosen iteration — the focus level has no effect here',

	/**
	 * The projection switcher: an accessible name and the visible word under it, per
	 * position. **Each word must stay a substring of its own label**, so the visible text
	 * is inside the accessible name rather than beside it — what speech control needs to
	 * match what a reader can see. `test/i18n/toolbar.test.ts` asserts that of this
	 * catalog; a translation that breaks it breaks nothing the compiler can see.
	 */
	'toolbar.projection': 'Projection',
	'toolbar.modeTree': 'Show as backlog tree',
	'toolbar.modeTreeWord': 'Tree',
	'toolbar.modeBoard': 'Show as kanban boards',
	'toolbar.modeBoardWord': 'Boards',
	'toolbar.modeRoadmap': 'Show as roadmap',
	'toolbar.modeRoadmapWord': 'Roadmap',
	'toolbar.modeCatalog': 'Show as test catalog',
	'toolbar.modeCatalogWord': 'Tests',

	/**
	 * The three menu buttons in the projection zone and the scope picker beside the
	 * switcher. Each accessible name is "Purpose: Value" — a frame with the value as a
	 * parameter, because the value is a different KIND per control: the axis and the zoom
	 * pass one of the labels below, while the scope passes either a board's name or an
	 * iteration note's own title, which is vault content.
	 */
	'toolbar.axisAria': 'Roadmap axis: {axis}',
	'toolbar.axisTooltip': 'Roadmap axis',
	'toolbar.axisDates': 'Timeline',
	'toolbar.axisHorizons': 'Horizons',
	'toolbar.axisResources': 'Resources',
	'toolbar.zoomAria': 'Timeline zoom: {zoom}',
	'toolbar.zoomTooltip': 'Timeline zoom',
	'toolbar.zoomWeek': 'Weeks',
	'toolbar.zoomMonth': 'Months',
	'toolbar.zoomQuarter': 'Quarters',
	'toolbar.scopeAria': 'Board scope: {scope}',
	'toolbar.scopeTooltip': 'Which board the Board position opens',
	/** Both are board NAMES, the switcher's own rule — never the `type:` value. */
	'toolbar.scopeProduct': 'Product',
	'toolbar.scopeDeliverables': 'Deliverables',
	'toolbar.newIteration': 'New iteration…',
	'toolbar.editIteration': 'Edit iteration…',

	'toolbar.stateColours': 'State colours',
	'toolbar.bucketGrid': 'Grid in buckets',
	'toolbar.compactRows': 'Compact rows',
	'toolbar.jumpToToday': 'Jump to today',

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

	/**
	 * The placement labels — what the plugin calls a card with nowhere to sit, a state it
	 * has no column for, and the readings a horizon key can hold that are not a value.
	 *
	 * **These are FUNCTIONS at their call sites, never module constants**, and that is
	 * load order rather than taste: `initLocale()` runs in `main.ts`'s `onload`, while a
	 * `const X = t(…)` is evaluated when its module is first imported — which is earlier,
	 * so the constant would freeze English before Obsidian's language was ever read. Every
	 * one of these was a `const` in `domain/` until 2026-08-19.
	 *
	 * Safe to translate because none is ever compared: `docs/requirements/Type names are
	 * data` draws the line at what the plugin writes or matches, and no equality test in
	 * `src/` names any of them. `noStateCollisionLabel` is the closest thing to an
	 * exception and is the opposite — `boardColumns` asks whether a real state COLLIDES
	 * with the words on screen, so it has to compare the translated label rather than the
	 * English one, and translating makes that check more correct rather than less.
	 */
	'placement.unplaced': 'Unplaced',
	'placement.unscheduled': 'Unscheduled',
	'placement.noState': 'No state',
	/** What the no-state column is called when a real state is already named `No state`. */
	'placement.noStateCollision': 'Unset',
	/**
	 * Three readings of a horizon key that are not a placement, each written to drop into
	 * "moved from …" — which is why they carry their own article. A locale that forms that
	 * sentence differently owns the whole phrase, not a noun the caller prefixes.
	 */
	'placement.unreadableHorizon': 'an unreadable horizon',
	'placement.emptyHorizon': 'an empty horizon',
	'placement.emptyAssignee': 'an empty assignee',

	/**
	 * The shelf's search affordances. They read `Search the shelf` and `Clear the shelf
	 * search`, and they are whole keys rather than `placement.unplaced` lowercased and
	 * concatenated: case is not a transformation every language survives — German
	 * capitalizes every noun — and the word order around it is not universal either.
	 */
	'shelf.search': 'Search the shelf',
	'shelf.clearSearch': 'Clear the shelf search',

	/**
	 * The resources axis's own furniture. `{name}` is a resource, `{title}` a note's own
	 * title and `{start}`/`{target}`/`{date}` are rendered dates — all data.
	 * `lane.undeclaredResource` carries the view-option debt `board.undeclaredColumn`
	 * states, and `lane.unavailable` takes a LIST, joined as grammar.
	 */
	'lane.undeclaredResource':
		'"{name}" is not one of the declared resources. Add it to "Resources (in order)" in the view options, or re-assign its items.',
	'lane.addAbsence': 'Add absence for {name}',
	'lane.addAbsenceTooltip': 'Add absence for "{name}"',
	'lane.unavailable': 'Unavailable: {items}',
	'lane.absenceSaid': '{title} — {start} → {target}',
	'lane.assignedTo': 'Assigned to {name}',

	/**
	 * What a bar's state says to a reader who cannot see that it is green. `{value}` is
	 * the state the note carries and is data; only the word for finished is this
	 * catalog's, and it is a whole sentence in each shape rather than a suffix appended
	 * to a value.
	 */
	'lane.stateDone': 'Done',
	'lane.stateValueDone': '{value} — done',

	/**
	 * One sentence about a bar's span, said identically on the grid and in the drop
	 * ghost. Four shapes, each in two forms rather than one form with an aside appended:
	 * whether the ends were INFERRED from children changes the sentence, and the em dash
	 * clause that says so is English punctuation and English word order.
	 */
	'span.range': '{start} → {target}',
	'span.rangeInferred': '{start} → {target} — inferred from children',
	'span.point': '{type} {date}',
	'span.pointInferred': '{type} {date} — inferred from children',
	'span.startOnly': 'Starts {start}, target not set',
	'span.startOnlyInferred': 'Starts {start}, target not set — inferred from children',
	'span.targetOnly': 'Target {target}, start not set',
	'span.targetOnlyInferred': 'Target {target}, start not set — inferred from children',

	'lane.markersHeader': '{markers}s',
	'lane.markersHeaderBoth': '{first}s · {second}s',

	/**
	 * The Bases view-options menu: every group name, every option's `displayName`, and
	 * the placeholders that are prose rather than a value.
	 *
	 * **Keyed by the option's own persisted key** (`option.stateValues` for `stateValues`),
	 * because that key is the one name in `domain/viewOptions.ts` that cannot change — it
	 * is written into the user's `.base` file. A key named for the English words would have
	 * to be re-keyed on a copy edit; this one is pinned to the thing it labels. The four
	 * that have no option of their own say what they label instead (`option.group.*`, and
	 * the two per-state boxes whose keys are generated).
	 *
	 * **What stayed in `viewOptions.ts` is every placeholder anything READS BACK.** A
	 * property picker's placeholder is the frontmatter key the backfill would adopt, and a
	 * value list's placeholder mirrors its own `default`, so clearing the box falls back to
	 * the string on screen — translate either and the box advertises a configuration the
	 * plugin does not have. The ones here are the placeholders that are examples or hints:
	 * nothing parses them, so leaving them English protects nothing.
	 *
	 * `{state}` and `{type}` are the user's own workflow and this plugin's type vocabulary
	 * — data, parameters both, and never words this catalog spells.
	 */
	'option.group.hierarchy': 'Hierarchy',
	'option.group.progress': 'Progress',
	'option.group.deliverables': 'Deliverables',
	'option.group.iterations': 'Iterations',
	'option.group.testing': 'Test management',
	'option.group.roadmap': 'Roadmap',
	'option.group.risk': 'Risk management',
	'option.group.priority': 'Prioritization',
	'option.group.newItems': 'New items',
	'option.group.handling': 'Handling items',
	'option.group.display': 'Display',

	'option.parentProperty': 'Parent property',
	'option.orderProperty': 'Order property',
	'option.typeProperty': 'Item type property',
	'option.hierarchyOnly': 'Ignore notes outside the hierarchy',
	'option.showOutsideParents': 'Show parents outside the filter',
	'option.inferFolderHierarchy': 'Infer hierarchy from folder notes',

	'option.stateProperty': 'State property',
	'option.stateValues': 'Workflow states (in order)',
	'option.stateValuesHint': 'New, Active, Done',
	'option.doneValues': 'States that count as done',
	'option.startedStates': 'States that count as started',
	'option.startedStatesHint': 'Active, In review',
	'option.startedDateProperty': 'Started date property',
	'option.finishedDateProperty': 'Finished date property',
	'option.assigneeProperty': 'Assignee property',
	'option.showCompleted': 'Show completed items',
	/** The two per-state boxes. Their keys are generated per state, so these are not. */
	'option.wipLimit': 'WIP limit for {state}',
	'option.wipLimitHint': 'No limit',
	'option.columnPolicy': 'Policy for {state}',
	'option.columnPolicyHint': 'What has to be true to leave this column',

	'option.deliverableStateProperty': 'Deliverable state property',
	'option.deliverableStateValues': 'Deliverable workflow states (in order)',
	'option.deliverableStateValuesHint': 'Concept, Draft, Review, Published',
	'option.deliverableDoneValues': 'Deliverable states that count as done',

	'option.iterationProperty': 'Iteration property',
	'option.iterationGoalProperty': 'Iteration goal property',
	'option.iterationOpenStates': 'Product states an iteration has not started',
	'option.iterationOpenStatesHint': 'New, Ready',
	'option.iterationResolvedStates': 'Product states an iteration is finished with',
	'option.iterationResolvedStatesHint': 'In review, Done',
	'option.iterationLengthDays': 'Default iteration length in days',
	'option.iterationsOnTimeline': 'Show iterations on the roadmap timeline',
	'option.iterationBars': 'Draw iterations as bars',

	'option.testStateProperty': 'Test state property',
	'option.testStateValues': 'Test workflow states (in order)',
	'option.testStateValuesHint': 'Draft, Ready, Approved',
	'option.testDoneValues': 'Test states that count as done',

	'option.horizonProperty': 'Horizon property',
	'option.horizonValues': 'Horizons (in order)',
	'option.startProperty': 'Start date property',
	'option.targetProperty': 'Target date property',
	'option.resourceNames': 'Resources (in order)',
	'option.resourceNamesHint': 'Optional, comma separated',
	'option.dependsOnProperty': 'Depends-on property',

	'option.riskProperty': 'Risk property',
	'option.riskValues': 'Risk levels (in order)',
	'option.priorityProperty': 'Priority property',
	'option.priorityValues': 'Priority levels (in order)',

	'option.homeFolder': 'Home folder',
	'option.homeFolderHint': 'Same folder as existing items',
	'option.typeFolder': 'Folder for {type} items',

	/**
	 * The heading and its three CHOICES. The choices are labels only — what a `.base`
	 * stores and what `resolveItemHandling` matches are the keys `active` / `tab` /
	 * `split`, which stay in `domain/itemHandling.ts` and are never translated. They were
	 * left English here when the heading was keyed, because they sat as the VALUES of the
	 * same object that held the vocabulary.
	 */
	'option.openIn': 'Open the note in',
	'option.openInActive': 'Current tab',
	'option.openInTab': 'New tab',
	'option.openInSplit': 'Split to the right',
	'option.tagsProperty': 'Tags property',
	'option.showCounts': 'Show descendant counts',

	/**
	 * A FRAGMENT, deliberately: every reader of `configProblems` puts it inside a sentence
	 * of its own (`config.fixFirst`, `config.fixAll`), and a whole sentence nested in one
	 * rendered `"…".; "…"..` — the punctuation this catalog already carries one note about
	 * under `readme.*`. Written to be joined by `Intl.ListFormat` and closed by its host.
	 *
	 * `{properties}` is a LIST of `property.*` labels, joined as grammar in the locale of
	 * whichever catalog supplied the sentence. `{key}` is the frontmatter key itself and
	 * is data.
	 */
	'settings.sharedKey': 'the {properties} properties share the key "{key}"',

	/**
	 * What this view calls each property it owns, wherever a collision names them. Keyed by
	 * the ROLE, which is `ownedProperties`' own id and what `WORKFLOW_STATE_LABELS` matches
	 * on — so no locale can change which properties are allowed to share a key.
	 *
	 * The short role word rather than the option's full `displayName`: the sentence they
	 * land in already ends in "properties", so "the Parent property and Order property
	 * properties" is what the fuller label would read as.
	 */
	'property.parent': 'parent',
	'property.order': 'order',
	'property.type': 'type',
	'property.tags': 'tags',
	'property.state': 'state',
	'property.startedDate': 'started date',
	'property.finishedDate': 'finished date',
	'property.horizon': 'horizon',
	'property.start': 'start',
	'property.target': 'target',
	'property.dependsOn': 'depends on',
	'property.risk': 'risk',
	'property.priority': 'priority',
	'property.assignee': 'assignee',
	'property.deliverableState': 'deliverable state',
	'property.testState': 'test state',
	'property.iteration': 'iteration',
	'property.iterationGoal': 'iteration goal',

	/**
	 * The menus — the row and card menu in `view/interactions/menu.ts`, the shelf's picks
	 * in `shelfMenu.ts`, and the two submenu builders `menu.ts` delegates to (`tags.ts`,
	 * `labels.ts`). The board column's menu is here in spirit and in no key of its own: it
	 * offers one act, the fold, and reads `fold.expandColumn` — the key the column HEADER's
	 * disclosure already draws from.
	 *
	 * **What is NOT here is everything these menus list.** A type name, a state, a horizon
	 * bucket, a tag, an assignee, an iteration and a column's own label all arrive as data
	 * and are titled raw; a locale that translated one would offer a pick that writes a
	 * value another locale's vault cannot read. Only the frame around them is text — the
	 * verbs, the submenu names, the clears, and the prompts these entries open.
	 *
	 * The prompts are here rather than under `prompt.*` because that section is what `ui/`
	 * spells for ITSELF, and a heading, a field name and a call to action handed to
	 * `ValuePromptModal` are this caller's own words. `ui/`'s sweep said so and left them.
	 */
	'menu.newChild': 'New {type}',
	'menu.openInNewTab': 'Open in new tab',
	'menu.openToTheRight': 'Open to the right',
	'menu.clearParentLink': 'Clear parent link',
	'menu.useFolderPosition': 'Use folder position',
	/**
	 * The move section. `Move up` and `Indent under "…"` are separate keys rather than one
	 * verb with a direction spliced in, the rule `fold.expandColumn` states: a language
	 * that inflects the verb for its object cannot reach a half-sentence.
	 *
	 * `{title}` is the neighbour's own title — vault content, untouched.
	 */
	'menu.moveUp': 'Move up',
	'menu.moveDown': 'Move down',
	'menu.moveToTop': 'Move to top',
	'menu.moveToBottom': 'Move to bottom',
	'menu.indentUnder': 'Indent under "{title}"',
	'menu.outdent': 'Outdent',
	/** One child of a card, by its own title. */
	'menu.openChild': 'Open child "{title}"',
	/**
	 * The way back off a test state. It is the LABEL half of a `StateChoice` whose `state`
	 * is `null` — the label is drawn, the null is written, and only the drawn half is text.
	 */
	'menu.clearTestState': 'Clear test state',
	/** The submenu names, each opening onto values that are data. */
	'menu.setState': 'Set state',
	'menu.setRisk': 'Set risk',
	'menu.setPriority': 'Set priority',
	'menu.setAssignee': 'Set assignee',
	'menu.setIteration': 'Set iteration',
	'menu.setHorizon': 'Set horizon',
	'menu.setType': 'Set type',
	'menu.editTags': 'Edit tags',
	'menu.schedule': 'Schedule',
	'menu.unschedule': 'Unschedule',
	/**
	 * The shelf's own section. `menu.shelfSort*` are the three sort LABELS; the
	 * `ShelfSort` values beside them (`tree`, `title`, `modified`) are persisted view
	 * state and stay as written.
	 */
	'menu.sortShelf': 'Sort the shelf',
	'menu.filterShelfByType': 'Filter the shelf by type',
	'menu.shelfLayout': 'Shelf layout',
	'menu.shelfLayoutCards': 'Cards',
	'menu.shelfLayoutList': 'List',
	'menu.shelfSortTree': 'Sibling order',
	'menu.shelfSortTitle': 'Title (A to Z)',
	'menu.shelfSortModified': 'Last modified',
	'menu.showAllTypes': 'Show all types',
	'menu.hideAllTypes': 'Hide all types',
	/**
	 * One type's group on the shelf, counted. Not `count.childrenOfType`: that one
	 * pluralizes the type name, and this entry names a type exactly once and puts the
	 * number beside it — the shape `fold.expandShelf` already uses.
	 */
	'menu.shelfTypeCount': '{type} ({count})',
	/**
	 * The entry that OPENS the shelf's search, distinct from `shelf.search`, which the
	 * modal it opens is titled with and which the header's own box is labelled with. Same
	 * words in English; this one is a menu entry promising a dialog, and the trailing
	 * ellipsis is what says so.
	 */
	'menu.searchShelf': 'Search the shelf...',
	'menu.searchField': 'Title contains',
	'menu.searchPlaceholder': 'Part of a title',
	'menu.searchCta': 'Search',
	/**
	 * Set tags. The tags themselves are titled `#{tag}` at the call site and are not keyed:
	 * a tag is written into frontmatter, and the sigil is Obsidian's syntax rather than
	 * this catalog's punctuation.
	 */
	'menu.newTag': 'New tag...',
	'menu.addTagTitle': 'Add tag',
	'menu.addTagField': 'Tag',
	'menu.addTagPlaceholder': 'Sprint-12',
	'menu.addTagCta': 'Add',
	/** Refused because normalizing left nothing — said rather than closing as if it landed. */
	'menu.tagRejected': 'Tags need at least one non-numeric character, so that was not added.',
	/**
	 * The three label menus' clears, one key each rather than `Clear {property}` with a
	 * name spliced in: the property names are the view options' own labels, still English
	 * and owned by [[View options and config warnings]], and a language that inflects the
	 * noun after `Clear` could not reach it through a parameter either.
	 */
	'menu.clearRisk': 'Clear risk',
	'menu.clearPriority': 'Clear priority',
	'menu.clearAssignee': 'Clear assignee',
	/** Set iteration's own clear, which reads as an absence rather than as an act. */
	'menu.clearIteration': 'None',
	'menu.newAssignee': 'New assignee...',
	'menu.assignTitle': 'Assign item',
	'menu.assignField': 'Assignee',
	'menu.assignPlaceholder': 'Alex',
	'menu.assignCta': 'Assign',

	/**
	 * The dialogs in `ui/`. Every one of them takes its heading and its description from
	 * the caller, so what is keyed here is only what `ui/` spells for itself: the field
	 * labels, the placeholders and the buttons.
	 *
	 * **A field's LABEL is here; the key it submits under is not.** `DateFieldSpec.field`,
	 * `AbsenceResult.resource` and the rest are the caller's own vocabulary, read back by
	 * the layer that asked — data, and a locale that changed one would hand back an object
	 * its caller cannot destructure.
	 *
	 * `prompt.save` is one key for two forms because it is one act. `prompt.folderField` is
	 * one key for two forms for the same reason — both name the folder the thing lands in.
	 * The date ends are NOT shared: an absence has a start and an end, an iteration has a
	 * start and a target, and a language that inflects a label for what it belongs to needs
	 * them apart.
	 */
	'prompt.folderField': 'Folder',
	'prompt.save': 'Save',
	'prompt.create': 'Create',
	/** Empties one date field. `{name}` is the field's own label, handed in by the caller. */
	'prompt.clearDate': 'Clear {name}',
	'prompt.absenceResource': 'Resource',
	'prompt.absenceStart': 'Start',
	'prompt.absenceEnd': 'End',
	'prompt.iterationName': 'Name',
	'prompt.iterationStart': 'Start',
	'prompt.iterationTarget': 'Target',
	'prompt.iterationGoal': 'Goal',
	'prompt.newItemType': 'Type',
	'prompt.newItemTitle': 'Title',
	'prompt.newItemTitlePlaceholder': 'Item title',
	/**
	 * The folder placeholder is an EXAMPLE, not a default: the field submits empty as the
	 * vault root, and nothing reads this string back. A locale is free to suggest a folder
	 * name its readers would recognise.
	 */
	'prompt.newItemFolderPlaceholder': 'Backlog',
	'prompt.newItemFolderDesc':
		"New items are created here, and the choice is saved to the view options. Point this base's filter at the same folder so items show up. Leave empty for the vault root.",

	'stateColors.title': 'State colours',
	'stateColors.intro':
		'The colour each workflow state is drawn in on the roadmap’s dated axis, and in its legend. A chosen colour is fixed: unlike the default, it does not follow the theme between light and dark. Finished states are not listed: they are always green.',
	'stateColors.useDefault': 'Use the default colour',

	/** The manual dialog's accessible name. Sentence case, and not the view's registered name. */
	'manual.dialogTitle': 'Product backlog manual',

	/**
	 * The scaffold command. `{path}` is the file it made — vault content, so it arrives as
	 * a parameter and is never spelled here.
	 */
	'scaffold.heading': 'Create product backlog',
	'scaffold.folderDesc': 'A folder for your backlog items and a configured .base file will be created here.',
	'scaffold.cta': 'Create backlog',
	'scaffold.created': 'Created "{path}". Add your first epic from the view.',
	'scaffold.failed': 'Could not create the backlog. See the developer console for details.',

	/**
	 * The readme command, one whole sentence per outcome. `{path}` and `{previous}` are
	 * file paths and view names — vault content, parameters both. Its refusal on a broken
	 * configuration is `config.fixAll` below, shared with the toolbar's warning chip.
	 */
	'readme.created': 'Wrote "{path}".',
	'readme.updated': 'Updated "{path}".',
	'readme.unchanged': '"{path}" already matches this view. Nothing was written.',
	'readme.foreign': '"{path}" was not written by this plugin, so it was left alone. Move it aside to generate one.',
	'readme.replaced':
		'Updated "{path}", which documented "{previous}". A folder has one readme, so two views sharing it take turns.',
	'readme.failed': 'Could not write the readme. See the developer console for details.',
	/**
	 * One refusal in two shapes, over a fragment (`settings.sharedKey`) that each closes
	 * with its own period.
	 *
	 * `config.fixFirst` names the FIRST problem and is what five call sites report — the
	 * dependency picker, both absence flows, both creation flows and the backfill — plus
	 * the write gate, which has no key of its own for the reason stated below. `config.fixAll`
	 * names every problem, and is the toolbar warning's tooltip and accessible name as well
	 * as the readme command's refusal: a generated document is worth fixing the whole
	 * configuration for, and a warning chip is the surface whose whole job is the list.
	 *
	 * The readme's own key for this was `readme.configProblems` until the fragments landed.
	 * Two sentences that had to agree became one, which is the same "one key rather than
	 * two that can disagree" `gate.configProblems` is an absence for.
	 */
	'config.fixFirst': 'Fix the view options first: {problem}.',
	'config.fixAll': 'Fix the view options first: {problems}.',

	/**
	 * The write gate's four refusals. The two `console.error` prefixes beside them stay
	 * English and are not here: a developer console is not a user surface, the same line
	 * `commands/scaffold.ts` and `commands/readme.ts` already draw.
	 *
	 * `gate.configProblems` is `config.fixFirst` — the same refusal from the same gate,
	 * one key rather than two that can disagree — so it has no entry of its own.
	 */
	'gate.outsideFilter': 'That change would edit a note outside this base’s filter, so nothing was written.',
	'gate.nothingToUndo': 'Nothing to undo.',
	'gate.stillApplying': 'Still applying the previous change — try again in a moment.',
	'gate.updateFailed': 'Failed to update backlog items. See the developer console for details.',

	/**
	 * Every card move's live-region announcement, in the two shapes a gesture can have:
	 * one dimension, or the resources axis's two in ONE sentence. `{landing}` is the date
	 * half, and it is a whole clause from `destinationWords` rather than this catalog's —
	 * which is why the comma before it is IN the message and not at the call site.
	 */
	'move.announced': 'Moved "{title}" from {from} to {to}',
	'move.announcedLanding': 'Moved "{title}" from {from} to {to}, {landing}',

	/** The bar's dependency connector. `{title}` is the note's own title. */
	'link.drawDependency': 'Draw a dependency from {title}',

	/**
	 * The two resize grips. They share a tooltip because they ARE one gesture over two
	 * geometries (`wireResizeGrip`), and they differ in what each names: `{label}` is a
	 * property column's own display name, and the timeline's lead has no name but its own.
	 */
	'resize.column': 'Resize the {label} column',
	'resize.leadColumn': 'Resize the title column',
	'resize.shelf': 'Resize the shelf',
	'resize.gripTooltip': 'Drag to resize, or double click to reset. Focus it for the arrow keys and Home',

	/**
	 * What a resources move says when the card lands on the shelf anyway. Two whole
	 * sentences rather than one prefix with a clause appended: which of them applies is
	 * decided by whether the axis gave a REASON, and `{reason}` is `domain/bars.ts`'s own
	 * wording passed through — still English until that layer is swept, which is why it
	 * is a parameter here rather than a key.
	 */
	'move.shelvedNoDates': '"{title}" is assigned to {name}. Add a start or target date to place it in the row.',
	'move.shelvedReason': '"{title}" is assigned to {name}. {reason}, so it stays on the shelf.',

	/**
	 * The two palette commands. Obsidian prefixes both with the plugin's own NAME, which
	 * is never translated and so appears in no key here — `registerBasesView`'s `name` is
	 * that same identity and stays a literal in `main.ts`.
	 *
	 * Resolved once, at `onload`: Obsidian needs a restart to change its language, so a
	 * command name registered here cannot go stale while the app is running.
	 */
	'command.createBacklog': 'Create backlog',
	'command.writeReadme': 'Write backlog readme',

	'dependency.dependsOn': 'Depends on…',
	/** A prerequisite whose text names no note this base can see. */
	'dependency.unresolved': 'Does not resolve in this base',
	'dependency.remove': 'Remove dependency…',
	'dependency.removeEmpty': 'Remove the empty property',
	'dependency.propertyChanged':
		'The dependency property changed while the picker was open, so nothing was written.',
	/** `{property}` is the suggested KEY, which the plugin writes — never translated. */
	'dependency.setUp': 'Product Backlog: set up {property} to hold dependencies.',
	'dependency.noneLeft':
		'Nothing left to depend on: every other item would repeat this one or close a loop.',
	/** `{title}` is the note's own title in both — vault content, never translated. */
	'dependency.addPlaceholder': 'What must come before {title}?',
	'dependency.removePlaceholder': 'Stop {title} waiting for…',
	/**
	 * Two refusals that read alike in English and are different moments: the picker's
	 * choice went stale while it was open, and the note changed between the plan and the
	 * write landing. A language that marks the tense will separate them.
	 */
	'dependency.noteChanged': 'That note changed while the picker was open, so nothing was written.',
	'dependency.noteChangedBeforeWrite': 'That note changed before the write landed, so nothing was written.',

	/**
	 * Two whole sentences rather than one with the location spliced in: the filed-in
	 * clause was a ternary inside a template, which is the shape `TEXT_TERNARY` refuses
	 * and the shape a locale that puts the place first has no way into.
	 */
	'absence.addHeading': 'Add absence',
	'absence.addInFolder': 'Marks the resource unavailable for a stretch. Filed in "{folder}".',
	'absence.addInRoot': 'Marks the resource unavailable for a stretch. Filed in the vault root.',
	/**
	 * `absence.editHeading` is a DIALOG's heading and `absence.edit` is a MENU command;
	 * identical English is expected here and must not be deduplicated, since a language
	 * that inflects an imperative differently from a noun phrase separates them.
	 */
	'absence.editHeading': 'Edit absence',
	'absence.editDescription': 'Changes who is away and for how long. The note is renamed to match.',
	'absence.edit': 'Edit absence',
	'absence.delete': 'Delete absence',
	'absence.needsProperties': 'Name the assignee and both date properties before recording absences.',
	/** What the absence entry refuses, one whole sentence per reason. */
	'absence.nameResource': 'Name the resource this absence is for.',
	'absence.needsBothDates': 'An absence needs both a start and an end date.',
	'absence.endBeforeStart': 'The end date is before the start date.',
	'absence.deleted': 'Deleted "{title}".',
	'absence.deleteFailed': 'Could not delete the absence. See the developer console for details.',
	'absence.updated': 'Updated "{name}".',
	'absence.saveFailed': 'Could not save the absence. See the developer console for details.',
	'absence.created': 'Marked {resource} away — "{name}".',
	'absence.createFailed': 'Could not create the absence. See the developer console for details.',

	/**
	 * The new-item modal's heading. Its own key rather than `toolbar.newItem`'s or
	 * `menu.newChild`'s: identical English across surfaces is expected here and must not
	 * be deduplicated (this file's own rule) — a dialog heading and a button label
	 * diverge in the first language that inflects one of them.
	 */
	'create.headingAnyType': 'New item',
	'create.headingType': 'New {type}',
	/**
	 * Where the new item will land, as four WHOLE sentences. The call site used to build
	 * one from a `Under "…" · ` prefix and an `in folder "…"` fragment, then sentence-case
	 * the fragment with `where[0].toUpperCase()` when the prefix was absent — which is
	 * wrong the moment the fragment comes from a catalog: the capital belongs IN the
	 * message, and not every script has case at all. `Every surface translated`'s own
	 * acceptance criterion.
	 */
	'create.detailUnderInFolder': 'Under "{parent}" · in folder "{folder}"',
	'create.detailUnderRoot': 'Under "{parent}" · in the vault root',
	'create.detailInFolder': 'In folder "{folder}"',
	'create.detailRoot': 'In the vault root',
	'create.whereLabel': 'Where will this go?',
	'create.created': 'Created "{name}".',
	'create.failed': 'Could not create the item. See the developer console for details.',
	/**
	 * The iteration flow's own words. `create.iterationCreated` reads exactly like
	 * `create.created` above and is a separate key for the rule stated at the top of this
	 * file: what was made is a different thing, and a language that agrees the participle
	 * with its object separates them. Its call-to-action pair is likewise not
	 * `prompt.create` / `prompt.save`, which are the PROMPT's own buttons; these are handed
	 * in by this caller.
	 */
	'create.iterationHeading': 'New iteration',
	'create.iterationCta': 'Create',
	'create.iterationEditHeading': 'Edit "{title}"',
	'create.iterationEditCta': 'Save',
	'create.iterationDates':
		'Dates are inclusive: an iteration runs from its start to its target, both days included.',
	/** What the iteration entry refuses, one whole sentence per reason. */
	'create.iterationNameRequired': 'Give the iteration a name.',
	'create.iterationReversed': 'The target is before the start.',
	'create.iterationGone': 'That iteration is no longer there. Nothing was written.',
	'create.iterationCreated': 'Created "{name}".',
	'create.iterationFailed': 'Could not create the iteration. See the developer console for details.',

	/**
	 * The backfill's outcome, as two WHOLE sentences picked between rather than one frame
	 * with a clause appended — `emptyState.noAxisBody` and its half-set sibling are the
	 * same decision, and for the same reason: a locale that leads with the follow-up has no
	 * way into a middle the caller assembled.
	 *
	 * `{summary}` is still a list of fragments joined by `list()`, which is grammar and
	 * follows the catalog's locale. `init.adopted` is one of those fragments;
	 * `init.updatedItems` above is the other. The plugin's own NAME leads both sentences
	 * and is not translated — it is the name, in every language.
	 */
	'init.adopted': 'set up {properties}',
	'init.outcome': 'Product Backlog: {summary}.',
	'init.outcomeWithColumns':
		'Product Backlog: {summary}. Add them in the properties menu to show them as columns.',
	'init.nothingToDo': 'All items already have the properties this view writes.',

	/** `{parts}` is joined by `list()` — grammar, so it follows the catalog's locale. */
	'undo.outcome': 'Undo: {parts}.',

	'plan.clearHorizon': 'Clear horizon',
	/** `{title}` is the note's own title — vault content, never translated. */
	'plan.scheduleHeading': 'Schedule "{title}"',
	'plan.scheduleDescription': 'Pick a date for each end, or clear a field to remove that date.',
	/**
	 * What the schedule entry refuses. Three whole sentences and not one with the other
	 * end spliced in: a one-end entry is refused against a date the reader cannot see, so
	 * it NAMES that date, and "cannot be before the start date" about a field that is not
	 * on screen reads as a bug rather than as a rule.
	 */
	'plan.targetBeforeStartDate': "The target date cannot be before this item's start date ({start}).",
	'plan.startAfterTargetDate': "The start date cannot be after this item's target date ({target}).",
	'plan.targetBeforeStart': 'The target date cannot be before the start date.',

	'stateColors.noStates':
		'No workflow states to colour yet. Name a state property and list its states in the view options.',

	/** The write gate's own failure notice — every view's batch runs through it, so the
	 * message names neither "backlog items" nor any other one view's own vocabulary. */
	'writeGate.applyFailed': 'Failed to apply the change. See the developer console for details.',

	/** The Bases view type's own label, shown wherever Obsidian lists view types to add —
	 * unlike `registerBacklogView.ts`'s `name`, this is not the plugin's identity (only one
	 * such exemption is sanctioned, and the backlog view holds it), so it is ordinary UI
	 * text and belongs here rather than behind an eslint-disable. */
	'estimation.viewName': 'Estimation',

	/** The estimation view's own states — loading, unconfigured, misconfigured, and its
	 * own empty result set. */
	'estimation.loading': 'Loading estimation view…',
	'estimation.empty.unconfigured': 'No estimation model is configured for this view.',
	'estimation.empty.hint':
		'Bind the suggested properties and stub them onto the results, or name your own in the view options.',
	'estimation.empty.useDefaults': 'Use recommended defaults',
	'estimation.problems.lead': "Fix the estimation model in this view's options first:",
	/**
	 * The guided setup action refusing itself: the bindings it would make leave the model
	 * broken, so nothing is bound and nothing is written.
	 *
	 * `{problems}` is a LIST: the caller hands `t()` the ARRAY and `t()` does the joining
	 * (`Intl.ListFormat`, in the locale of the message it actually rendered) — the readme
	 * notices' own shape, and the shape `t.ts` asks callers for.
	 *
	 * IT CARRIES THE TERMINAL PERIOD, and the sentence that said otherwise was wrong about
	 * its own inputs. It read "no terminal period: each problem is already a whole sentence
	 * carrying one" — true of exactly one of the five things `modelProblems` returns, and
	 * that one only until `settings.sharedKey` became a fragment. Its four siblings —
	 * `no dimensions are declared`, the two pair refusals and the output-range refusal —
	 * have always been lowercase and unpunctuated, so this notice has been ending without a
	 * full stop for most of what it can say since it was written.
	 *
	 * The history in that sentence belonged to the readme command, whose problems WERE whole
	 * sentences and whose `'; '` join rendered `"…".; "…"..`. Carried here, it described a
	 * different message's inputs.
	 */
	'estimation.problems.blocked': 'Fix the estimation model first: {problems}.',
	/** Said rather than left silent, for `estimation.problems.blocked`'s own reason: the
	 *  guided empty state is still on screen, so a button that returned quietly would
	 *  simply look dead. */
	'estimation.init.busy': 'Another change is being saved. Try the setup again once it finishes.',
	'estimation.empty.noResults': 'No results to estimate.',

	/** The prioritized list's column labels — also each sort button's own accessible name
	 * while nothing is sorted BY it. The ACTIVE column's name states the direction instead
	 * (`estimation.sort.*` below), because `aria-sort` is not a supported attribute on a
	 * button at all and is announced to nobody. */
	'estimation.column.item': 'Item',
	'estimation.column.value': 'Value',
	'estimation.column.coverage': 'Coverage',
	'estimation.column.confidence': 'Confidence',
	'estimation.column.effort': 'Effort',
	'estimation.column.currency': 'Currency',
	'estimation.column.indicator': 'Indicator',
	'estimation.operand.ease': 'Ease',
	'estimation.operand.value': 'Value',
	'estimation.operand.adjustedValue': 'Adjusted value',

	/** A blocked indicator cell's tooltip — four sentences rather than one, because a
	 *  reader reading this is trying to repair it: an unanswered operand wants a score, a
	 *  nonpositive divisor wants the stored value corrected, an unbound operand wants a
	 *  property bound to it in the view options, and an unknown id wants the operands box
	 *  edited. */
	'estimation.indicator.unanswered': 'No figure: {operand} is not answered',
	'estimation.indicator.unknown': 'No figure: nothing in this model is called {operand}',
	'estimation.indicator.nonpositive': 'No figure: {operand} has to be above zero to divide by',
	'estimation.indicator.unbound': 'No figure: {operand} has no property bound to it yet',

	/** The active sort header's accessible name. {column} is the column's own label above —
	 * a catalog string, not data. The GLYPH beside it carries the same fact for a sighted
	 * reader (`chevron-up`/`chevron-down`), per DESIGN.md's Shape-Before-Colour Rule. */
	'estimation.sort.ascending': '{column}, sorted ascending',
	'estimation.sort.descending': '{column}, sorted descending',

	/** The currency chip's word for what a stored total says about itself — never the
	 * rubric or a property name, which are data and never enter this catalog. */
	'estimation.currency.current': 'Current',
	'estimation.currency.stale': 'Needs re-estimation',
	'estimation.currency.foreign': 'Another model',
	'estimation.currency.handwritten': 'Hand-written',
	'estimation.currency.orphan': 'Inputs gone',
	'estimation.currency.none': '—',

	/** The per-item panel: one row per dimension and per bound scale, the two grouped
	 * scales' own heading, the clamp note, and the two labelled derived lines. Rubric
	 * sentences and dimension labels are never here — they are the MODEL's own data
	 * (`docs/requirements/A rubric for every point.md`), reaching the DOM straight from
	 * the saved model rather than through this catalog. */
	'estimation.panel.confidence': 'Confidence',
	'estimation.panel.effort': 'Effort',
	'estimation.panel.complexity': 'Complexity',
	'estimation.panel.valueDimensions': 'Value dimensions',
	/** All three FIXED scales, not just two. Nothing computes the total from confidence, so
	 *  it is not a value dimension — and it is drawn between the dimensions and this heading,
	 *  so a heading above the first dimension used to sweep it in. Renamed from
	 *  `effortComplexity` rather than joined by a second key: one heading, three scales. */
	'estimation.panel.scales': 'Confidence, effort and complexity',
	'estimation.panel.whyThisScored': 'Why this scored what it scored',
	/** A dimension or scale's stored answer fell outside its own declared range. */
	'estimation.clamped': 'Out of range — read as {value}',
	/** In range, so counted as it stands, but not one of the points the rubric describes. */
	'estimation.betweenPoints': 'Between points — counted as {value}',
	/** The per-row clear control's accessible name — {label} is the dimension's or
	 * scale's own (data) label, threaded through rather than joined by this string. */
	'estimation.panel.clear': 'Clear {label}',
	'estimation.panel.term': '{label} {score} × {weight}%',
	'estimation.panel.adjustedValue': 'Confidence-adjusted value: {value}',
	/** The configured indicator's own line — {name} is the configured label, or its
	 *  formula when unnamed (`indicatorFormula`), never data assembled at the call site.
	 *  The three block sentences below it say which repair fits: score the operand, fix
	 *  the stored divisor, or bind a property — never "is not answered" for all three. */
	'estimation.panel.indicator': '{name}: {value}',
	'estimation.panel.indicatorUnanswered': '{name}: no figure — {operand} is not answered',
	'estimation.panel.indicatorUnknown': '{name}: no figure — nothing in this model is called {operand}',
	'estimation.panel.indicatorNonpositive': '{name}: no figure — {operand} has to be above zero to divide by',
	'estimation.panel.indicatorUnbound': '{name}: no figure — {operand} has no property bound to it yet',
	'estimation.panel.removeOrphan': 'Remove the orphaned total',
	/** Says what the action does to the NOTE, not which currency word offered it — two
	 *  currencies (`stale` and `foreign`) offer the same action, so naming either in the
	 *  label would make it wrong half the time. */
	'estimation.panel.restamp': 'Recalculate the stored total from the answers on this note',

	/** The toolbar's own two actions and its count. `{scored} of {total} scored` is the
	 *  filtered count's idiom — one quantity in two parts, so the pair reads as one fact. */
	'estimation.toolbar.init': 'Bind and backfill the estimation properties',
	'estimation.toolbar.scored': '{scored} of {total} scored',

	/**
	 * Four sentences the sweep of `view/` first left as English inside keyed neighbours,
	 * found by review on 2026-08-21. Each sat in a stated blind spot rather than at a
	 * spelling any rule reads: two were returned from a helper, one is a template whose
	 * first quasi is empty, and one is a clause joined at its call site.
	 */
	'lane.unreadableStart': 'an unreadable start date',
	'lane.unreadableTarget': 'an unreadable target date',
	'lane.daysLostShort': { one: '{count}d lost', other: '{count}d lost' },
	'lane.daysLostWholeShort': { one: 'all {count}d', other: 'all {count}d' },
	'lane.awayWeeks': { one: '{count} wk away', other: '{count} wk away' },
	/**
	 * The bar's own tooltip, as two WHOLE sentences rather than one frame with a state
	 * clause appended — the shape `emptyState.noAxisBody` and its half-set sibling set, and
	 * the reason is the same: a locale that leads with the state has no way into a middle
	 * the caller assembled with an em dash.
	 */
	'lane.barTooltip': '{title} — {span}',
	'lane.barTooltipWithState': '{title} — {span} — {state}',
	'timeline.waitsTooltip': '{title} — {waits}',
	/** The tag cell's own tooltip; `{tags}` is vault content joined as grammar. */
	'column.tagsTooltip': '{label}: {tags}',
} as const;
