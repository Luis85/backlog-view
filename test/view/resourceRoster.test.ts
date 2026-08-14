// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { Harness, flush, makeView, refresh, useViewHarness } from '../helpers/view';
import { resourceVault } from '../helpers/resources';
import { declareResource } from '../../src/view/interactions/labels';

useViewHarness();

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/**
 * The roster's one write path — `declareResource` — and the two facts every caller leans
 * on: WHAT it writes (the name appended once, at the end, in the spelling the reader
 * gave) and WHEN it may write at all (after the gate let the move land, never before).
 * The guards are stated in its doc comment; each one here is the test that fails without
 * it, including the ordering, which no test of the move's own writes can see.
 */

function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	return harness;
}

/** Every write the pick left on the roster option, in order. */
function rosterWrites(harness: Harness): unknown[] {
	return harness.config.setCalls.filter((c) => c.key === 'resourceNames').map((c) => c.value);
}

describe('what a landed move declares', () => {
	it('appends the new name once, at the end, keeping the declared order', async () => {
		const vault = resourceVault();
		const harness = laneRoadmap(vault);
		const { view } = harness;

		await view.performResourceMove(view.model?.byPath.get('Nobody.md') as never, 'Zoe');
		expect(rosterWrites(harness)).toEqual(['Alice, Bob, Zoe']);

		// Declared now, so a second move to the same row amends nothing further. The
		// refresh is the harness's, not the rule's: nothing re-resolves settings here
		// until a data update runs, where a vault re-resolves on the config change.
		refresh(view, vault);
		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Zoe');
		expect(rosterWrites(harness)).toEqual(['Alice, Bob, Zoe']);
	});

	it('appends to what the config holds NOW, so a second new name keeps the first', async () => {
		// No refresh between the two: `host.settings` is a snapshot from the last data
		// update, so a roster read off it still says `Alice, Bob` while the option already
		// says `Alice, Bob, Zoe` — and appending to the snapshot would replace Zoe's
		// declaration with Quinn's while both notes keep their assignee. Reading the config
		// at commit time is what makes the second write a merge.
		const vault = resourceVault();
		const harness = laneRoadmap(vault);
		const { view } = harness;

		await view.performResourceMove(view.model?.byPath.get('Nobody.md') as never, 'Zoe');
		await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Quinn');

		expect(rosterWrites(harness)).toEqual(['Alice, Bob, Zoe', 'Alice, Bob, Zoe, Quinn']);
	});

	it('declares nothing for a removal or a name the roster carries in another casing', async () => {
		const vault = resourceVault();
		const harness = laneRoadmap(vault);
		const { view } = harness;

		await view.performResourceMove(view.model?.byPath.get('Nobody.md') as never, 'alice');
		expect(vault.fm('Nobody.md')['assignee']).toBe('alice');
		refresh(view, vault);
		await view.performResourceMove(view.model?.byPath.get('Nobody.md') as never, null);
		expect('assignee' in vault.fm('Nobody.md')).toBe(false);

		expect(rosterWrites(harness)).toEqual([]);
	});

	it('declares nothing to an unconfigured key', () => {
		const harness = makeView(resourceVault(), {});

		declareResource(harness.view, 'Zoe');

		expect(rosterWrites(harness)).toEqual([]);
	});

	it('refuses a name holding the list separator, and the assignee write still lands', async () => {
		const vault = resourceVault();
		const harness = laneRoadmap(vault);
		const { view } = harness;

		// The roster round-trips through one comma-separated option — `resolveSettings`
		// splits it back on commas — so declaring "Doe, Jane" would hand the next resolve
		// two entries nobody is called. The NOTE takes the name exactly as picked; only
		// the roster declines, and the row still draws from the observed name.
		const moved = await view.performResourceMove(view.model?.byPath.get('Nobody.md') as never, 'Doe, Jane');

		expect(moved).toBe(true);
		expect(vault.fm('Nobody.md')['assignee']).toBe('Doe, Jane');
		expect(rosterWrites(harness)).toEqual([]);
	});
});

describe('when the roster may be amended at all', () => {
	it('a move the gate refuses amends nothing', async () => {
		// A key collision blocks every write, loudly. The roster is written on the same
		// authority as the move itself, so a refusal must leave both untouched — a `.base`
		// amended behind a refusal the user is being shown is half a write applied.
		const vault = resourceVault();
		const harness = laneRoadmap(vault, { stateProperty: 'note.start' });
		const { view } = harness;

		const applied = await view.performResourceMove(view.model?.byPath.get('Nobody.md') as never, 'Zoe');

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(rosterWrites(harness)).toEqual([]);
	});

	it('an off-axis pick declares only after its write lands', async () => {
		const vault = resourceVault();
		const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob' });
		const { view } = harness;

		// The tree's Set assignee — `chooseAssignee`'s direct branch, the one that does
		// not route through the move. Zoe is observed on a result, declared by nobody.
		view.showContextMenuFor(view.model?.byPath.get('Nobody.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Zoe')?.click();
		await flush();

		expect(vault.fm('Nobody.md')['assignee']).toBe('Zoe');
		expect(rosterWrites(harness)).toEqual(['Alice, Bob, Zoe']);
	});
});
