import { App, FileView } from 'obsidian';

/**
 * Which saved view a piece of stored state belongs to, and how that identity is spelled
 * as a storage key. Split from the store because it has a consumer that wants nothing
 * else: `commands/readme.ts` asks only which base view it is looking at.
 */

/** Which base view an entry belongs to. */
export interface ViewIdentity {
	/** Path of the `.base` file. */
	base: string;
	/** The view's name within that base. */
	view: string;
}

/**
 * The map key. It only has to be unique, never parsed — both halves are encoded so
 * no pair of base path and view name can collide with a different pair.
 */
export function viewStateKey(id: ViewIdentity): string {
	return `${encodeURIComponent(id.base)}#${encodeURIComponent(id.view)}`;
}

/**
 * Which base view this is, as a storage key — or null when that cannot be answered.
 *
 * The Bases API hands a view no reference to its own file, but the leaf rendering it
 * does have one: the view element lives inside some `FileView`'s container, and that
 * view knows its file. The view's own name disambiguates several views of one base.
 *
 * Null means session-only, exactly as before persistence existed. Falling back to a
 * shared key would be worse than not persisting: two bases would inherit each other's
 * open rows and prune each other's paths.
 */
export function resolveViewIdentity(app: App, el: HTMLElement, viewName: string): ViewIdentity | null {
	// An array rather than a nullable local: the callback runs synchronously, but
	// narrowing after a closure assignment does not survive the type checker.
	const owner: string[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		if (owner.length > 0) return;
		const view = leaf.view;
		if (!(view instanceof FileView) || !view.file || !view.containerEl.contains(el)) return;
		// It must be the `.base` itself. A base embedded in a note is drawn inside that
		// note's leaf, so the file here would be the host note — and every base embedded
		// in it, plus every view of each, would answer to one key and overwrite each
		// other. That is the sharing this function exists to refuse, so an embedded base
		// keeps its collapse state for the session and no longer.
		if (view.file.extension === 'base') owner.push(view.file.path);
	});
	return owner.length > 0 ? { base: owner[0], view: viewName } : null;
}

/**
 * Where `path` ends up when `oldPath` becomes `newPath`, or null when it is unaffected.
 * A rename moves the thing itself and everything beneath it, so a folder carries its
 * whole subtree — which is the only way a `.base` inside a moved folder is noticed.
 */
export function movedPath(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath;
	return path.startsWith(`${oldPath}/`) ? newPath + path.slice(oldPath.length) : null;
}

/**
 * The view name back out of a key. Only possible because both halves are encoded,
 * so the single literal `#` is always the separator — the property that
 * `pruneMissingBases` deliberately does not rely on, but that a rename needs. Both
 * halves are checked for valid encoding, not only the one returned: a key whose base
 * half is malformed was not written by `viewStateKey`, and guessing a view name off
 * the readable half would be trusting a key this plugin never produced.
 */
export function viewNameOf(key: string): string | null {
	const parts = key.split('#');
	if (parts.length !== 2) return null;
	try {
		const view = decodeURIComponent(parts[1]);
		decodeURIComponent(parts[0]);
		return view;
	} catch {
		return null;
	}
}
