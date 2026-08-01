import { App, TFile } from 'obsidian';

/**
 * Folder-note hierarchy inference. In folder mode a note with no explicit parent
 * link hangs from the nearest ancestor *folder note* — a note named like its folder,
 * `Checkout/Checkout.md`. The same walk is needed against two different worlds: the
 * items this view loaded, and the vault itself (for ancestors the Base filtered out),
 * so it lives here rather than in either caller.
 */

/**
 * The nearest ancestor folder note in the result set. A folder note itself starts
 * the walk above its own folder, and container folders without a note of their own
 * (like "use-cases/") pass through. Exported so "Use folder position" can predict
 * where an item will land.
 *
 * Generic over the item, because it is called from two different build phases: all it
 * needs is a path and object identity, and asking for a whole `BacklogItem` would be
 * asking `linkAll` for fields that do not exist yet while it is doing the linking.
 */
export function inferFolderParent<T extends { file: TFile }>(item: T, byPath: Map<string, T>): T | null {
	return walkUp(item.file.path, (path) => {
		const candidate = byPath.get(path);
		return candidate && candidate !== item ? candidate : null;
	});
}

/** The same walk against the vault: finds a folder note whether or not it was loaded. */
export function nearestFolderNote(app: App, path: string): TFile | null {
	return walkUp(path, (candidatePath) => {
		const candidate = app.vault.getAbstractFileByPath(candidatePath);
		return candidate instanceof TFile && candidate.path !== path ? candidate : null;
	});
}

/**
 * Walk the ancestor folders of `path`, offering each folder-note path to `resolve`
 * until it yields something. A folder note starts above its own folder, so
 * `Checkout/Checkout.md` looks for a parent outside `Checkout/`.
 */
function walkUp<T>(path: string, resolve: (folderNotePath: string) => T | null): T | null {
	let folder = parentFolderOf(path);
	if (folder !== null && folderNotePath(folder) === path) folder = parentFolderOf(folder);
	while (folder !== null) {
		const found = resolve(folderNotePath(folder));
		if (found !== null) return found;
		folder = parentFolderOf(folder);
	}
	return null;
}

function folderNotePath(folderPath: string): string {
	const name = folderPath.substring(folderPath.lastIndexOf('/') + 1);
	return `${folderPath}/${name}.md`;
}

function parentFolderOf(path: string): string | null {
	const idx = path.lastIndexOf('/');
	return idx > 0 ? path.substring(0, idx) : null;
}
