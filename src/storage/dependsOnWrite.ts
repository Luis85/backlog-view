import { App, TFile } from 'obsidian';
import { linkpathFromRawValue, ownValue } from '../domain/noteFields';
import { BacklogSettings } from '../domain/settings';
import { DependsOnDelta, ItemWrite } from '../domain/writePlan';
import { setOwn } from './ownProperty';

/**
 * Reverses one applied prerequisite change, in RAW TEXT both ways: `add` puts back the
 * exact lines a removal took out, `remove` takes out the exact line an add put in.
 *
 * Declared here rather than inside `RestoreWrite` for a structural reason — this module
 * must not import from `frontmatter.ts`, or the two form a cycle — and it happens to be
 * the right home anyway: the shape is the delta this module produces.
 */
export interface DependsOnRestore {
	key: string;
	add: string[];
	remove: string[];
}

/**
 * The prerequisite list's half of the write boundary.
 *
 * Beside `frontmatter.ts` rather than inside it, and that is a size decision with a real
 * constraint on it: neither function here calls `processFrontMatter`. They transform a
 * frontmatter object the caller already opened, so the rule that every vault write goes
 * through `frontmatter.ts` is untouched — what moved is the list arithmetic, not the
 * write.
 */

/** Every non-blank string the key currently holds, in the note's own order. */
function liveEntries(fm: Record<string, unknown>, key: string): string[] {
	const raw: unknown = ownValue(fm, key);
	return (Array.isArray(raw) ? raw : [raw])
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

/** Write the list back, or remove the key when nothing survives. Absence is a value. */
function writeEntries(fm: Record<string, unknown>, key: string, next: string[]): void {
	if (next.length > 0) setOwn(fm, key, next);
	else delete fm[key];
}

/**
 * Apply one prerequisite delta to the LIVE list, returning the delta that undoes it —
 * or null when nothing changed, so a no-op neither rewrites the value into a different
 * shape nor spends the undo slot.
 *
 * Modelled on `applyTagDelta` above, including the half that is easy to drop: an add
 * checks the live list first. The menu row that planned this can be a refresh behind
 * the note, so the prerequisite may have arrived between the menu opening and the pick
 * landing — and an unconditional append would write a second entry the reader collapses
 * into no visible change, whose inverse then removes EVERY entry naming that note and
 * takes the other writer's line away with it.
 */
function applyDependsOnDelta(
	app: App,
	file: TFile,
	fm: Record<string, unknown>,
	key: string,
	delta: DependsOnDelta,
): DependsOnRestore | null {
	const current = liveEntries(fm, key);
	// Which note a live entry names, asked exactly as the reader asks it.
	const pathOf = (text: string): string | null => {
		const linkpath = linkpathFromRawValue(text);
		if (linkpath.length === 0) return null;
		return app.metadataCache.getFirstLinkpathDest(linkpath, file.path)?.path ?? null;
	};
	// The whole key goes at once, whatever it holds — including a value the reader
	// discards entirely, which is the only state with no line to offer and so the only
	// one that could otherwise be left on disk with nothing able to clear it. Captured by
	// `touchedKeys` rather than as a delta, so it emits no inverse here.
	if (delta.removeKey) {
		if (ownValue(fm, key) !== undefined) delete fm[key];
		return null;
	}
	const drops = (text: string): boolean => {
		if (delta.removeRaw !== undefined && text === delta.removeRaw) return true;
		return delta.removePath !== undefined && pathOf(text) === delta.removePath;
	};
	const removed = current.filter(drops);
	const next = current.filter((text) => !drops(text));
	const added: string[] = [];
	if (delta.add) {
		const wanted = delta.add.path;
		if (!next.some((text) => pathOf(text) === wanted)) {
			const link = '[[' + app.metadataCache.fileToLinktext(delta.add, file.path) + ']]';
			next.push(link);
			added.push(link);
		}
	}
	if (added.length === 0 && removed.length === 0) return null;
	writeEntries(fm, key, next);
	// The inverse: put back what went out, take out what came in.
	return { key, add: removed, remove: added };
}

/**
 * Replay one captured prerequisite inverse, in the same live-value terms, returning the
 * REDO — this inverse read backwards, which is what makes undoing an undo redo.
 */
export function restoreDependsOn(
	fm: Record<string, unknown>,
	restore: DependsOnRestore,
): DependsOnRestore {
	const current = liveEntries(fm, restore.key);
	const next = current.filter((text) => !restore.remove.includes(text));
	for (const text of restore.add) if (!next.includes(text)) next.push(text);
	writeEntries(fm, restore.key, next);
	return { key: restore.key, add: restore.remove, remove: restore.add };
}

/**
 * The prerequisite restore one write earns, or nothing — the configured-key test and the
 * delta application in one place, so the caller states no rule of its own about a key it
 * does not own.
 */
export function dependsOnRestore(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
): DependsOnRestore | undefined {
	// Never a key no property names, the rule every optional write here keeps.
	if (write.dependsOn === undefined || settings.dependsOnKey === '') return undefined;
	return applyDependsOnDelta(app, write.file, fm, settings.dependsOnKey, write.dependsOn) ?? undefined;
}
