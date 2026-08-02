import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ProductBacklogPlugin from '../../src/main';
import { getViewOptions } from '../../src/domain/viewOptions';
import { ALL_TYPES, typeFolderKey } from '../../src/domain/settings';
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

/**
 * The register's specification notes. A record that mentions a name does not specify it.
 *
 * Recursive, because `docs-check.mjs` walks `docs/` recursively and validates a note in
 * `requirements/board/` as a requirement. A flat read here would drop it from the corpus,
 * so an id specified only in a nested note would fail this test while the register was
 * perfectly correct — the two halves of the split disagreeing about what a requirement is.
 */
function specFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return specFiles(full);
		return entry.name.endsWith('.md') ? [full] : [];
	});
}
const specText = specFiles(REQUIREMENTS)
	.map((f) => readFileSync(f, 'utf8'))
	.join('\n');

/**
 * Only the **code** in the requirements — the spans and blocks the register writes an
 * identifier in. Searching the prose let ordinary English vouch for a surface: the word
 * "backlog" is on nearly every page, so renaming the command to `backlog` passed a check
 * whose whole job was to notice that nobody had specified it. An id is never prose here,
 * so restricting the corpus costs nothing and closes the collision entirely.
 */
function code(text: string): string {
	const fenced = [...text.matchAll(/```\w*\n([\s\S]*?)```/g)].map(([, body]) => body);
	const inline = [...text.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map(([, body]) => body);
	return [...fenced, ...inline].join('\n');
}

/**
 * That code split into the identifiers it contains, so a name is *found* only when the
 * text carries that whole name and nothing more. A substring search accepts a rename to
 * any fragment of a documented name, and the fragment can sit at either end and be made
 * of any of the three characters an id here is built from: `showCounts` vouching for
 * `showCount`, `create-backlog` for `backlog`, `typeFolder.epic` for `typeFolder`.
 * Membership in a token set has no ends to get wrong; a boundary pattern has two, and the
 * hyphen was missing from both.
 */
function tokens(text: string): Set<string> {
	const found = code(text).match(/[\w.-]+/g) ?? [];
	return new Set(found.map((token) => token.replace(/^[.-]+|[.-]+$/g, '')).filter(Boolean));
}
const SPEC_TOKENS = tokens(specText);
const named = (name: string): boolean => SPEC_TOKENS.has(name);

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
		// `key: typeFolderKey(type)` produces one persisted key per type name. Reading the
		// VOCABULARY rather than a copy of it is what makes a seventh name covered by
		// arriving rather than by being remembered — the discipline `NON_RUNG_STYLE`
		// already has, and the reason a `Milestone` could otherwise ship uncovered.
		const keys = optionKeys();
		expect(ALL_TYPES.length).toBeGreaterThan(0);
		for (const type of ALL_TYPES) {
			expect(keys).toContain(typeFolderKey(type));
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

	it('rejects a name that is only a fragment of a documented one', () => {
		// Pinned against a fixed sample rather than the register, so the rule is stated
		// rather than depending on which English words the requirements happen to use —
		// `backlog` is a word on nearly every page, and it must still fail as an id.
		const sample = tokens('`showCounts`, `create-backlog` and `typeFolder.epic`.');
		for (const whole of ['showCounts', 'create-backlog', 'typeFolder.epic']) {
			expect(sample.has(whole)).toBe(true);
		}
		for (const fragment of ['showCount', 'backlog', 'create', 'typeFolder', 'epic']) {
			expect(sample.has(fragment)).toBe(false);
		}
		// And the real corpus does document the name the trap was found on.
		expect(named('showCounts')).toBe(true);
	});
});
