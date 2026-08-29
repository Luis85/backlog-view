import { FileView, TFile, TFolder } from './obsidian-mock';

interface FakeLink {
	key: string;
	link: string;
	original: string;
}

interface FakeCache {
	frontmatter?: Record<string, unknown>;
	frontmatterLinks?: FakeLink[];
}

export interface AddFileOptions {
	frontmatter?: Record<string, unknown>;
	/** Values of the `parent` key rendered as parsed frontmatter links. */
	parentLink?: string;
	/**
	 * Frontmatter LIST values Obsidian would have parsed into its link cache, keyed by
	 * property. A list is cached per entry (`dependsOn.0`, `dependsOn.1`), which is the
	 * shape `readLinkList` reads and the one a raw-value fallback cannot exercise — so a
	 * test wanting the real wikilink path has to be able to build it.
	 */
	listLinks?: Record<string, string[]>;
	/** `file.stat.mtime`, for tests exercising "last modified" ordering. Defaults to 0. */
	mtime?: number;
}

/**
 * A workspace leaf as the view sees one: something drawing a view, and something that
 * can be pinned. Every leaf the fake hands out is walked by `iterateAllLeaves`,
 * including the ones `getLeaf` makes — which is what lets a test tell "opened a second
 * pane" from "reused the one it already had".
 */
export interface FakeLeaf {
	view: unknown;
	pinned: boolean;
	setPinned: (pinned: boolean) => void;
}

/**
 * A `Map` that counts the mutations made to it, so a cache over its contents can tell
 * whether it is still current.
 *
 * The file map is PUBLIC and tests mutate it directly (`vault.files.delete('Gone.md')`),
 * so no method on `FakeVault` can hook every change — which is why the counter lives on
 * the map rather than beside it. Counting mutations rather than comparing `size` is the
 * whole point: a delete followed by an add leaves the size where it started, and a cache
 * trusting that reuses entries for a file that is gone.
 */
class TrackedMap<K, V> extends Map<K, V> {
	version = 0;

	override set(key: K, value: V): this {
		this.version++;
		return super.set(key, value);
	}

	override delete(key: K): boolean {
		this.version++;
		return super.delete(key);
	}

	override clear(): void {
		this.version++;
		super.clear();
	}
}

/**
 * In-memory stand-in for the parts of the App surface that model.ts and ops.ts
 * touch: metadata cache, vault file tree, and frontmatter processing.
 */
export class FakeVault {
	files = new TrackedMap<string, TFile>();
	folders = new Set<string>(['/']);
	caches = new Map<string, FakeCache>();
	frontmatter = new Map<string, Record<string, unknown>>();
	/** Raw body text passed to vault.create, keyed by path. */
	contents = new Map<string, string>();
	writeLog: { path: string; fm: Record<string, unknown> }[] = [];
	/** Files opened through workspace.getLeaf().openFile(), with the leaf mode used. */
	opened: { path: string; mode: unknown }[] = [];
	/** Arguments of workspace.trigger() calls (hover-link, file-menu, …). */
	triggers: unknown[][] = [];
	/** Leaves iterateAllLeaves walks — how the view finds the base file it belongs to. */
	leaves: FakeLeaf[] = [];
	/** The view the workspace calls active; null unless a test focuses a leaf. */
	activeView: unknown = null;
	/** Vault-scoped localStorage, as Obsidian's load/saveLocalStorage present it. */
	localStorage = new Map<string, unknown>();
	/** Paths whose processFrontMatter throws — how tests make a batch fail partway. */
	failWrites = new Set<string>();
	/** Called as each write or creation lands — how tests interleave a Bases update with a batch. */
	afterWrite: ((path: string) => void) | null = null;
	/** Awaited before each write lands — how a test stalls a batch to interleave a second one. */
	beforeWrite: ((path: string) => Promise<void> | void) | null = null;
	/** Handlers registered through vault.on('rename'), fired by `renameFile`. */
	private renameHandlers: ((file: TFile, oldPath: string) => void)[] = [];
	/**
	 * Basename → file, for `getFirstLinkpathDest`. Rebuilt whenever `files.version` moves,
	 * which is every add, delete, rename and clear — including the ones tests make on the
	 * public map, which no method here could hook.
	 *
	 * It counts mutations rather than watching `size`, because size is not a mutation
	 * detector: a delete and an add between two lookups return it to where it started, and
	 * the stale index then answers with a file that has been removed. (Codex, PR #128.)
	 */
	private basenameIndex: Map<string, TFile> | null = null;
	/** Handlers registered through workspace.on('css-change'), fired by `changeCss`. */
	private cssChangeHandlers: (() => void)[] = [];

	readonly app = {
		workspace: {
			// A leaf the view made, not one it is drawn in: it carries an element of its
			// own so the walk that looks for THIS view's leaf can rule it out, the way a
			// real leaf's view always has one.
			getLeaf: (mode: unknown) =>
				Object.assign(this.addLeaf({ containerEl: document.createElement('div') }), {
					openFile: async (file: TFile) => {
						this.opened.push({ path: file.path, mode });
					},
				}),
			trigger: (...args: unknown[]) => {
				this.triggers.push(args);
			},
			iterateAllLeaves: (cb: (leaf: FakeLeaf) => unknown) => {
				for (const leaf of this.leaves) cb(leaf);
			},
			/**
			 * The active leaf's view — how the registry finds the backlog view a command
			 * should act on. Tests set `activeView` to one of the leaves' FileViews.
			 */
			getActiveViewOfType: (ctor: abstract new (...args: never[]) => unknown) =>
				this.activeView instanceof ctor ? this.activeView : null,
			/**
			 * Workspace events, same shape as `vault.on` above: the handler is kept so a
			 * test can fire it. `css-change` is the one the view subscribes to — the fit
			 * ladder measures rendered text, so a theme change has to re-run it, and
			 * nothing else in the app reports one.
			 */
			on: (name: string, cb: () => void) => {
				if (name === 'css-change') this.cssChangeHandlers.push(cb);
				return { name };
			},
		},
		loadLocalStorage: (key: string) => this.localStorage.get(key) ?? null,
		saveLocalStorage: (key: string, data: unknown) => {
			if (data === null) this.localStorage.delete(key);
			// Obsidian serializes on the way out; round-trip so tests cannot pass by
			// holding a live reference to the object the view still mutates.
			else this.localStorage.set(key, JSON.parse(JSON.stringify(data)) as unknown);
		},
		renderContext: {},
		metadataCache: {
			getFileCache: (file: TFile) => this.caches.get(file.path) ?? null,
			/**
			 * Indexed, because the fake is also the INSTRUMENT a large fixture is measured
			 * with. The scan this replaced was one pass over every file per link, so an
			 * 800-note flat fixture spent its time here rather than in the plugin — a
			 * hotspot with no counterpart in a vault, where Obsidian resolves through an
			 * index of its own.
			 *
			 * The precedence is now stated rather than emergent. The scan returned the
			 * first file matching ANY of the three conditions, so an earlier-inserted
			 * basename match beat a later exact-path one; nothing relies on that and a
			 * vault does not do it.
			 */
			getFirstLinkpathDest: (linkpath: string, _sourcePath: string) => {
				// Case-FOLDED, matching Obsidian's own resolution: `assignee: alice` must
				// resolve against an `Alice.md` exactly as a real vault would.
				const lower = linkpath.toLowerCase();
				return this.byPathLower().get(lower) ?? this.byPathLower().get(`${lower}.md`) ?? this.byBasenameLower().get(lower) ?? null;
			},
			/**
			 * Obsidian's "shortest path when possible": the basename while it names this
			 * file and no other, and the path without its extension once two files share
			 * one. The bare basename alone made this fake KINDER than the app — two notes
			 * called `Sprint 12` produced the same link text, so a write aimed at either
			 * looked identical on disk and a test asserting which one was picked could
			 * only ever pass. Same class of gap as `createSvg` in `dom.ts`.
			 */
			fileToLinktext: (file: TFile, _sourcePath: string) =>
				this.ambiguousBasenames().has(file.basename)
					? file.path.slice(0, -(file.extension.length + 1))
					: file.basename,
		},
		vault: {
			getAbstractFileByPath: (path: string) =>
				this.files.get(path) ?? (this.folders.has(path) ? { path } : null),
			/** Files only, as the real one is: a folder at this path answers null. */
			getFileByPath: (path: string) => this.files.get(path) ?? null,
			getAllLoadedFiles: () =>
				[...this.folders].map((path) => {
					const folder = new TFolder();
					folder.path = path;
					folder.name = path.split('/').pop() ?? path;
					return folder;
				}),
			create: async (path: string, content: string) => {
				// A creation is a write, so it takes the same BEFORE hook the frontmatter
				// writer does — the mirror of the `afterWrite` argument below, and the
				// window a caller's own pre-create check sits in front of. Guarded rather
				// than `await this.beforeWrite?.(...)` for that call's stated reason: an
				// awaited `undefined` still costs a microtask the unhooked path never had.
				if (this.beforeWrite) await this.beforeWrite(path);
				if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
				const file = new TFile(path);
				this.files.set(path, file);
				const fm = parseMockFrontmatter(content);
				this.frontmatter.set(path, fm);
				this.caches.set(path, Object.keys(fm).length > 0 ? { frontmatter: fm } : {});
				this.contents.set(path, content);
				// A creation is a vault change like any other, so it notifies like one.
				// Only firing from processFrontMatter made "after a write" mean "after a
				// frontmatter write", and a caller watching for the vault to change saw
				// nothing at all when the change was a new note.
				this.afterWrite?.(path);
				return file;
			},
			createFolder: async (path: string) => {
				// Hooked like `create` and `processFrontMatter` beside it, because this is
				// the await a note-creating caller sits behind: `ensureFolder` runs before
				// `vault.create`, so a guard the caller asks BEFORE it has a window after
				// it, and this is the only way a test can put anything inside that window.
				if (this.beforeWrite) await this.beforeWrite(path);
				if (this.folders.has(path)) throw new Error('Folder already exists.');
				this.folders.add(path);
			},
			on: (name: string, cb: (file: TFile, oldPath: string) => void) => {
				if (name === 'rename') this.renameHandlers.push(cb);
				return { name };
			},
			read: async (file: TFile) => this.contents.get(file.path) ?? '',
			modify: async (file: TFile, content: string) => {
				this.contents.set(file.path, content);
			},
			// Obsidian's atomic read-modify-write. Kept honest about the one thing it
			// exists for: the callback is handed what is on disk NOW, which a test can
			// change between the caller's read and this call to drive the raced path.
			process: async (file: TFile, fn: (data: string) => string) => {
				const next = fn(this.contents.get(file.path) ?? '');
				this.contents.set(file.path, next);
				return next;
			},
		},
		fileManager: {
			processFrontMatter: async (file: TFile, fn: (fm: Record<string, unknown>) => void) => {
				// Guarded rather than `await this.beforeWrite?.(...)`: awaiting `undefined`
				// still yields a microtask, which is one more than the unhooked path had
				// before this hook existed — and at least one test depends on a write
				// landing synchronously within the same tick as the drop that triggers it.
				if (this.beforeWrite) await this.beforeWrite(file.path);
				// Injected failure, for the partial-batch paths a real vault produces.
				if (this.failWrites.has(file.path)) throw new Error(`write failed: ${file.path}`);
				const fm = this.frontmatter.get(file.path) ?? {};
				fn(fm);
				this.frontmatter.set(file.path, fm);
				this.writeLog.push({ path: file.path, fm: { ...fm } });
				// How a test reproduces Bases noticing the vault change while the batch
				// is still running — the view defers that update and rebuilds on the way
				// out, so anything read after the await sees the rebuilt board.
				this.afterWrite?.(file.path);
			},
			/**
			 * Obsidian's link-preserving rename — the API a caller must use rather than
			 * `vault.rename`, and therefore the one this fake has to offer. Delegates to
			 * this class's own {@link renameFile}, so a rename driven through the app object
			 * moves the caches and rewrites the links exactly as one driven by a test does.
			 */
			renameFile: async (file: TFile, newPath: string) => {
				this.renameFile(file.path, newPath);
			},
			/** Obsidian's own delete-to-trash, recorded so a test can assert the note went. */
			trashFile: async (file: TFile) => {
				this.files.delete(file.path);
				this.caches.delete(file.path);
				this.frontmatter.delete(file.path);
				this.trashed.push(file.path);
			},
		},
	};

	/** Paths `fileManager.trashFile` removed, in the order they went. */
	readonly trashed: string[] = [];

	/** What Obsidian fires when the theme, the appearance settings or a snippet change. */
	changeCss(): void {
		for (const cb of this.cssChangeHandlers) cb();
	}

	/** Add a leaf the workspace walks, recording whether anything pinned it. */
	addLeaf(view: unknown): FakeLeaf {
		const leaf: FakeLeaf = {
			view,
			pinned: false,
			setPinned: (pinned: boolean) => {
				leaf.pinned = pinned;
			},
		};
		this.leaves.push(leaf);
		return leaf;
	}

	/**
	 * Basename → file in insertion order, so the first note added under a name wins —
	 * which is what the scan this replaced did. Rebuilt whenever the map has been mutated
	 * since it was built; a rename needs no invalidation of its own, because the two calls
	 * it makes on `files` are themselves what moves the version.
	 *
	 * Builds the CASE-FOLDED indexes below in the same pass, off the same version gate —
	 * `getFirstLinkpathDest` resolves case-insensitively in a real vault, which this
	 * method's own exact keys cannot answer. Kept a SEPARATE pair of maps rather than
	 * lower-cased in place: `ambiguousBasenames` is `fileToLinktext`'s exact-case question
	 * ("does this basename collide"), unrelated to how a link resolves, and folding the one
	 * index would have answered both questions with the wrong casing for the other.
	 */
	private byBasename(): Map<string, TFile> {
		if (this.basenameIndex !== null && this.indexedVersion === this.files.version) return this.basenameIndex;
		const index = new Map<string, TFile>();
		const ambiguous = new Set<string>();
		const indexLower = new Map<string, TFile>();
		const pathLower = new Map<string, TFile>();
		for (const file of this.files.values()) {
			if (index.has(file.basename)) ambiguous.add(file.basename);
			else index.set(file.basename, file);
			if (!indexLower.has(file.basename.toLowerCase())) indexLower.set(file.basename.toLowerCase(), file);
			if (!pathLower.has(file.path.toLowerCase())) pathLower.set(file.path.toLowerCase(), file);
		}
		this.basenameIndex = index;
		this.ambiguous = ambiguous;
		this.basenameIndexLower = indexLower;
		this.pathIndexLower = pathLower;
		this.indexedVersion = this.files.version;
		return index;
	}

	/** The basenames more than one file carries — built with the index above. */
	private ambiguousBasenames(): Set<string> {
		this.byBasename();
		return this.ambiguous;
	}

	/** Case-folded basename index — see `byBasename`'s own doc for why it is separate. */
	private byBasenameLower(): Map<string, TFile> {
		this.byBasename();
		return this.basenameIndexLower ?? new Map();
	}

	/** Case-folded exact-path index, built beside `byBasenameLower` for the same reason. */
	private byPathLower(): Map<string, TFile> {
		this.byBasename();
		return this.pathIndexLower ?? new Map();
	}

	/** Filled by `byBasename`, which is the only thing that may write it. */
	private ambiguous = new Set<string>();

	/** The `files.version` `basenameIndex` was built at — see `basenameIndex`. */
	private indexedVersion = -1;

	/** Filled by `byBasename` — see its own doc. */
	private basenameIndexLower: Map<string, TFile> | null = null;

	/** Filled by `byBasename` — see its own doc. */
	private pathIndexLower: Map<string, TFile> | null = null;

	/** Rename a file and fire vault.on('rename'), as Obsidian does. */
	renameFile(oldPath: string, newPath: string): TFile {
		const file = this.files.get(oldPath);
		if (!file) throw new Error(`no such file: ${oldPath}`);
		// The old name is read BEFORE the move, because the move rewrites it: the file
		// object is mutated in place, as Obsidian's is.
		const oldBasename = file.basename;
		this.files.delete(oldPath);
		const cache = this.caches.get(oldPath);
		const fm = this.frontmatter.get(oldPath);
		this.caches.delete(oldPath);
		this.frontmatter.delete(oldPath);
		file.moveTo(newPath);
		this.files.set(newPath, file);
		if (cache) this.caches.set(newPath, cache);
		if (fm) this.frontmatter.set(newPath, fm);
		// Obsidian rewrites links that pointed at the old name; without that the
		// children of a renamed parent would orphan themselves and the rename would
		// look like a restructure rather than a rename.
		for (const [path, cache] of this.caches) {
			for (const link of cache.frontmatterLinks ?? []) {
				if (link.link !== oldBasename) continue;
				link.link = file.basename;
				link.original = `[[${file.basename}]]`;
				const fm = this.frontmatter.get(path);
				if (fm) fm['parent'] = `[[${file.basename}]]`;
			}
		}
		for (const cb of this.renameHandlers) cb(file, oldPath);
		return file;
	}

	/**
	 * Move a folder and everything under it, firing one vault rename for the folder —
	 * which is what Obsidian reports, and what the descendant paths have to be derived
	 * from.
	 */
	renameFolder(oldPath: string, newPath: string): void {
		for (const [path, file] of [...this.files]) {
			if (!path.startsWith(`${oldPath}/`)) continue;
			const moved = newPath + path.slice(oldPath.length);
			file.moveTo(moved);
			this.files.delete(path);
			this.files.set(moved, file);
			const cache = this.caches.get(path);
			const fm = this.frontmatter.get(path);
			this.caches.delete(path);
			this.frontmatter.delete(path);
			if (cache) this.caches.set(moved, cache);
			if (fm) this.frontmatter.set(moved, fm);
		}
		this.folders.delete(oldPath);
		this.folders.add(newPath);
		for (const cb of this.renameHandlers) cb({ path: newPath } as TFile, oldPath);
	}

	addFile(path: string, options: AddFileOptions = {}): TFile {
		const file = new TFile(path, options.mtime ?? 0);
		this.files.set(path, file);
		const cache: FakeCache = {};
		const fm = { ...(options.frontmatter ?? {}) };
		if (options.parentLink !== undefined) {
			fm['parent'] = `[[${options.parentLink}]]`;
			cache.frontmatterLinks = [
				{ key: 'parent', link: options.parentLink, original: `[[${options.parentLink}]]` },
			];
		}
		for (const [key, links] of Object.entries(options.listLinks ?? {})) {
			fm[key] = links.map((link) => `[[${link}]]`);
			cache.frontmatterLinks = [
				...(cache.frontmatterLinks ?? []),
				...links.map((link, index) => ({
					key: `${key}.${index}`,
					link,
					original: `[[${link}]]`,
				})),
			];
		}
		if (Object.keys(fm).length > 0) cache.frontmatter = fm;
		this.caches.set(path, cache);
		this.frontmatter.set(path, fm);
		return file;
	}

	/**
	 * Replace a file's frontmatter after `addFile`, as an out-of-band edit rather than
	 * a `processFrontMatter` write — it does not append to `writeLog`. Keeps whatever
	 * `parent` key `addFile`'s `parentLink` set up, so a caller editing only the dated
	 * fields does not have to re-wire the parent link.
	 */
	setFrontmatter(path: string, frontmatter: Record<string, unknown>): void {
		const existing = this.frontmatter.get(path) ?? {};
		const fm = { ...frontmatter };
		if ('parent' in existing && !('parent' in fm)) fm['parent'] = existing['parent'];
		this.frontmatter.set(path, fm);
		const cache = this.caches.get(path) ?? {};
		cache.frontmatter = fm;
		this.caches.set(path, cache);
	}

	/**
	 * Drop a file's metadata cache entry while leaving the file itself — the window a real
	 * vault has between `vault.create` resolving and Obsidian indexing the new note, which
	 * this stub otherwise never shows because `create` indexes synchronously. A test that
	 * asks what a reader does with NO cache (rather than with a cache that answers "not
	 * this type") has to say so, and this is how.
	 */
	unindex(path: string): void {
		this.caches.delete(path);
	}

	/** Per-file property values served through the BasesEntry stand-ins (keyed by property id). */
	entryValues = new Map<string, Record<string, unknown>>();

	/** BasesEntry stand-ins in insertion order. */
	entries(): { file: TFile; getValue: (propertyId: string) => unknown }[] {
		return [...this.files.values()].map((file) => ({
			file,
			getValue: (propertyId: string) => this.entryValues.get(file.path)?.[propertyId] ?? null,
		}));
	}

	fm(path: string): Record<string, unknown> {
		return this.frontmatter.get(path) ?? {};
	}
}

/** Inverse of the mock stringifyYaml: `key: <json>` lines between --- markers. */
function parseMockFrontmatter(content: string): Record<string, unknown> {
	const fm: Record<string, unknown> = {};
	if (!content.startsWith('---\n')) return fm;
	const end = content.indexOf('\n---', 4);
	if (end === -1) return fm;
	for (const line of content.substring(4, end).split('\n')) {
		const sep = line.indexOf(': ');
		if (sep === -1) continue;
		fm[line.substring(0, sep)] = JSON.parse(line.substring(sep + 2)) as unknown;
	}
	return fm;
}

/**
 * A view's container element, inside a leaf that (optionally) is showing a `.base`
 * file — `makeView`'s and `makeEstimationView`'s own first three lines, shared because
 * both need the real leaf nesting (identity resolution walks `iterateAllLeaves` for it,
 * `storage/CLAUDE.md`'s own rule), not because the two harnesses share anything about
 * how they finish constructing their view.
 */
export function mountLeaf(vault: FakeVault, base?: string): HTMLElement {
	const leafEl = document.body.createDiv();
	const containerEl = leafEl.createDiv();
	if (base) vault.addLeaf(new FileView(vault.addFile(base), leafEl));
	return containerEl;
}

/** In-memory BasesViewConfig double that records set() calls. */
export class FakeViewConfig {
	/** User-facing view name — part of the key the view-state store is written under. */
	name = 'Backlog';
	values: Record<string, unknown>;
	setCalls: { key: string; value: unknown }[] = [];
	/** Visible property order, as configured in the Bases properties menu. */
	order: string[] = [];

	/**
	 * COPIED, never held by reference. Tests pass a module-level literal —
	 * `const configured = { assigneeProperty: 'note.assignee' }` is the shape — and a fake
	 * that wrote into it would let one test's `set` reach every later test sharing that
	 * object. Invisible until something started writing a key the tests also read: the
	 * assignee roster used to work this way, appended to on every pick by a write path
	 * Task 7 deleted (`declareResource`) — before that removal, one test's `Sam` could
	 * appear in the next test's menu without this copy.
	 */
	constructor(values: Record<string, unknown> = {}) {
		this.values = { ...values };
	}
	get(key: string): unknown {
		return this.values[key];
	}
	set(key: string, value: unknown): void {
		this.values[key] = value;
		this.setCalls.push({ key, value });
	}
	getAsPropertyId(key: string): string | null {
		const v = this.values[key];
		return typeof v === 'string' && v.includes('.') ? v : null;
	}
	getOrder(): string[] {
		return [...this.order];
	}
	getDisplayName(propertyId: string): string {
		return propertyId.substring(propertyId.indexOf('.') + 1);
	}
	getSort(): unknown[] {
		return [];
	}
}
