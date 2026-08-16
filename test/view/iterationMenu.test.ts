// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, MenuItem } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, makeView, projectionButton, rowByTitle, useViewHarness } from '../helpers/view';

/**
 * `Set iteration` — five refusals and one presence, each of them a different rule.
 *
 * Five, not the six the plan's heading counts: its own numbered list holds an unconfigured
 * key, a context row, a catalog member, a marker and nothing-to-do, and the marker rule is
 * one rule over two names rather than two.
 *
 * Its own file rather than a block in `contextRowWrites.test.ts`, where the plan named it:
 * one of them IS the context-row rule, but the other four are not about context rows at
 * all, and that suite was within 60 lines of the `test/**` budget. Split by subject before
 * a file becomes the place tests hide. What the split costs is stated rather than hidden:
 * the combinatorial sweep in that file does not reach this menu, because its fixture names
 * no iteration property — the refusal below is what covers the context row here, and the
 * `editable` gate the entry sits behind is the one that sweep already drives for every
 * other entry in `addEditableSections`.
 */

useViewHarness();

describe('Set iteration', () => {
	/** Two iterations, a milestone, a plan branch carrying a link, and a catalog branch. */
	function iterationVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Sprint 11.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('M1.md', { frontmatter: { type: 'Milestone' } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('PBI.md', {
			frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]' },
			parentLink: 'Epic',
		});
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
		return vault;
	}

	const ITERATION_KEY = { iterationProperty: 'note.iteration' };

	/** The submenu's entries, or null where the row is offered no `Set iteration` at all. */
	function iterationEntries(containerEl: HTMLElement, title: string): MenuItem[] | null {
		rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		return Menu.lastShown?.item('Set iteration')?.submenu?.items ?? null;
	}

	const titlesIn = (entries: MenuItem[] | null): string[] | null => entries?.map((e) => e.titleText) ?? null;

	it('offers every Iteration in the model plus None, whatever the focus level', () => {
		// Focused on PBI, so `model.roots` is a synthetic forest of PBIs and the two
		// top-level iterations are off the rendered tree entirely. Read from `byPath`
		// they are still offerable, which is the whole of this case.
		const { containerEl } = makeView(iterationVault(), ITERATION_KEY, { focus: 'PBI' });

		expect(titlesIn(iterationEntries(containerEl, 'PBI'))).toEqual(['Sprint 11', 'Sprint 12', 'None']);
	});

	it('is absent on a context row', () => {
		const { containerEl } = makeView(iterationVault(), ITERATION_KEY, {
			only: ['Sprint 11.md', 'Sprint 12.md', 'PBI.md'],
		});

		// Not vacuous: the result below the context ancestor is still offered the action.
		expect(iterationEntries(containerEl, 'PBI')).not.toBeNull();
		expect(iterationEntries(containerEl, 'Epic')).toBeNull();
	});

	it('never offers an Iteration the Base excluded as a target', () => {
		// The hand-edited vault that makes a marker a context row: something names it as a
		// parent, so the filter that cut it loads it back as scaffolding. It renders and it
		// parents — it is not this base's vocabulary, so it is nothing to join.
		const vault = new FakeVault();
		vault.addFile('Sprint 11.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Sprint 12' });
		const { containerEl, view } = makeView(vault, ITERATION_KEY, { only: ['Sprint 11.md', 'PBI.md'] });

		expect(view.model?.byPath.get('Sprint 12.md')?.outsideFilter).toBe(true);
		expect(titlesIn(iterationEntries(containerEl, 'PBI'))).toEqual(['Sprint 11']);
	});

	it('is absent on a catalog member', () => {
		const { containerEl } = makeView(iterationVault(), ITERATION_KEY);
		projectionButton(containerEl, 'Show as test catalog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		clickExpandAll(containerEl);

		// The iterations are in the model all the same — every other refusal passes here.
		expect(iterationEntries(containerEl, 'Suite')).toBeNull();
		expect(iterationEntries(containerEl, 'Case')).toBeNull();
	});

	it('is absent on a Milestone row, not only an Iteration one', () => {
		// A marker is not work. Named as one rule so a third marker inherits it — and
		// checked on the MILESTONE, because that is the one the dates would destroy.
		const { containerEl } = makeView(iterationVault(), ITERATION_KEY);

		expect(iterationEntries(containerEl, 'M1')).toBeNull();
		expect(iterationEntries(containerEl, 'Sprint 12')).toBeNull();
	});

	it('is absent when the iteration property is unconfigured, even with Iterations in the model', () => {
		// The gate that follows from none of the others: the targets exist, so every
		// other refusal passes, and each pick would write nothing while looking current.
		const { containerEl, view } = makeView(iterationVault(), { iterationProperty: '' });

		expect(view.model?.byPath.has('Sprint 12.md')).toBe(true);
		expect(iterationEntries(containerEl, 'PBI')).toBeNull();
	});

	it('renders with None alone when the item holds a link and no Iteration is left', async () => {
		const vault = new FakeVault();
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]' } });
		const { containerEl } = makeView(vault, ITERATION_KEY);

		const entries = iterationEntries(containerEl, 'PBI') ?? [];
		expect(titlesIn(entries)).toEqual(['None']);

		// No targets is not the same as nothing to do: this is the only place offering to
		// take a value off, so the entry has to actually take it off.
		entries[0].click();
		await flush();
		expect('iteration' in vault.fm('PBI.md')).toBe(false);
	});

	it('is absent on a key the backfill stubbed, with no link and no targets', () => {
		// ✨ Assign missing properties stubs `iteration: ''` onto every eligible note —
		// `missingKeyStubs` skips only `horizon` and `dependsOn` — so in a vault where it has
		// run before any Iteration exists, key PRESENCE is true on every row while there is
		// neither an assignment to clear nor anywhere to go.
		const vault = new FakeVault();
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, iteration: '' } });
		const { containerEl, view } = makeView(vault, ITERATION_KEY);

		// Not vacuous: the key really is there, and the gate ignores it all the same.
		expect(view.model?.byPath.get('PBI.md')?.ownKeys.iteration).toBe(true);
		expect(view.model?.byPath.get('PBI.md')?.iterationEntry).toBeNull();
		expect(iterationEntries(containerEl, 'PBI')).toBeNull();
	});

	it('is absent with no link and no targets', () => {
		const vault = new FakeVault();
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 } });
		const { containerEl } = makeView(vault, ITERATION_KEY);

		expect(iterationEntries(containerEl, 'PBI')).toBeNull();
	});

	it('checks an entry exactly when the LINK component of the plan is empty', () => {
		const { containerEl } = makeView(iterationVault(), ITERATION_KEY);
		const entries = iterationEntries(containerEl, 'PBI') ?? [];

		expect(entries.map((e) => [e.titleText, e.checked])).toEqual([
			['Sprint 11', false],
			['Sprint 12', true],
			['None', false],
		]);
	});

	/** The two sprints with timeframes of their own, and a PBI in one whose dates drifted. */
	function driftedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Sprint 11.md', { frontmatter: { type: 'Iteration', start: '2026-08-24', due: '2026-09-06' } });
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', start: '2026-09-07', due: '2026-09-20' } });
		vault.addFile('PBI.md', {
			frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]', start: '2026-05-01', due: '2026-05-30' },
		});
		return vault;
	}

	const DATED_KEYS = { iterationProperty: 'note.iteration', startProperty: 'note.start', targetProperty: 'note.due' };

	it("keeps the current iteration checked when the item's dates have drifted from it", () => {
		// The narrowing this menu exists to state. The plan for `Sprint 12` is non-empty —
		// it re-syncs the two dates — so the register's usual "checked when picking writes
		// nothing" would leave every entry unchecked and the row would show no current
		// iteration at all.
		const { containerEl } = makeView(driftedVault(), DATED_KEYS);

		expect((iterationEntries(containerEl, 'PBI') ?? []).map((e) => [e.titleText, e.checked])).toEqual([
			['Sprint 11', false],
			['Sprint 12', true],
			['None', false],
		]);
	});

	it('re-applies the timeframe when the checked iteration is picked', async () => {
		// Checked is not inert: the entry that shows as current still has a write behind
		// it, and it is the schedule alone — the link is already right.
		const vault = driftedVault();
		const { containerEl } = makeView(vault, DATED_KEYS);

		(iterationEntries(containerEl, 'PBI') ?? [])[1].click();
		await flush();

		expect(vault.fm('PBI.md')).toMatchObject({
			iteration: '[[Sprint 12]]',
			start: '2026-09-07',
			due: '2026-09-20',
		});
	});

	it('names two same-basename iterations apart, and writes the one that was picked', async () => {
		const vault = new FakeVault();
		vault.addFile('A/Sprint 12.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('B/Sprint 12.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('Sprint 11.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 } });
		const { containerEl } = makeView(vault, ITERATION_KEY);

		const entries = iterationEntries(containerEl, 'PBI') ?? [];
		// Only where they COLLIDE: qualifying the third would make the ordinary case
		// unreadable to fix a rare one.
		expect(titlesIn(entries)).toEqual(['A/Sprint 12', 'B/Sprint 12', 'Sprint 11']);

		entries[1].click();
		await flush();
		// The value behind an entry is the NOTE, never its label.
		expect(vault.fm('PBI.md')['iteration']).toBe('[[B/Sprint 12]]');
	});
});
