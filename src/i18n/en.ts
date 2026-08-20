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
	 * The shelf's search affordances. They read `Search unplaced` and `Clear unplaced
	 * search`, and they are whole keys rather than `placement.unplaced` lowercased and
	 * concatenated: case is not a transformation every language survives — German
	 * capitalizes every noun — and the word order around it is not universal either.
	 */
	'shelf.search': 'Search unplaced',
	'shelf.clearSearch': 'Clear unplaced search',

	/**
	 * The marker row's header on both grid axes. The TYPE names inside it are data and
	 * arrive as parameters; only the separator and the pluralizing `s` are this catalog's,
	 * the same ceiling `count.childrenOfType` carries.
	 */
	'lane.markersHeader': '{markers}s',
	'lane.markersHeaderBoth': '{first}s · {second}s',

	'settings.sharedKey': 'The {properties} properties share the key "{key}".',

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
	 * file paths and view names — vault content, parameters both.
	 *
	 * `{problems}` is a LIST, joined by `Intl.ListFormat` in the catalog's own locale
	 * rather than by a separator at the call site. The problems themselves are still
	 * English until `View options and config warnings` runs.
	 */
	'readme.created': 'Wrote "{path}".',
	'readme.updated': 'Updated "{path}".',
	'readme.unchanged': '"{path}" already matches this view. Nothing was written.',
	'readme.foreign': '"{path}" was not written by this plugin, so it was left alone. Move it aside to generate one.',
	'readme.replaced':
		'Updated "{path}", which documented "{previous}". A folder has one readme, so two views sharing it take turns.',
	/**
	 * No terminal period: each problem is a whole sentence with one of its own, so the
	 * `'; '` this replaced rendered `"…".; "…"..`. That is the one thing about this notice
	 * that is not a pure text move, and it is the punctuation rather than the wording.
	 */
	'readme.configProblems': 'Fix the view configuration first: {problems}',
	'readme.failed': 'Could not write the readme. See the developer console for details.',

	/** The write gate's own failure notice — every view's batch runs through it, so the
	 * message names neither "backlog items" nor any other one view's own vocabulary. */
	'writeGate.applyFailed': 'Failed to apply the change. See the developer console for details.',

	/** The estimation view's own states — loading, unconfigured, misconfigured, and its
	 * own empty result set. */
	'estimation.loading': 'Loading estimation view…',
	'estimation.empty.unconfigured': 'No estimation model is configured for this view.',
	'estimation.empty.hint':
		'Bind the suggested properties and stub them onto the results, or name your own in the view options.',
	'estimation.empty.useDefaults': 'Use recommended defaults',
	'estimation.problems.lead': 'Fix the estimation model first:',
	/** The guided setup action refusing itself: the bindings it would make leave the model
	 *  broken, so nothing is bound and nothing is written. {problem} is the first one. */
	'estimation.problems.blocked': 'Fix the estimation model first: {problem}',
	'estimation.empty.noResults': 'No results to estimate.',

	/** The prioritized list's column labels — also each sort button's own accessible
	 * name, so no separate string names the control. */
	'estimation.column.item': 'Item',
	'estimation.column.value': 'Value',
	'estimation.column.coverage': 'Coverage',
	'estimation.column.confidence': 'Confidence',
	'estimation.column.effort': 'Effort',
	'estimation.column.currency': 'Currency',

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
	'estimation.panel.valueToEffort': 'Value to effort: {value}',
	'estimation.panel.removeOrphan': 'Remove the orphaned total',
} as const;
