# User manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a six-section manual inside the view, reachable from the toolbar and from the four places its questions are actually asked.

**Architecture:** Content is pure data (`view/manual/`), composition is `view/`, and the dialog is a leaf in `ui/` that takes its sections as a parameter — because `ui/` may not import `domain/`. One opener serves all seven doors, and focus on close is a caller-supplied callback so `ui/` decides no policy. The dialog is built on Obsidian's own settings-modal classes, so nearly all chrome comes from the app.

**Tech Stack:** TypeScript, Obsidian 1.10.2+ API, vitest with a jsdom environment and an `obsidian` module mock, esbuild, CSS partials assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-09-user-manual-and-round-close-design.md`

## Global Constraints

- **Layers.** `main → commands → view → storage → domain`; each may reach anything below it and nothing above. `ui/` is a leaf that imports none of them. Violations fail `npm run lint`.
- **`ui/` may not import `domain/`.** The dialog takes content as a parameter. Enforced by `no-restricted-imports` in `eslint.config.mjs`.
- **The manual writes nothing.** No `processFrontMatter`, no `vault.create`, no `load/saveLocalStorage`. Those three are banned outside `storage/` by `no-restricted-syntax` anyway.
- **Size budgets.** `max-lines: 400` per `src/` module and `max-lines-per-function: 100`, both `skipBlankLines` and `skipComments`. `test/**` gets `max-lines: 450`. CSS partials are capped at 400 physical lines by `scripts/styles-assemble.mjs`.
- **Marketplace rules:** sentence-case UI text, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`, real `<button>` elements.
- **Register rule 7:** every module in `src/` must be named as a whole path in some use case's `## Where it lives` (or an ADR's `## Decision`). A task that creates a module and does not do this **fails `npm run docs` in its own commit.** Every task below folds that edit in.
- **Coverage thresholds only ever go up.** `vitest.config.mts` currently holds `statements: 98.3, branches: 94.6, functions: 99.5, lines: 99.4`.
- **Definition of done for every commit:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register).
- **Every new CSS partial must be imported by `styles/index.css`**, or `assembleStyles()` throws.

---

## File Structure

| File | Responsibility |
| --- | --- |
| Create `src/ui/manualDialog.ts` | `ManualSection`/`ManualEntry` types, the `ManualDialog` modal, and `openManual`. Knows nothing of the backlog. |
| Create `src/view/manual/typesSection.ts` | The one generated section — built from `ALL_TYPES`. |
| Create `src/view/manual/sections.ts` | The five authored sections as data; setup entries carry the option keys they explain. |
| Create `styles/manual.css` | The sidebar/pane split and content shapes. Everything else comes from Obsidian. |
| Modify `styles/index.css` | Import the new partial. |
| Modify `styles/toolbarFit.css` | Add `.pbl-help-btn` to the step-2 shed group. |
| Modify `src/view/render/toolbar.ts` | The `?` button; help links on the busy indicator and the config warning. |
| Modify `src/view/render/toolbarControls.ts` | The `⋯` mirror entry. |
| Modify `src/view/render/emptyStates.ts` | Help link on **all three** empty states. |
| Modify `src/view/interactions/create.ts` | Help link in the new-item modal. |
| Modify `src/ui/prompts.ts` | Accept an optional help affordance on the new-item prompt. |
| Modify `test/docs/surfaces.test.ts` | Assert every `getViewOptions(config)` key is claimed once, by an exact key or a `prefix.*` family. |

---

### Task 1: The dialog, and the one opener

**Files:**
- Create: `src/ui/manualDialog.ts`
- Create: `styles/manual.css`
- Modify: `styles/index.css`
- Modify: `docs/requirements/A help button for the item types.md` (`## Where it lives`)
- Test: `test/ui/manualDialog.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. `Modal`, `App`, `setIcon` from `obsidian`.
- Produces:
  - `interface ManualEntry { term: string; text: string; badge?: { text: string; cls: string }; keys?: string[] }`
  - `interface ManualSection { id: string; title: string; intro?: string; entries: ManualEntry[] }`
  - `class ManualDialog extends Modal` with `constructor(app: App, sections: ManualSection[], initialId: string, onClosed?: () => void)`
  - `function openManual(app: App, sections: ManualSection[], sectionId: string, onClosed?: () => void): void`
  - `function manualLink(parent, app, sections, sectionId, label, onClosed?): HTMLButtonElement` (added in Task 5)

- [ ] **Step 1: Write the failing test**

Create `test/ui/manualDialog.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { ManualSection, openManual } from '../../src/ui/manualDialog';
import { Modal } from '../helpers/obsidian-mock';

installObsidianDom();

const SECTIONS: ManualSection[] = [
	{ id: 'one', title: 'First', entries: [{ term: 'A', text: 'alpha' }] },
	{ id: 'two', title: 'Second', entries: [{ term: 'B', text: 'beta' }] },
];

/** The mock's Modal does not attach anything, so the content is read off contentEl. */
const content = () => {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no modal opened');
	return modal.contentEl;
};

describe('the manual dialog', () => {
	beforeEach(() => {
		Modal.lastOpened = null;
		document.body.empty();
	});

	it('opens on the section it was asked for, not the first one', () => {
		openManual({} as never, SECTIONS, 'two');
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
	});

	it('lists every section in the sidebar, marking the open one', () => {
		openManual({} as never, SECTIONS, 'two');
		const tabs = Array.from(content().querySelectorAll('.vertical-tab-nav-item'));
		expect(tabs.map((t) => t.textContent)).toEqual(['First', 'Second']);
		expect(tabs.filter((t) => t.hasClass('is-active')).map((t) => t.textContent)).toEqual(['Second']);
	});

	it('switches the pane when a sidebar item is clicked', () => {
		openManual({} as never, SECTIONS, 'one');
		const second = Array.from(content().querySelectorAll<HTMLElement>('.vertical-tab-nav-item'))[1];
		second.click();
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
		expect(content().querySelector('.pbl-manual-def')?.textContent).toBe('beta');
	});

	it('falls back to the first section when the id is unknown', () => {
		openManual({} as never, SECTIONS, 'nope');
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('First');
	});

	// Focus policy belongs to the caller, so what this asserts is that the dialog CALLS
	// back — where focus lands is each door's own test, in `manualEntryPoints.test.ts`.
	it('tells the caller when it closes, so focus policy stays out of ui/', () => {
		let closed = 0;
		openManual({} as never, SECTIONS, 'one', () => {
			closed += 1;
		});
		expect(closed).toBe(0);
		Modal.lastOpened?.close();
		expect(closed).toBe(1);
	});

	it('closes cleanly with no callback at all', () => {
		openManual({} as never, SECTIONS, 'one');
		expect(() => Modal.lastOpened?.close()).not.toThrow();
	});

	it('renders a badge when an entry carries one', () => {
		openManual({} as never, [{ id: 'x', title: 'X', entries: [{ term: 'Epic', text: 'e', badge: { text: 'Epic', cls: 'pbl-lvl-0' } }] }], 'x');
		const badge = content().querySelector('.pbl-badge');
		expect(badge?.hasClass('pbl-lvl-0')).toBe(true);
		expect(badge?.textContent).toBe('Epic');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/ui/manualDialog.test.ts`
Expected: FAIL — `Cannot find module '../../src/ui/manualDialog'`.

- [ ] **Step 3: Write the dialog**

Create `src/ui/manualDialog.ts`:

```ts
import { App, Modal } from 'obsidian';

/**
 * One line of the manual: a term and what it means. `badge` carries a RESOLVED class
 * rather than a type name — resolving `Epic` to `pbl-lvl-0` is `domain/` knowledge, and
 * this file may not have it. `keys` names the view-option keys an entry explains, which
 * is how the setup section's completeness is checked against the schema rather than
 * against a list (`test/docs/surfaces.test.ts`).
 */
export interface ManualEntry {
	term: string;
	text: string;
	badge?: { text: string; cls: string };
	keys?: string[];
}

export interface ManualSection {
	id: string;
	title: string;
	intro?: string;
	entries: ManualEntry[];
}

/**
 * The manual: a sidebar of sections beside a pane, in the shape of Obsidian's own
 * settings dialog, so the chrome is the app's rather than this plugin's.
 *
 * It reads. It never writes: no note, no frontmatter, no `.base` setting, nothing in
 * local storage.
 */
export class ManualDialog extends Modal {
	private readonly sections: ManualSection[];
	private readonly initialId: string;
	private readonly onClosed: (() => void) | undefined;
	private paneEl: HTMLElement | null = null;

	constructor(app: App, sections: ManualSection[], initialId: string, onClosed?: () => void) {
		super(app);
		this.sections = sections;
		this.initialId = initialId;
		this.onClosed = onClosed;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pbl-manual');
		// `mod-settings` goes on the MODAL, not on `contentEl`: Obsidian scopes the
		// settings background and its whole phone layout to `.modal.mod-settings`, so
		// putting the class on the wrong element silently loses both — including the
		// mobile rules that stop a fixed 190px sidebar from crushing the pane.
		//
		// The jsdom mock has no `modalEl`, so NOTHING in the suite can catch this being
		// wrong. Optional-chained for that reason, and it is on the live-vault list.
		(this as { modalEl?: HTMLElement }).modalEl?.addClass('mod-settings');

		const split = contentEl.createDiv('pbl-manual-split');
		const nav = split.createDiv('modal-sidebar-inner pbl-manual-nav');
		nav.createDiv({ cls: 'pbl-manual-navhead', text: 'Product Backlog' });
		const items = nav.createDiv('vertical-tab-header-group-items');
		this.paneEl = split.createDiv('pbl-manual-pane');

		// An unknown id opens the first section rather than an empty pane: a deep link
		// that has gone stale is a worse manual, never no manual.
		const opening = this.sections.find((s) => s.id === this.initialId) ?? this.sections[0];

		for (const section of this.sections) {
			const tab = items.createEl('button', {
				cls: 'vertical-tab-nav-item',
				text: section.title,
				attr: { type: 'button' },
			});
			tab.toggleClass('is-active', section === opening);
			tab.addEventListener('click', () => {
				for (const other of Array.from(items.children)) other.removeClass('is-active');
				tab.addClass('is-active');
				this.show(section);
			});
		}

		if (opening) this.show(opening);
	}

	private show(section: ManualSection): void {
		const pane = this.paneEl;
		if (!pane) return;
		pane.empty();
		pane.createEl('h3', { text: section.title });
		if (section.intro) pane.createDiv({ cls: 'pbl-manual-intro', text: section.intro });

		const list = pane.createDiv('pbl-manual-prose');
		for (const entry of section.entries) {
			if (entry.badge) {
				const badge = list.createDiv(`pbl-badge ${entry.badge.cls}`);
				badge.createSpan({ cls: 'pbl-badge-text', text: entry.badge.text });
			} else {
				list.createDiv({ cls: 'pbl-manual-term', text: entry.term });
			}
			list.createDiv({ cls: 'pbl-manual-def', text: entry.text });
		}
	}

	onClose(): void {
		this.contentEl.empty();
		// Focus policy is the CALLER's. This file is a `ui/` leaf: it knows about no
		// layer, so it cannot reach for `.pbl-toolbar .pbl-help-btn` — and that button is
		// hidden at fit step 2 anyway, which is exactly the narrow pane where a fallback
		// is needed. Each door supplies a closure that knows where its own focus goes.
		this.onClosed?.();
	}
}

/** The one door. Every surface that offers the manual comes through here. */
export function openManual(
	app: App,
	sections: ManualSection[],
	sectionId: string,
	onClosed?: () => void,
): void {
	new ManualDialog(app, sections, sectionId, onClosed).open();
}
```

- [ ] **Step 4: Write the stylesheet partial**

Create `styles/manual.css`:

```css
/* The manual — `src/ui/manualDialog.ts`. Obsidian paints the modal, the sidebar surface
   and the tab items; what is here is the split, the pane and the content shapes. */

.pbl-manual {
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.pbl-manual-split {
	display: flex;
	min-height: 0;
	flex: 1 1 auto;
}

.pbl-manual-nav {
	flex: 0 0 190px;
	padding: var(--size-4-3) 0;
}

.pbl-manual-navhead {
	padding: 0 var(--size-4-3) var(--size-4-2);
	font-size: var(--font-ui-smaller);
	font-weight: var(--font-medium);
	color: var(--text-faint);
}

/* The sidebar items are real buttons so Tab reaches them; Obsidian's own rule paints
   `.vertical-tab-nav-item`, and its button chrome has to be stripped here the same way
   the toolbar's is — see `docs/bugs/Obsidian's button rule outranks the plugin's
   chrome-stripping.md`, which is why this is a declaration rather than a reset. */
.pbl-manual-nav .vertical-tab-nav-item {
	display: block;
	width: 100%;
	text-align: start;
	background-color: transparent;
	border: none;
	box-shadow: none;
}

.pbl-manual-pane {
	flex: 1 1 auto;
	min-width: 0;
	overflow-y: auto;
	padding: var(--size-4-4) var(--size-4-5);
}

.pbl-manual-pane h3 {
	margin-block-start: 0;
}

.pbl-manual-intro {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	margin-block-end: var(--size-4-3);
}

.pbl-manual-prose {
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: var(--size-4-2) var(--size-4-3);
	align-items: baseline;
}

.pbl-manual-term {
	font-weight: var(--font-medium);
}

.pbl-manual-def {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	line-height: 1.5;
}
```

- [ ] **Step 5: Import the partial**

In `styles/index.css`, add `@import "./manual.css";`. Read that file's own comment first — the import ORDER is behaviour, and it says which positions are load-bearing. `manual.css` is not one of them: put it with the other leaf partials, after `modals.css`.

- [ ] **Step 6: Satisfy register rule 7**

In `docs/requirements/A help button for the item types.md`, replace the `## Where it lives` body with:

```markdown
## Where it lives

The dialog and its one opener are `src/ui/manualDialog.ts` — a `ui/` leaf that takes its
sections as a parameter, because `ui/` may not reach `domain/`. Its appearance is
`styles/manual.css`, which draws the split and lets Obsidian's own settings-modal rules
draw everything else.
```

Leave the rest of the note alone; the remaining paths it names come in Tasks 2 and 4.

- [ ] **Step 7: Run the test and the gates**

Run: `npx vitest run test/ui/manualDialog.test.ts`
Expected: PASS, six tests.

Run: `npm run lint && npm run docs`
Expected: both clean. If `docs` reports `src/ui/manualDialog.ts` unspecified, Step 6 was skipped or the path was mistyped — it is matched as a **whole path**.

- [ ] **Step 8: Commit**

```bash
git add src/ui/manualDialog.ts styles/manual.css styles/index.css test/ui/manualDialog.test.ts "docs/requirements/A help button for the item types.md"
git commit -m "Give the manual a dialog and a single opener"
```

---

### Task 2: The types section, generated

**Files:**
- Create: `src/view/manual/typesSection.ts`
- Modify: `docs/requirements/A help button for the item types.md` (`## Where it lives`)
- Test: `test/view/manualTypes.test.ts`

**Interfaces:**
- Consumes: `ManualSection`, `ManualEntry` from `src/ui/manualDialog.ts` (Task 1).
- Produces: `function typesSection(): ManualSection` with `id: 'types'`.

- [ ] **Step 1: Write the failing test**

Create `test/view/manualTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { typesSection } from '../../src/view/manual/typesSection';
import { ALL_TYPES, LEVELS } from '../../src/domain/settings';

describe('the types section', () => {
	// The check behind "derived, not retyped": a type added to the vocabulary without an
	// explanation fails here rather than shipping as a gap in the manual.
	it('explains every type in the vocabulary', () => {
		const explained = typesSection().entries.filter((e) => e.badge).map((e) => e.badge?.text);
		expect(explained).toEqual(ALL_TYPES);
	});

	it('gives every type entry a non-empty explanation', () => {
		for (const entry of typesSection().entries.filter((e) => e.badge)) {
			expect(entry.text.length, `${entry.badge?.text} has no explanation`).toBeGreaterThan(0);
		}
	});

	it('badges a ladder type by its rung and an extra type by its name', () => {
		const of = (name: string) => typesSection().entries.find((e) => e.badge?.text === name)?.badge?.cls;
		expect(of('Epic')).toBe(`pbl-lvl-${LEVELS.indexOf('Epic')}`);
		expect(of('Bug')).toBe('pbl-lvl-bug');
		expect(of('Milestone')).toBe('pbl-lvl-milestone');
	});

	it('is a pure read — calling it twice gives equal content', () => {
		expect(typesSection()).toEqual(typesSection());
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/manualTypes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the section**

Create `src/view/manual/typesSection.ts`:

```ts
import { ManualEntry, ManualSection } from '../../ui/manualDialog';
import { ALL_TYPES, EXTRA_TYPES, LEVELS, MARKER_TYPES } from '../../domain/settings';

/**
 * What each type is FOR. Keyed by type name and checked for completeness against
 * `ALL_TYPES` (`test/view/manualTypes.test.ts`), so a type added to the vocabulary
 * without an explanation fails a test rather than shipping as a gap.
 */
const INTENT: Record<string, string> = {
	Epic: 'A body of work with a reason to exist. It roots the tree — nothing sits above it.',
	Feature: 'One coherent slice of an Epic, stated as an outcome someone would notice.',
	PBI: 'What a person does, step by step. The rung work is usually planned at.',
	Task: 'A piece of engineering, and the deepest rung. A Task can still hold another Task — the level offered clamps here rather than running out.',
	Issue: 'A question, a decision taken, or a limitation accepted. Holds Tasks.',
	Bug: 'What went wrong, what fixed it, and what it taught. Holds Tasks.',
	Idea: 'Something worth considering but not committed to. Holds Tasks.',
	Deliverable: 'Something the team must produce rather than build — a design, a concept.',
	Milestone: 'A date the plan answers to. It holds nothing and counts for nothing.',
};

/** The badge class the row renderer would give this type, resolved here because `ui/` cannot. */
function badgeClass(typeName: string): string {
	const rung = LEVELS.indexOf(typeName);
	return rung >= 0 ? `pbl-lvl-${rung}` : `pbl-lvl-${typeName.toLowerCase()}`;
}

function entryFor(typeName: string): ManualEntry {
	return {
		term: typeName,
		text: INTENT[typeName] ?? '',
		badge: { text: typeName, cls: badgeClass(typeName) },
	};
}

/**
 * The types section, built from the vocabulary rather than beside it.
 *
 * The three rules after the type list are the ones that decide behaviour and are
 * invisible on screen — a reader who has only the badges cannot deduce any of them.
 */
export function typesSection(): ManualSection {
	return {
		id: 'types',
		title: 'Item types',
		intro: `${LEVELS.join(' → ')} is a ladder. ${EXTRA_TYPES.join(', ')} sit beside it at every rung. ${MARKER_TYPES.join(', ')} is on neither.`,
		entries: [
			...ALL_TYPES.map(entryFor),
			{
				term: 'A child is one rung down',
				text: 'The level offered under a parent is the next rung, clamped at the deepest — so the + on a Task offers another Task.',
			},
			{
				term: 'An untyped item still has a level',
				text: 'It is shown at the level its position implies: a child of a Feature reads as a PBI, wherever that Feature sits.',
			},
			{
				term: 'A move does not re-type',
				text: 'Dragging an item leaves its type alone, unless Assign item type when moving is on — it is off by default.',
			},
		],
	};
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/view/manualTypes.test.ts`
Expected: PASS, four tests.

- [ ] **Step 5: Satisfy register rule 7**

Append to `## Where it lives` in `docs/requirements/A help button for the item types.md`:

```markdown
The types section itself is `src/view/manual/typesSection.ts`, generated from `ALL_TYPES`
in `src/domain/settings.ts` — the composition layer, which may reach `domain/` where the
dialog may not, and which is therefore where a badge class is resolved from a type name.
```

- [ ] **Step 6: Commit**

```bash
git add src/view/manual/typesSection.ts test/view/manualTypes.test.ts "docs/requirements/A help button for the item types.md"
git commit -m "Generate the types section from the vocabulary"
```

---

### How to write the manual's copy — read this before Tasks 2, 3 and 5

**The prose in this plan is a draft, not a specification.** Fifteen review findings landed
on it before implementation began, and almost every one was the same defect: a sentence
about behaviour that no test could check and that turned out to be wrong. "Nothing is
refused." "A Task holds nothing below it." "Excluded notes are never written to." Each read
well and each contradicted the code.

So the rule for every sentence you write in a manual section:

1. **Open the module before writing the sentence.** The claims below name theirs.
2. **Where the code has a fallback chain, state the whole chain or state none of it.** A
   partial order is worse than silence — it predicts the wrong folder confidently.
3. **Where a guarantee has a deliberate exception, the sentence carries the exception.**
4. If the plan's draft wording conflicts with what you read, **the code wins** and you say
   so in your report. You are not transcribing this plan.

The claims found wrong so far, so you do not rediscover them:

| Draft said | The code says | Read |
| --- | --- | --- |
| The `+` offers one rung down plus the extra types | Only a non-deepest **ladder** row gets `[ladderChild, ...EXTRA_TYPES]`. A Task or an extra type gets `[Task]` alone; a Milestone gets `[]` and has **no add affordance at all** | `childTypeChoices`, `src/domain/itemTypes.ts` |
| Filing is type folder, else home folder | Then the dominant folder among **result** rows, then asking the user when there are none — and folder mode's beside-the-parent rule is **skipped for a context parent** | `inferFolder`, `promptCreateItem`, and `src/CLAUDE.md`'s context-row rule |
| Excluded notes are never written to | True of **forward** batches only. `undoLast` deliberately has no replay-time check: its authorization came at capture time, and the write being undone may be what moved the note out of the filter | `applySafely` / `undoLast`, `src/view/writeGate.ts` |
| Undo takes the batch back | Compare-and-swap per key: a hand-edited key is **kept** and counted; a note deleted since is skipped whole; history is **one batch, per view, per session** | `applyRestores`, `src/storage/frontmatter.ts` |
| A Task holds nothing below it | `childLevelIndex` clamps, so a Task's `+` offers another Task | extension 3a of `A help button for the item types` |
| The quick filter narrows to matching titles | It keeps the match **path** — the match, all its ancestors and its **whole subtree** — and overrides collapse state while active. Most of what stays on screen did not match | `src/view/filterState.ts`, and its own header comment |
| Extra types sit beside the rung they hang from | They may HANG from Epic, Feature or PBI, but their RANK is pinned to `EXTRA_TYPE_RANK` — the PBI rung — whatever the parent. That pin is why focusing PBI promotes them and focusing Epic or Feature does not | `EXTRA_TYPE_RANK`, `src/domain/settings.ts` |

**A note for whoever implements Task 2.** While verifying the first row above, a dead
branch surfaced in `childTypeChoices`: `if (!parent) return ALL_TYPES;` guards at
`src/domain/itemTypes.ts:118`, and an unreachable `if (!parent) return [...ALL_TYPES];`
sits at `:128`. It is a real defect in the plugin, not in this plan. **Do not fix it as
part of your task** — it is out of scope and would muddy the diff. Report it in your
report file so it reaches the final review.

---

### Task 3: The five authored sections, and setup's derived coverage

**Files:**
- Create: `src/view/manual/sections.ts`
- Modify: `test/docs/surfaces.test.ts`
- Modify: `README.md` (the "whole moved subtree" wording)
- Modify: `docs/requirements/Help for moving and ranking.md`, `Help for creating and filing.md`, `Help for finding work.md`, `Help for safe writes and undo.md`, `Help for setting up the view.md` (`## Where it lives`)
- Test: `test/view/manualSections.test.ts`

**Interfaces:**
- Consumes: `ManualSection` (Task 1), `typesSection()` (Task 2).
- Produces: `function manualSections(): ManualSection[]` — the full six, types first.

- [ ] **Step 1: Write the failing test**

Create `test/view/manualSections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { manualSections } from '../../src/view/manual/sections';

describe('the manual', () => {
	it('has the six sections, types first', () => {
		expect(manualSections().map((s) => s.id)).toEqual([
			'types', 'moving', 'creating', 'finding', 'writes', 'setup',
		]);
	});

	it('gives every entry a term and an explanation', () => {
		for (const section of manualSections()) {
			expect(section.entries.length, `${section.id} is empty`).toBeGreaterThan(0);
			for (const entry of section.entries) {
				expect(entry.term.length, `${section.id}: an entry has no term`).toBeGreaterThan(0);
				expect(entry.text.length, `${section.id}/${entry.term}`).toBeGreaterThan(0);
			}
		}
	});

	it('uses no id twice, since a deep link addresses a section by id', () => {
		const ids = manualSections().map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	// `Help for moving and ranking` forbids BOTH claims, in opposite directions: no
	// refusal for type reasons, and no claim that nothing is refused at all. The section
	// has to name the states a move is genuinely unavailable in.
	it('names the states a move is unavailable in, and claims no type refusal', () => {
		const moving = manualSections().find((s) => s.id === 'moving');
		const prose = moving?.entries.map((e) => `${e.term} ${e.text}`).join(' ').toLowerCase() ?? '';
		expect(prose).toContain('quick filter');
		expect(prose).toContain('descendant');
		expect(prose).not.toContain('nothing is refused');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/manualSections.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the sections**

Create `src/view/manual/sections.ts`:

```ts
import { ManualSection } from '../../ui/manualDialog';
import { typesSection } from './typesSection';

/**
 * The five sections someone wrote, plus the one that is generated.
 *
 * `setup` is the odd one: its prose is authored, because
 * `docs/requirements/Help for setting up the view.md` requires grouping by what an option
 * CHANGES rather than by schema order — but its coverage is derived. Each entry names the
 * view-option keys it explains in `keys`, and `test/docs/surfaces.test.ts` asserts every
 * key `getViewOptions()` declares is claimed exactly once. The schema generates a folder
 * picker per type and a limit and a policy per workflow state, so the count moves with the
 * vocabulary and with the user's own configuration: a hand-listed section would read as
 * complete while omitting the generated half.
 */
const MOVING: ManualSection = {
	id: 'moving',
	title: 'Moving and ranking',
	intro: 'Where a drop lands decides what it means. The drop indicator is the cue.',
	entries: [
		{ term: 'Between two rows', text: 'Places the item as their sibling. If those rows have a different parent, it is reparented as well as ranked — the fastest way to move and rank in one gesture.' },
		{ term: 'Onto a row', text: 'Makes the item a child of that row.' },
		{ term: 'Without a mouse', text: 'Alt and the arrow keys move, indent and outdent. The context menu offers move up, down, to top, to bottom, indent and outdent.' },
		{ term: 'Order', text: 'A number ranking siblings, maintained by the view. Unranked items sort last, in whatever order the Base itself produces.' },
		{ term: 'A move does not re-type', text: 'Unless Assign item type when moving is on. That cascade skips untyped and custom-typed descendants, keeps the pinned rank of the types that sit beside the ladder, and stops at a row the Base excluded.' },
		{ term: 'When a drop is unavailable', text: 'A row cannot be dropped onto itself or into its own descendants. A group with no shared ranking takes no between-drop: the top row of a focused view, and a row loaded only as an excluded parent.' },
		{ term: 'While a quick filter is active', text: 'Dragging is off entirely, because rows next to each other under a filter are not siblings. A row that will not lift is the filter, not a fault.' },
	],
};

const CREATING: ManualSection = {
	id: 'creating',
	title: 'Creating and filing',
	entries: [
		{ term: 'The + on a row', text: 'Offers the types that row may hold: one rung down, plus the types that sit beside the ladder at every rung.' },
		{ term: 'The context menu', text: 'Offers the same new-item choices as the +, plus the actions a pointer cannot reach.' },
		{ term: 'Where the note lands', text: 'A folder configured for that type, else the home folder. In folder-note mode a child is filed beside its parent instead.' },
		{ term: 'What is written', text: 'The type, the parent link and an order, in one batch. The note opens; nothing else moves.' },
		{ term: 'Creating under an excluded parent', text: 'The parent link is written explicitly, so the hierarchy stays right wherever the note lands.' },
	],
};

const FINDING: ManualSection = {
	id: 'finding',
	title: 'Finding work',
	entries: [
		{ term: 'Focus level', text: 'Picks which rung is the top of the tree. It is working position, remembered per view per device, and never written to the base.' },
		{ term: 'Quick filter', text: 'Narrows to matching titles. A match nothing on screen can reach names itself on the row or card that hides it.' },
		{ term: 'Show completed items', text: 'When off, a subtree that is entirely done is hidden. The quick filter overrides it.' },
		{ term: 'Nothing showing at all', text: 'Either the Base returned nothing, or nothing it returned belongs to the hierarchy. The toolbar says how many notes were skipped, which tells the two apart.' },
	],
};

const WRITES: ManualSection = {
	id: 'writes',
	title: 'Safe writes and undo',
	entries: [
		{ term: 'A change is one batch', text: 'A drag that renumbers six siblings is a single change, and undo takes all six back — Ctrl or Cmd with Z, or the toolbar arrow.' },
		{ term: 'One at a time', text: 'A second change is refused while one is in flight, rather than queued behind it. The indicator says a batch is running.' },
		{ term: 'Notes the base excluded are never written to', text: 'An excluded parent renders so the tree keeps its shape, and that is all: no state chip, no Set type, no reparenting.' },
		{ term: 'A misconfigured view writes nothing', text: 'If two properties collide or a required one is unset, the toolbar warns and every write path stays closed until it is fixed.' },
	],
};

const SETUP: ManualSection = {
	id: 'setup',
	title: 'Setting up the view',
	intro: 'The fast way: run Product Backlog: Create backlog. It writes a folder, a configured base, and opens the view.',
	entries: [
		{
			term: 'What the tree is',
			text: 'The three property names, whether notes outside the hierarchy are ignored, whether excluded parents are loaded, and whether parents come from folder notes.',
			keys: ['parentProperty', 'orderProperty', 'typeProperty', 'hierarchyOnly', 'showOutsideParents', 'inferFolderHierarchy'],
		},
		// … one entry per behaviour group, each naming the keys it explains. The full set
		// is not listed here because the schema generates part of it: see Step 5, which is
		// how you find every key this must account for.
	],
};

/** The manual, in the order the sidebar shows it. */
export function manualSections(): ManualSection[] {
	return [typesSection(), MOVING, CREATING, FINDING, WRITES, SETUP];
}
```

**Note for the implementer:** the `SETUP` entries above are deliberately incomplete — Step 5 is what tells you the exact key set, and writing it from this plan rather than from the schema is the failure the derived check exists to catch.

- [ ] **Step 4: Run the section test**

Run: `npx vitest run test/view/manualSections.test.ts`
Expected: PASS, four tests.

- [ ] **Step 5: Write the failing coverage test, and let it name the missing keys**

In `test/docs/surfaces.test.ts`, inside the existing `describe('every user-facing surface is specified')`, add:

```ts
	// The setup section's prose is authored — its own use case forbids schema order — but
	// its COVERAGE is derived, because the schema generates a folder picker per type and a
	// limit and a policy per workflow state. A hand-listed section reads as complete while
	// omitting the generated half.
	it('claims every view-option key in exactly one setup entry', () => {
		// Against a config that HAS workflow states. `defaultSettings()` has `states: []`,
		// so the parameterless schema emits no `wipLimit.*`/`columnPolicy.*` at all — and a
		// test run against it would go green while covering none of the generated half,
		// which is the exact failure this criterion exists to prevent.
		// A STRING: `resolveSettings` reads `stateValues` through a comma-split, so an array
		// resolves to no states and the generated families stay empty — the vacuum again.
		const config = new FakeViewConfig({ stateValues: 'Todo, Doing, Done' });
		const declared = optionKeys(config as never);

		const claims = (manualSections().find((s) => s.id === 'setup')?.entries ?? []).flatMap(
			(e) => e.keys ?? [],
		);
		expect(claims.length, 'no setup entry names any option key').toBeGreaterThan(0);

		// A claim is an exact key, or a `prefix.*` family for the parts of the schema that
		// are generated from the vocabulary and from the user's own states.
		const matches = (claim: string, key: string) =>
			claim.endsWith('.*') ? key.startsWith(claim.slice(0, -1)) : claim === key;

		const unclaimed = declared.filter((key) => !claims.some((c) => matches(c, key)));
		expect(unclaimed, 'options the manual never explains').toEqual([]);

		const twice = declared.filter((key) => claims.filter((c) => matches(c, key)).length > 1);
		expect(twice, 'options explained by two entries').toEqual([]);

		// The other direction: a family matching nothing is a section explaining an option
		// that no longer exists.
		const empty = claims.filter((c) => !declared.some((key) => matches(c, key)));
		expect(empty, 'claims that match no declared option').toEqual([]);
	});
```

Add the import at the top: `import { manualSections } from '../../src/view/manual/sections';`

Run: `npx vitest run test/docs/surfaces.test.ts`
Expected: FAIL, and the failure diff **lists exactly which keys are unclaimed**. That list is the specification for the rest of `SETUP`.

- [ ] **Step 6: Finish the setup section from that list**

Add entries to `SETUP` until the test passes, grouping by what each option **changes** — the groups its use case names: what the tree is, what a write does, what progress means, where new notes go, presentation. Do not reorder to match the schema; the grouping is the requirement.

Run: `npx vitest run test/docs/surfaces.test.ts`
Expected: PASS.

- [ ] **Step 7: Correct the README wording the manual must not inherit**

`Help for moving and ranking` names this explicitly. In `README.md`, find the sentence saying a move "re-types the whole moved subtree" and replace it with wording that matches the cascade's actual behaviour — it skips untyped and custom-typed descendants, preserves the pinned rank of the types beside the ladder, and stops at an excluded row.

Run: `grep -n "whole moved subtree" README.md`
Expected: no matches.

- [ ] **Step 8: Satisfy register rule 7 for all five**

In each of the five notes, replace the `## Where it lives` body. For example, in `docs/requirements/Help for moving and ranking.md`:

```markdown
## Where it lives

`src/view/manual/sections.ts` — the moving section's own entries. The behaviour it
describes is `src/domain/dropTargets.ts` (the zones and the refusals),
`src/view/interactions/dragDrop.ts` (the indicator) and
`src/view/interactions/keyboard.ts` with `src/view/interactions/menu.ts`.
```

Do the equivalent in the other four. `Help for setting up the view.md` must also name `src/domain/viewOptions.ts` as the schema its coverage is measured against.

- [ ] **Step 9: Run the gates and commit**

Run: `npm run lint && npm run docs && npx vitest run test/view test/docs`
Expected: all clean.

```bash
git add src/view/manual/sections.ts test/view/manualSections.test.ts test/docs/surfaces.test.ts README.md docs/requirements/
git commit -m "Write the five authored sections, with setup answerable to the schema"
```

---

### Task 4: The toolbar button, the overflow mirror, and the fit rung

**Files:**
- Modify: `src/view/render/toolbar.ts`
- Modify: `src/view/render/toolbarControls.ts:385-440` (`overflowEntries`)
- Modify: `styles/toolbarFit.css:91-96` (the step-2 shed group)
- Modify: `docs/requirements/A help button for the item types.md` (`## Where it lives`)
- Test: `test/view/manualEntryPoints.test.ts`

**Interfaces:**
- Consumes: `openManual` (Task 1), `manualSections()` (Task 3).
- Produces: a `.pbl-help-btn` button carrying `data-pbl-key="help"`.

- [ ] **Step 1: Write the failing test**

Create `test/view/manualEntryPoints.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Modal } from '../helpers/obsidian-mock';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

const help = (containerEl: HTMLElement) => {
	const el = containerEl.querySelector<HTMLButtonElement>('.pbl-toolbar .pbl-help-btn');
	if (!el) throw new Error('no help button in the toolbar');
	return el;
};

describe('the manual is reachable from the toolbar', () => {
	beforeEach(() => {
		Modal.lastOpened = null;
	});

	it('is a real button in the toolbar', () => {
		const { containerEl } = makeView(fixture(), {});
		expect(help(containerEl).tagName).toBe('BUTTON');
		expect(help(containerEl).getAttribute('data-pbl-key')).toBe('help');
	});

	it('opens the manual on the types section', () => {
		const { containerEl } = makeView(fixture(), {});
		help(containerEl).click();
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent).toBe('Item types');
	});

	it('returns focus to the help button when closed', () => {
		const { containerEl } = makeView(fixture(), {});
		const btn = help(containerEl);
		btn.focus();
		btn.click();
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(btn);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/manualEntryPoints.test.ts`
Expected: FAIL — "no help button in the toolbar".

- [ ] **Step 3: Add the button**

In `src/view/render/toolbar.ts`, in zone 4 (the "what is shown" group), **after** `renderFilterBox(host, barEl)`:

```ts
	// The general door to the manual. Zone 4 because it is the same in every projection,
	// and last in it because the fit ladder sheds it at step 2 — of everything on this row
	// it is the one control whose use is never urgent, and step 2 is the earliest rung at
	// which shedding is possible at all, since that is where the `⋯` it sheds into first
	// renders.
	const helpBtn = iconButton(barEl, 'help-circle', 'Open the manual', 'help');
	helpBtn.addClass('pbl-help-btn');
	helpBtn.addEventListener('click', () => {
		openManual(host.app, manualSections(), 'types', () => helpBtn.focus());
	});
```

Add the imports: `openManual` from `../../ui/manualDialog`, `manualSections` from `../manual/sections`.

- [ ] **Step 4: Add the fit rung**

In `styles/toolbarFit.css`, add `.pbl-help-btn` to the **step-2** shed group — the rule that already lists `.pbl-filter-input`, `.pbl-filter-icon`, `.pbl-density-toggle` and `.pbl-today-btn`:

```css
.pbl-toolbar[data-pbl-fit]:not([data-pbl-fit='1']) .pbl-help-btn,
```

Add it to that existing selector list rather than writing a new rule — the file's own header explains that a rung is expressed as "engaged, and not one of the rungs above this one", and a separate rule with a different chain is how the two drift.

- [ ] **Step 5: Mirror it into the `⋯`**

In `src/view/render/toolbarControls.ts`, add to the `all` array in `overflowEntries`, after the `Jump to today` entry:

```ts
		{
			title: 'Open the manual',
			icon: 'help-circle',
			cls: 'pbl-help-btn',
			// No `onClosed`: the carve-out below owns focus here, not this entry.
			run: () => openManual(host.app, manualSections(), 'types'),
			opensModal: true,
		},
```

**This entry must NOT go through `pickAndRefocus`.** That wrapper focuses the rebuilt `⋯`
the instant `run()` returns — which here is the instant the modal opened, so it would take
focus straight back off the dialog. The codebase already carves this out for the one menu
with the same shape, and says why: *"The New-type chevron is the one menu that does not:
its entries open the creation prompt, which takes focus deliberately, so restoring focus
here would fight the modal for it — a genuine carve-out, not an omission from the rule
above."* A manual entry is the second instance of that rule, not a new one.

Add `opensModal?: boolean` to `OverflowEntry` and branch in `renderOverflow`:

```ts
					.onClick(() =>
						entry.opensModal ? entry.run() : pickAndRefocus(barEl, 'overflow', entry.run),
					),
```

Extend `pickAndRefocus`'s doc comment to name the second member of its carve-out — its own
comment records that the earlier list-shaped version went stale twice, so the rule is what
gets edited, not a list.

Add the same two imports.

- [ ] **Step 6: Extend the test for the mirror and the rung**

Append to `test/view/manualEntryPoints.test.ts`:

```ts
	it('is mirrored into the overflow menu', () => {
		const { containerEl } = makeView(fixture(), {});
		const overflow = containerEl.querySelector<HTMLButtonElement>('.pbl-overflow-btn');
		overflow?.click();
		const titles = Menu.lastShown?.items.map((i) => i.title) ?? [];
		expect(titles).toContain('Open the manual');
	});
```

Add `Menu` to the `obsidian-mock` import. Check `test/view/toolbarOverflow.test.ts` (or whichever file already drives the `⋯`) for the exact shape of `Menu.lastShown` before writing this — copy that file's accessor rather than inventing one.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/manualEntryPoints.test.ts test/view/toolbarFocus.test.ts`
Expected: PASS. `toolbarFocus.test.ts` asserts every focusable toolbar control carries a unique key — if it fails, `help` collides with an existing key.

- [ ] **Step 8: Satisfy register rule 7 and commit**

Append to `## Where it lives` in `docs/requirements/A help button for the item types.md` that the button is in `src/view/render/toolbar.ts` and its overflow mirror in `src/view/render/toolbarControls.ts`.

```bash
git add src/view/render/toolbar.ts src/view/render/toolbarControls.ts styles/toolbarFit.css test/view/manualEntryPoints.test.ts "docs/requirements/A help button for the item types.md"
git commit -m "Put the manual on the toolbar, shedding at the rung the overflow appears"
```

---

### Task 5: The four contextual entry points

**Files:**
- Modify: `src/view/render/emptyStates.ts` (`renderEmptyState`)
- Modify: `src/view/render/toolbar.ts` (`renderBusyIndicator`, and the config warning at ~line 136)
- Modify: `src/ui/prompts.ts` (an optional help affordance on the new-item prompt)
- Modify: `src/view/interactions/create.ts` (pass it)
- Modify: the four `Help for …` notes' `## Where it lives`
- Test: `test/view/manualEntryPoints.test.ts` (extend)

**Interfaces:**
- Consumes: `openManual` (Task 1), `manualSections()` (Task 3).
- Produces: nothing new. Four call sites into the existing opener.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/manualEntryPoints.test.ts`:

```ts
describe('the manual is reachable where its questions are asked', () => {
	beforeEach(() => {
		Modal.lastOpened = null;
	});

	const openedOn = () =>
		Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent ?? null;

	// All THREE empty-state renderers, driven at the surface. One test per renderer,
	// because a single generic case passes while the other two doors are missing — which
	// is the whole defect this covers.
	it('opens on finding work from the nothing-to-show state', () => {
		const { containerEl } = makeView(fixture({ empty: true }), {});
		containerEl.querySelector<HTMLElement>('.pbl-empty-state .pbl-help-link')?.click();
		expect(openedOn()).toBe('Finding work');
	});

	it('opens on finding work from the no-match state', () => {
		const { view, containerEl } = makeView(fixture(), {});
		view.setFilter('zzzznomatch');
		containerEl.querySelector<HTMLElement>('.pbl-empty-state .pbl-help-link')?.click();
		expect(openedOn()).toBe('Finding work');
	});

	it('opens on finding work from the all-done state', () => {
		// Every item done, with Show completed items off — check `renderAllDoneState`'s
		// own test for the cheapest fixture that reaches it.
		const { containerEl } = makeView(fixture({ allDone: true }), { stateProperty: 'note.status' });
		containerEl.querySelector<HTMLElement>('.pbl-empty-state .pbl-help-link')?.click();
		expect(openedOn()).toBe('Finding work');
	});

	it('opens on setting up the view from the config warning', () => {
		// Two options naming the same property is a config problem, which is what draws
		// the warning — check `configProblems` for the cheapest collision to induce.
		const { containerEl } = makeView(fixture(), { parentProperty: 'note.x', orderProperty: 'note.x' });
		containerEl.querySelector<HTMLElement>('.pbl-toolbar-warning .pbl-help-link')?.click();
		expect(openedOn()).toBe('Setting up the view');
	});

	// The opener can vanish while the dialog is up. Finish the batch BEFORE closing —
	// a test that closes first passes even when the fallback is missing.
	it('falls back to the help button when the busy indicator is gone by closing time', async () => {
		const { view, containerEl } = makeView(fixture(), {});
		// Start a write, open the manual from the indicator, let the batch settle, close.
		// Drive the write the way test/view/writeGate.test.ts does.
		const indicator = containerEl.querySelector<HTMLElement>('.pbl-busy .pbl-help-link');
		indicator?.click();
		await view.whenIdle?.();
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-toolbar .pbl-help-btn'));
	});

	it('opens on creating and filing from the new-item prompt', () => {
		const { containerEl } = makeView(fixture(), {});
		containerEl.querySelector<HTMLButtonElement>('.pbl-toolbar .pbl-new-btn')?.click();
		const prompt = Modal.lastOpened;
		prompt?.contentEl.querySelector<HTMLElement>('.pbl-help-link')?.click();
		expect(openedOn()).toBe('Creating and filing');
	});
});
```

The busy-indicator case needs a batch in flight; drive it the way `test/view/writeGate.test.ts` already does rather than inventing a way to set `busy`.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/view/manualEntryPoints.test.ts`
Expected: FAIL — no `.pbl-help-link` anywhere.

- [ ] **Step 3: Add a shared link affordance**

In `src/ui/manualDialog.ts`, export a small helper so four surfaces do not each invent one:

```ts
/**
 * The point-of-need door: a text button that opens the manual on one section and gives
 * focus back to itself. Four surfaces use it — the new-item prompt, an empty state, the
 * busy indicator and the config warning — and each is an acceptance criterion of one of
 * the `Help for …` use cases rather than a convenience.
 */
export function manualLink(
	parent: HTMLElement,
	app: App,
	sections: ManualSection[],
	sectionId: string,
	label: string,
): HTMLButtonElement {
	const link = parent.createEl('button', { cls: 'pbl-help-link', text: label, attr: { type: 'button' } });
	link.addEventListener('click', () => openManual(app, sections, sectionId, link));
	return link;
}
```

Style it in `styles/manual.css` as a link-looking button — `background: none; border: none; color: var(--text-accent); padding: 0;` plus `text-decoration: underline` — the same button-chrome stripping the sidebar items need.

- [ ] **Step 4: Wire the four surfaces**

- **All three** empty-state renderers in `src/view/render/emptyStates.ts` — `renderEmptyState`, `renderFilterEmptyState` and `renderAllDoneState` — each → `manualLink(el, host.app, manualSections(), 'finding', 'What shows here?')`. Three separate renderers, and the last two (a filter matching nothing, a backlog whose visible work is all done) are the sharpest moments the question is asked. Wiring only the generic one leaves the two best doors missing.
- the config warning in `src/view/render/toolbar.ts` (~line 136, beside `Check view options`) → section `'setup'`, label `'What to fix'`. It was claimed by two use cases; the register settled it on the configuration section, because the reader's question at a warning is what to fix. **`docs/requirements/Help for safe writes and undo.md` must be amended in this same commit**: strike the config warning from its **Trigger** row and from the criterion naming it, leave the **?** and the busy indicator, and add one line recording that the warning was reassigned to `Help for setting up the view` and why. Amend the note — do not leave a criterion standing and call a cross-link good enough.
- `renderBusyIndicator` in the same file → section `'writes'`, label `'What is happening'`
- the new-item prompt: give `NewItemPromptOptions` an optional `help?: (parent: HTMLElement) => void`, call it under the detail line in `src/ui/prompts.ts`, and pass it from `promptCreateItem` in `src/view/interactions/create.ts` as `(el) => manualLink(el, app, manualSections(), 'creating', 'Where will this go?')`

The prompt takes a **callback** rather than the sections themselves: `prompts.ts` is `ui/`, and handing it `manualSections()` would be `view/` content arriving through a `ui/` signature — legal but pointless, since the caller can build the link.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/view/manualEntryPoints.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Satisfy register rule 7 and commit**

Add to each note's `## Where it lives`: `src/view/render/emptyStates.ts` (finding), `src/view/render/toolbar.ts` (writes — the indicator and the warning), `src/ui/prompts.ts` and `src/view/interactions/create.ts` (creating).

```bash
git add src/ src/ui test/view/manualEntryPoints.test.ts styles/manual.css docs/requirements/
git commit -m "Offer the manual where each of its questions is asked"
```

---

### Task 6: Cut the coverage ledger

**Files:**
- Modify: `vitest.config.mts`

**Interfaces:** none. This changes a comment and no behaviour.

- [ ] **Step 1: Record the baseline**

Run: `npm run test:coverage`
Write down the four figures. They are the thresholds' new floor if they are higher, and nothing changes if they are not.

- [ ] **Step 2: Replace the ledger**

Delete the per-increment history in the comment above `thresholds` and leave the rule plus the two episodes that teach:

```ts
			// Thresholds only ever go up. Raise them to what an increment measures,
			// rounded down to one decimal; never lower one to accommodate a change.
			//
			// Two episodes worth keeping, because both change what you do on a failure:
			//
			// A mid-increment figure is not the increment's figure. Branches once measured
			// 94.0038 mid-flight; taking the 94.0 it rounds down from would have failed the
			// very next run, because sharing a chevron between two renderers deleted six
			// branches along with the duplicate. Record what the FINISHED increment measures.
			//
			// A coverage failure here is first a question about which branch nothing can
			// take, and only then about a missing test. A 93.99 against a 94.0 floor turned
			// out to be two DEAD branches — one arm whose only callers passed a three-name
			// list, one that became unreachable when a neighbouring function started
			// returning the whole vocabulary. Deleting them raised the figure on a smaller
			// denominator. Look for the dead branch before writing the test.
			//
			// The history of which decimal moved in which increment is in git.
```

- [ ] **Step 3: Raise the thresholds if the increment earned it**

If Step 1's figures exceed the current `98.3 / 94.6 / 99.5 / 99.4`, set each to the measured value rounded **down** to one decimal. If a figure rounds down to what is already there, leave it.

- [ ] **Step 4: Verify and commit**

Run: `npm run check`
Expected: green.

```bash
git add vitest.config.mts
git commit -m "Keep the coverage rule, and let git keep the ledger"
```

---

### Task 7: The verification handover

**Files:**
- Create: `docs/tasks/Run the checks CI cannot.md`

**Interfaces:** none — a register note.

- [ ] **Step 1: Find the sibling orders**

Run: `grep -l 'Verifications a device has to answer' docs/**/*.md` and read the `order:` of every note already parented there. Pick an unused one — `npm run docs` fails on a duplicate sibling order, which is the one ranking limitation this register may not demonstrate.

- [ ] **Step 2: Write the note**

Create `docs/tasks/Run the checks CI cannot.md` with `type: Task`, `parent: "[[Verifications a device has to answer]]"`, the order from Step 1, `status: Open`, and a `created` date. Use the Task shape the register requires: Evidence · Why it matters · Approach · Acceptance criteria · Risks · Outcome.

The **Approach** is the ordered sitting:

1. `npm run test-build`, open this repository as a vault, open `docs/Product Backlog.base`.
2. The eight existing `Smoke test …` notes, in a stated order, each linked, with where its answer is recorded.
3. The phone — [[Smoke test the touch paths on a phone]]. `isDesktopOnly: false` is a shipped claim and every direct manipulation is a native drag, so the context menu is the whole interface there.
4. Enable branch protection requiring branches to be up to date before merging — the only open item on [[Two spec branches predate the use-case gate]].

Items 3 and 4 cannot be done by an agent. Say so in the note rather than leaving a reader to discover it.

- [ ] **Step 3: Verify and commit**

Run: `npm run docs`
Expected: clean. Every `[[wikilink]]` must resolve and the basename must be unique across all of `docs/`.

```bash
git add "docs/tasks/Run the checks CI cannot.md"
git commit -m "Order the checks CI cannot run into one sitting"
```

---

### Task 8: Close out the register

**Files:**
- Modify: the six `Help for …` / `A help button …` notes (`status`)
- Modify: `docs/issues/Every type badge is below the contrast floor.md`
- Modify: `docs/requirements/User manual.md` (`status`)

**Interfaces:** none.

- [ ] **Step 1: Check each PBI against its own criteria before moving it**

For each of the six, read its `## Acceptance criteria` and confirm every line is met by what was built — **not** that its section exists. Three of them are met only by Task 5's entry points. If any criterion is unmet, the honest move is to leave that note `Open` and say which line failed.

- [ ] **Step 2: Move what is genuinely done**

Set `status: Done` on each PBI that passed Step 1, and on `docs/requirements/User manual.md` if all six did.

**`Help for safe writes and undo` only passes if Task 5 amended it.** Its criteria named
the config warning, which the register reassigned to `Help for setting up the view`. If
the amendment was not made, the criterion is still standing and unmet — leave the note
`Open` and say which line failed, rather than reading a cross-link as satisfying it.

- [ ] **Step 3: Record what the review measured on the badge note**

In `docs/issues/Every type badge is below the contrast floor.md`, add a section recording that the existing table is light-scheme only; that dark also fails (PBI/blue 3.59, Bug/red 4.13); that the 0.14 alpha is the weak lever, since dropping it to 0.10 leaves light's worst near 1.9; and that a solid pill has no workable ink across eight hues (white bottoms out at 1.41 on yellow, black at 3.21 on purple).

The note stays `Open`. This is evidence, not a fix.

- [ ] **Step 4: Leave Finding 16 alone**

`docs/issues/Finding 16 — nothing in this round closes it.md` stays `Open` and no round-closing paragraph is written in `Codebase health`. Its own text says the paragraph goes in when the **last** finding closes, and nine are open. Do not "tidy" this.

- [ ] **Step 5: Final gate**

Run: `npm run check`
Expected: green, all five steps.

Run: `git status --porcelain`
Expected: nothing untracked. In particular `test/harness/mock.ts` must not exist — it is a scratch file and `npm run analyze` is right to call it dead.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "Move the manual's use cases to done, and record what the badge measurement found"
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the dialog and layout → 1; three modules → 1, 2, 3; the six sections → 2, 3; two derivations → 2 (`ALL_TYPES`) and 3 (`getViewOptions`); reaching it → 4; four contextual entry points and one opener → 1 (the opener), 5 (the wiring); the ledger → 6; the handover → 7; recorded-not-fixed and the round that is not closed → 8. The Multilang note in the spec is an observation with no deliverable and needs no task.

**Placeholders.** One deliberate incompleteness remains, in Task 3 Step 3: `SETUP`'s entries. It is not a placeholder — Step 5 makes the test emit the exact missing key list, and writing that list from a plan instead of from the schema is precisely the failure the derived check exists to catch. It is called out in the task.

**Type consistency.** `ManualEntry`/`ManualSection` are defined in Task 1 and used unchanged in 2, 3 and 5. `openManual(app, sections, sectionId, onClosed?)` keeps that argument order at every call site, and `onClosed` is a CALLBACK rather than an element — `ui/` decides no focus policy, and the toolbar's `?` is hidden at fit step 2 so it could not have served as a fallback anyway. `manualSections()` is defined in Task 3 and consumed in 4 and 5 — so **Task 3 must land before Task 4**. `typesSection()` is defined in Task 2 and consumed in Task 3. `manualLink` is added in Task 5 to the module Task 1 created, which is the one place a later task reaches back into an earlier one's file.

**Ordering.** 1 → 2 → 3 → 4 → 5 is a hard chain. 6, 7 and 8 are independent of each other, and 8 should run last because Step 1 audits what the earlier tasks actually delivered.
