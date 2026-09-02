/**
 * Every case fold in `src/`, classified — the data `foldSites.test.ts` checks the tree
 * against.
 *
 * A fold is one of two things and the two look identical in the source. **Identity** folds
 * decide what something *is*: a type name matched against the ladder, a state matched
 * against a column, a persisted option key in the `.base` file. Those must stay
 * `toLowerCase()`, which is locale-independent by specification — under
 * `toLocaleLowerCase('tr')` a state called `In progress` keys on `wiplimit.ın progress`,
 * so every Turkish user's WIP limits silently reset and a vault configured in one locale
 * reads differently in another. **Matching** folds compare what the user typed against
 * what they can see, and those should follow the user's locale, or the filter fails to
 * find a note that is plainly on screen. See
 * `docs/requirements/Locale-aware sorting and formatting.md`.
 *
 * **Every entry here is `identity` except one, and that one is `foldForMatch` itself** —
 * the helper in `src/i18n/t.ts` whose whole job is matching. That is the finished shape
 * rather than a holding position: the matching SITES do not appear here at all, because
 * they call `foldForMatch(x)` instead of spelling a fold of their own, so a matching fold
 * has exactly one spelling in `src/` and this table's rule reads "everything else is
 * identity".
 *
 * **The table was all-identity for one commit on purpose**, and that is what made the
 * flip reviewable: the sites that changed category are exactly the rows this file LOST —
 * the shelf's title search, the folder and tag suggests, and the prompt's duplicate
 * warning — and the test below refuses a stale row, so the code edit and the table edit
 * cannot be made separately.
 *
 * **No `why` begins `UNCERTAIN — ` any more, and that spelling is still how to find one.**
 * Grep it rather than trusting a count here: three earlier drafts of this paragraph each
 * carried a number that was wrong by the time it was read, and a number typed into a
 * comment is checked by nobody. The five that carried it were decided on 2026-09-02 —
 * three stayed (`defaultModel.ts`, `scoringModel.ts` and `view/childrenList.ts` all lower
 * a label or a type name for the MIDDLE of a sentence, which is grammar and so follows the
 * CATALOG locale, not the requested one `foldForMatch` takes, and no catalog-locale fold
 * exists for them to move to) and two left (the prompt's duplicate warning, whose fold is
 * never stored, keyed or compared to a persisted value — the note is created under the raw
 * typed name whatever it decides, so the only thing two locales can disagree about is
 * whether one advisory sentence appears). A `why` that still reads `DECIDED not matching`
 * is a call somebody made; `UNCERTAIN` remains the honest answer for a call nobody has,
 * and identity is where such a fold sits.
 *
 * One entry per CALL EXPRESSION, not per line and not per distinct spelling: a single line
 * can carry two folds, and a spelling like `typeName.toLowerCase()` occurs eight times in
 * one file with a different reason each time. Identical `file`+`text` rows therefore
 * repeat, and the test compares the two multisets rather than two sets — which means it
 * checks HOW MANY calls each spelling has and can bind no row to a particular one of them.
 * A `why` inside such a group is read by a person, not by the suite, so a wrong one can
 * ride along with a category flip and nothing will say so.
 *
 * No line numbers: they are correct until the next insertion above them (root
 * `CLAUDE.md`, "address code by name, not by position"). Sorted by `file`, then `text`.
 */
export interface FoldSite {
	/** Repo-relative, POSIX separators. */
	file: string;
	/** The call expression's source text, whitespace-collapsed. */
	text: string;
	kind: 'identity' | 'matching';
	/** What the fold decides. Required for `identity`. */
	why: string;
}

export const FOLD_SITES: FoldSite[] = [
	{ file: 'src/domain/backlogReadme.ts', text: 's.value.toLowerCase()', kind: 'identity', why: 'index key for the states this workflow offers, asked of each done value' },
	{ file: 'src/domain/backlogReadme.ts', text: 's.value.toLowerCase()', kind: 'identity', why: 'matches an offered state against the done values, for the README table' },
	{ file: 'src/domain/backlogReadme.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the observed state values, asked of each offered state' },
	{ file: 'src/domain/backlogReadme.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'dedupe key for the states the menus already offer' },
	{ file: 'src/domain/backlogReadme.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'matches a configured done value against the offered states' },
	{ file: 'src/domain/backlogReadme.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the configured done values, asked of each offered state' },
	{ file: 'src/domain/backlogReadme.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'matches an offered state against the observed ones, to label its source' },
	{ file: 'src/domain/backlogReadme.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'matches an observed state against the ones already listed' },
	{ file: 'src/domain/backlogReadme.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'dedupe key for an observed state joining the list' },
	{ file: 'src/domain/board.ts', text: 'col.state.toLowerCase()', kind: 'identity', why: 'index key for the case-insensitive state-to-column map' },
	{ file: 'src/domain/board.ts', text: 'col.state?.toLowerCase()', kind: 'identity', why: 'matches a column against the state being named out loud' },
	{ file: 'src/domain/board.ts', text: 'noStateLabel().toLowerCase()', kind: 'identity', why: 'asks whether an observed state collides with the no-state column label' },
	{ file: 'src/domain/board.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'looks a card state up in the state-to-column map' },
	{ file: 'src/domain/board.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'matches a column state against the workflow done values' },
	{ file: 'src/domain/board.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'the state being named, matched against each column own state' },
	{ file: 'src/domain/board.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the workflow done values, asked of each column' },
	{ file: 'src/domain/board.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'asks whether an observed state already has a column' },
	{ file: 'src/domain/board.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'index key for the column an observed state mints' },
	{ file: 'src/domain/defaultModel.ts', text: 'd.label.toLowerCase()', kind: 'identity', why: 'DECIDED not matching — lower-cases a label for the middle of a sentence, which is grammar and would follow the CATALOG locale, never the requested one foldForMatch takes; and these labels are shipped literals inside the model FINGERPRINT, so a fold that varied would stamp two models' },
	{ file: 'src/domain/itemTypes.ts', text: 'ABSENCE_TYPE.toLowerCase()', kind: 'identity', why: 'matches a type name against the declared absence type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'DELIVERABLE_TYPE.toLowerCase()', kind: 'identity', why: 'matches a type name against the declared Deliverable type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'ITERATION_TYPE.toLowerCase()', kind: 'identity', why: 'matches a type name against the declared Iteration type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'RELEASE_TYPE.toLowerCase()', kind: 'identity', why: 'matches a type name against the declared Release type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'RESOURCE_TYPE.toLowerCase()', kind: 'identity', why: 'matches a type name against the declared Resource type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'settings.focusLevel.trim().toLowerCase()', kind: 'identity', why: 'canonicalizes the configured focus level before matching ALL_TYPES' },
	{ file: 'src/domain/itemTypes.ts', text: 't.toLowerCase()', kind: 'identity', why: 'matches a type name against the test ladder rungs' },
	{ file: 'src/domain/itemTypes.ts', text: 't.toLowerCase()', kind: 'identity', why: 'matches a type name against the plan ladder rungs' },
	{ file: 'src/domain/itemTypes.ts', text: 't.toLowerCase()', kind: 'identity', why: 'matches a type name against the configured extra types' },
	{ file: 'src/domain/itemTypes.ts', text: 't.toLowerCase()', kind: 'identity', why: 'matches a type name against the declared marker types' },
	{ file: 'src/domain/itemTypes.ts', text: 't.toLowerCase()', kind: 'identity', why: 'matches the focus level against ALL_TYPES' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'canonicalizes the type name whose ladder is being chosen' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the configured extra types' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the declared marker types' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the Iteration type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the Release type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the Resource type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the absence type name' },
	{ file: 'src/domain/itemTypes.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name tested against the Deliverable type name' },
	{ file: 'src/domain/model.ts', text: 'focus.toLowerCase()', kind: 'identity', why: 'matches the focus target against a plan ladder rung' },
	{ file: 'src/domain/model.ts', text: 'focus.toLowerCase()', kind: 'identity', why: 'canonicalizes an extra-type focus for matching type names' },
	{ file: 'src/domain/model.ts', text: 'item.typeName.toLowerCase()', kind: 'identity', why: 'asks whether an item type is declared, so the prune keeps a parentless one' },
	{ file: 'src/domain/model.ts', text: 'item.typeName.toLowerCase()', kind: 'identity', why: 'canonicalizes an item type to find its rung on the ladder' },
	{ file: 'src/domain/model.ts', text: 'item.typeName?.toLowerCase()', kind: 'identity', why: 'matches an item type against the focused extra type' },
	{ file: 'src/domain/model.ts', text: 'l.toLowerCase()', kind: 'identity', why: 'each plan level, matched against the focus target' },
	{ file: 'src/domain/model.ts', text: 'l.toLowerCase()', kind: 'identity', why: 'each ladder rung, matched against an item type' },
	{ file: 'src/domain/model.ts', text: 't.toLowerCase()', kind: 'identity', why: 'index key for the set of declared type names the prune keeps' },
	{ file: 'src/domain/noteFields.ts', text: 'a.toLowerCase()', kind: 'identity', why: 'sameValue — the one rule deciding whether two vocabulary values are one value' },
	{ file: 'src/domain/noteFields.ts', text: 'b.toLowerCase()', kind: 'identity', why: 'sameValue — the other side of that same one rule' },
	{ file: 'src/domain/noteFields.ts', text: 'tag.toLowerCase()', kind: 'identity', why: 'tagKey — the one place "same tag" is decided' },
	{ file: 'src/domain/readItems.ts', text: 'deliverableStateValue.toLowerCase()', kind: 'identity', why: 'matches a note Deliverable state against that workflow done values' },
	{ file: 'src/domain/readItems.ts', text: 'stateValue.toLowerCase()', kind: 'identity', why: 'matches a note state against the configured done values' },
	{ file: 'src/domain/readItems.ts', text: 'testStateValue.toLowerCase()', kind: 'identity', why: 'matches a note test state against that workflow done values' },
	{ file: 'src/domain/readItems.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'canonicalizes the configured done values for the membership test' },
	{ file: 'src/domain/readItems.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'canonicalizes the Deliverable workflow done values for the membership test' },
	{ file: 'src/domain/readItems.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'canonicalizes the test workflow done values for the membership test' },
	{ file: 'src/domain/readmeStamps.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the state values the workflow lists, asked of each started state' },
	{ file: 'src/domain/readmeStamps.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'matches a configured started state against the listed values' },
	{ file: 'src/domain/roadmap.ts', text: 'b.value.toLowerCase()', kind: 'identity', why: 'index key for the case-insensitive horizon-to-bucket map' },
	{ file: 'src/domain/roadmap.ts', text: 'reading.value.toLowerCase()', kind: 'identity', why: 'looks a card horizon up in the bucket map' },
	{ file: 'src/domain/roadmap.ts', text: 'reading.value.toLowerCase()', kind: 'identity', why: 'index key for the bucket an undeclared horizon mints' },
	{ file: 'src/domain/roadmap.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'looks a context row horizon up in the bucket map' },
	{ file: 'src/domain/scoringModel.ts', text: 'd.label.toLowerCase()', kind: 'identity', why: 'DECIDED not matching — same shape as defaultModel: a label lowered for the middle of a sentence is grammar, so it follows the CATALOG locale rather than the requested one, and no catalog-locale fold exists to move it to. That the label can be USER data makes it a candidate for such a fold one day, never for this one' },
	{ file: 'src/domain/settings.ts', text: 'name.toLowerCase()', kind: 'identity', why: 'nameTable — the index key every per-state table is read back by' },
	{ file: 'src/domain/settings.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'PERSISTED option key wipLimit.<state> in the .base file' },
	{ file: 'src/domain/settings.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'PERSISTED option key columnPolicy.<state> in the .base file' },
	{ file: 'src/domain/settings.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'the state value matched against the configured done values' },
	{ file: 'src/domain/settings.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'the state value matched against the configured started states' },
	{ file: 'src/domain/settings.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the done values, asked of each observed value' },
	{ file: 'src/domain/settings.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'asks whether an observed value is already one of the done values' },
	{ file: 'src/domain/settings.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'each configured done value, matched against the state in hand' },
	{ file: 'src/domain/settings.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'each configured started state, matched against the state in hand' },
	{ file: 'src/domain/settings.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'dedupe key merging suggested and observed vocabulary values' },
	{ file: 'src/domain/settingsConsistency.ts', text: 'o.toLowerCase()', kind: 'identity', why: 'asks whether a vocabulary repeats a value dedupe() would have dropped' },
	{ file: 'src/domain/settingsConsistency.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'the configured state names, in the form nameTable keys them by' },
	{ file: 'src/domain/settingsConsistency.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'the colourable state names, in the form stateColorKey keys them by' },
	{ file: 'src/domain/settingsConsistency.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'the vocabulary value being checked for a repeat' },
	{ file: 'src/domain/settingsConsistency.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'the done values, in the form the per-state tables key them by' },
	{ file: 'src/domain/settingsResolve.ts', text: 's.toLowerCase()', kind: 'identity', why: 'asks whether a state is done, so it may carry no WIP limit' },
	{ file: 'src/domain/settingsResolve.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'dedupe key for a configured vocabulary list' },
	{ file: 'src/domain/settingsResolve.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the effective done values' },
	{ file: 'src/domain/shelf.ts', text: 'displayType(card.item).toLowerCase()', kind: 'identity', why: 'canonicalizes the badge type name before matching ALL_TYPES' },
	{ file: 'src/domain/shelf.ts', text: 't.toLowerCase()', kind: 'identity', why: 'matches the badge type against ALL_TYPES to pick the group' },
	{ file: 'src/domain/stateColors.ts', text: 'raw.trim().toLowerCase()', kind: 'identity', why: 'canonicalizes a stored colour to the one #rrggbb or named form the picker emits' },
	{ file: 'src/domain/stateColors.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'PERSISTED option key stateColor.<state> in the .base file' },
	{ file: 'src/domain/typeVocabulary.ts', text: 'name.toLowerCase()', kind: 'identity', why: 'byName — the lookup key for every table nameTable keyed' },
	{ file: 'src/domain/typeVocabulary.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'PERSISTED option key typeFolder.<type> in the .base file' },
	{ file: 'src/domain/viewOptions.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'asks whether a state is done, so no WIP-limit option is declared for it' },
	{ file: 'src/domain/viewOptions.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the done values the option schema excludes' },
	{ file: 'src/domain/vocabulary.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'index key for the workflow done values' },
	{ file: 'src/domain/vocabulary.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'asks whether a value is done, for the open half of the menu order' },
	{ file: 'src/domain/vocabulary.ts', text: 'v.toLowerCase()', kind: 'identity', why: 'asks whether a value is done, for the done half of the menu order' },
	{ file: 'src/domain/vocabulary.ts', text: 'value.toLowerCase()', kind: 'identity', why: 'firstSeen — the default identity key a vocabulary is deduped by' },
	{ file: 'src/i18n/locale.ts', text: 'name.toLowerCase()', kind: 'identity', why: 'matches a shipped catalog name against the wanted language tag' },
	{ file: 'src/i18n/locale.ts', text: 'name.toLowerCase()', kind: 'identity', why: 'matches a shipped catalog name against the wanted tag base language' },
	{ file: 'src/i18n/locale.ts', text: 'tag.toLowerCase()', kind: 'identity', why: 'canonicalizes a language TAG for catalog lookup; a tag case is convention, and folding it with a locale would be circular' },
	{ file: 'src/i18n/t.ts', text: "value.toLocaleLowerCase(active.requested)", kind: 'matching', why: 'foldForMatch — the one fold in src/ whose job is matching, and the helper every matching site is meant to call' },
	{ file: 'src/storage/frontmatter.ts', text: 'leaving.toLowerCase()', kind: 'identity', why: 'the state being left, in the match that decides whether a write moves anything' },
	{ file: 'src/storage/frontmatter.ts', text: 'state.toLowerCase()', kind: 'identity', why: 'the state being written, in that same match' },
	{ file: 'src/view/childrenList.ts', text: 'type.toLowerCase()', kind: 'identity', why: 'DECIDED not matching — a type name lowered for the middle of a t() sentence is grammar, so it follows the CATALOG locale; foldForMatch takes the REQUESTED one and is the wrong tool. Nothing compares this to anything' },
	{ file: 'src/view/interactions/keyboard.ts', text: 'evt.key.toLowerCase()', kind: 'identity', why: 'KeyboardEvent.key is a protocol value, matched against z for undo in the tree' },
	{ file: 'src/view/interactions/keyboard.ts', text: 'evt.key.toLowerCase()', kind: 'identity', why: 'KeyboardEvent.key is a protocol value, matched against z for undo on the board' },
	{ file: 'src/view/interactions/menu.ts', text: 'item.typeName.toLowerCase()', kind: 'identity', why: 'the type an item carries, in the comparison Set type checks by' },
	{ file: 'src/view/interactions/menu.ts', text: 'type.toLowerCase()', kind: 'identity', why: 'the type a menu entry would set, in that same comparison' },
	{ file: 'src/view/render/badges.ts', text: 'l.toLowerCase()', kind: 'identity', why: 'each plan level, matched against a type name to pick its badge class' },
	{ file: 'src/view/render/badges.ts', text: 'typeName.toLowerCase()', kind: 'identity', why: 'the type name whose badge class is being chosen' },
	{ file: 'src/view/viewState.ts', text: '(value ?? \'\').toLowerCase()', kind: 'identity', why: 'PERSISTED fold key a collapsed column is stored under in localStorage' },
];
