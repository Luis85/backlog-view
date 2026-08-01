import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ProductBacklogPlugin from '../../src/main';
import { getViewOptions } from '../../src/domain/viewOptions';
import { FakeVault } from '../helpers/vault';

/**
 * Every user-facing surface must be named by a requirement.
 *
 * A view-option key is persisted in the user's `.base` file and a command id in their
 * hotkeys, so both are promises that outlive any release: one arriving unspecified is a
 * capability nobody wrote down, and one renamed is a setting silently lost.
 *
 * This lives in the test suite rather than in `docs-check.mjs` for one reason — **it
 * imports the modules and reads what they actually produce.** The script that checks the
 * register is a script over markdown; asking it to also learn what `viewOptions.ts`
 * declares meant regex-scanning TypeScript, and ten review rounds found ten different
 * ways a regex over source can be fooled: a missing space after a colon, a quoted property
 * name, a changed argument to the generator, a value on the next line. None of those exist
 * here. `getViewOptions()` returns the real objects, generated keys included, and
 * `onload()` reports the commands it actually registers — both computed by the code the
 * plugin runs, so a surface added anywhere is discovered rather than remembered.
 */

const REQUIREMENTS = path.join('docs', 'requirements');

/** The register's specification notes. A record that mentions a name does not specify it. */
const specText = readdirSync(REQUIREMENTS)
	.filter((f) => f.endsWith('.md'))
	.map((f) => readFileSync(path.join(REQUIREMENTS, f), 'utf8'))
	.join('\n');

/**
 * Whole-name matching. A substring search accepts a rename to any prefix of a documented
 * name — `showCounts` would vouch for `showCount` — so the name may not be flanked by
 * anything that could make it part of a longer identifier.
 */
function named(name: string): boolean {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`).test(specText);
}

/** What `onload` registers, by running it against the mock `Plugin`. */
function loadPlugin() {
	const plugin = new ProductBacklogPlugin(new FakeVault().app) as unknown as {
		onload: () => void;
		commands: { id: string; name: string }[];
		basesViews: { type: string; name: string }[];
	};
	plugin.onload();
	return plugin;
}
const registeredCommands = () => loadPlugin().commands;
const registeredViews = () => loadPlugin().basesViews;

/** Every option, flattened out of its groups — the shape Bases is handed. */
function optionKeys(): string[] {
	const keys: string[] = [];
	for (const entry of getViewOptions()) {
		const group = entry as { items?: { key?: string }[]; key?: string };
		if (Array.isArray(group.items)) keys.push(...group.items.map((i) => i.key ?? ''));
		else if (group.key) keys.push(group.key);
	}
	return keys;
}

describe('every user-facing surface is specified', () => {
	it('names every view-option key in a requirement', () => {
		const keys = optionKeys();
		// Guards the guard: a schema that returned nothing would make the loop below pass
		// without checking anything, which is the failure mode this whole file replaced.
		expect(keys.length).toBeGreaterThan(10);
		expect(keys.filter((k) => !k)).toEqual([]);

		expect(keys.filter((key) => !named(key))).toEqual([]);
	});

	it('includes the keys generated per type, which no scan of the source could see', () => {
		// `key: typeFolderKey(type)` produces one persisted key per type name. Calling the
		// schema is what makes them ordinary values here rather than something to derive.
		const keys = optionKeys();
		for (const type of ['epic', 'feature', 'pbi', 'task', 'issue', 'bug']) {
			expect(keys).toContain(`typeFolder.${type}`);
		}
	});

	it('names every registered command id in a requirement', () => {
		// Discovered by running the registration, not by naming one constant: a second
		// `addCommand` has to be specified too, and nothing here has to be told it exists.
		const ids = registeredCommands().map((c) => c.id);
		expect(ids.length).toBeGreaterThan(0);

		expect(ids.filter((id) => !named(id))).toEqual([]);
	});

	it('registers the view type the plugin is built around', () => {
		// The same registration pass, so the two cannot drift: if `onload` stops running
		// here, this fails rather than the command check silently finding nothing.
		expect(registeredViews().map((v) => v.type)).toContain('product-backlog');
	});

	it('rejects a name that is only a prefix of a documented one', () => {
		// The substring trap, pinned: `showCounts` is documented, `showCount` is not.
		expect(named('showCounts')).toBe(true);
		expect(named('showCount')).toBe(false);
	});
});
