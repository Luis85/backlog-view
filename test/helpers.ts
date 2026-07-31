import { TFile, TFolder } from './obsidian-mock';

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
}

/**
 * In-memory stand-in for the parts of the App surface that model.ts and ops.ts
 * touch: metadata cache, vault file tree, and frontmatter processing.
 */
export class FakeVault {
	files = new Map<string, TFile>();
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
	leaves: { view: unknown }[] = [];
	/** Vault-scoped localStorage, as Obsidian's load/saveLocalStorage present it. */
	localStorage = new Map<string, unknown>();

	readonly app = {
		workspace: {
			getLeaf: (mode: unknown) => ({
				openFile: async (file: TFile) => {
					this.opened.push({ path: file.path, mode });
				},
			}),
			trigger: (...args: unknown[]) => {
				this.triggers.push(args);
			},
			iterateAllLeaves: (cb: (leaf: { view: unknown }) => unknown) => {
				for (const leaf of this.leaves) cb(leaf);
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
			getFirstLinkpathDest: (linkpath: string, _sourcePath: string) => {
				for (const f of this.files.values()) {
					if (f.path === linkpath || f.path === `${linkpath}.md` || f.basename === linkpath) return f;
				}
				return null;
			},
			fileToLinktext: (file: TFile, _sourcePath: string) => file.basename,
		},
		vault: {
			getAbstractFileByPath: (path: string) =>
				this.files.get(path) ?? (this.folders.has(path) ? { path } : null),
			getAllLoadedFiles: () =>
				[...this.folders].map((path) => {
					const folder = new TFolder();
					folder.path = path;
					folder.name = path.split('/').pop() ?? path;
					return folder;
				}),
			create: async (path: string, content: string) => {
				if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
				const file = new TFile(path);
				this.files.set(path, file);
				const fm = parseMockFrontmatter(content);
				this.frontmatter.set(path, fm);
				this.caches.set(path, Object.keys(fm).length > 0 ? { frontmatter: fm } : {});
				this.contents.set(path, content);
				return file;
			},
			createFolder: async (path: string) => {
				if (this.folders.has(path)) throw new Error('Folder already exists.');
				this.folders.add(path);
			},
		},
		fileManager: {
			processFrontMatter: async (file: TFile, fn: (fm: Record<string, unknown>) => void) => {
				const fm = this.frontmatter.get(file.path) ?? {};
				fn(fm);
				this.frontmatter.set(file.path, fm);
				this.writeLog.push({ path: file.path, fm: { ...fm } });
			},
		},
	};

	addFile(path: string, options: AddFileOptions = {}): TFile {
		const file = new TFile(path);
		this.files.set(path, file);
		const cache: FakeCache = {};
		const fm = { ...(options.frontmatter ?? {}) };
		if (options.parentLink !== undefined) {
			fm['parent'] = `[[${options.parentLink}]]`;
			cache.frontmatterLinks = [
				{ key: 'parent', link: options.parentLink, original: `[[${options.parentLink}]]` },
			];
		}
		if (Object.keys(fm).length > 0) cache.frontmatter = fm;
		this.caches.set(path, cache);
		this.frontmatter.set(path, fm);
		return file;
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

/** In-memory BasesViewConfig double that records set() calls. */
export class FakeViewConfig {
	/** User-facing view name — part of the key the collapse store is written under. */
	name = 'Backlog';
	values: Record<string, unknown>;
	setCalls: { key: string; value: unknown }[] = [];
	/** Visible property order, as configured in the Bases properties menu. */
	order: string[] = [];

	constructor(values: Record<string, unknown> = {}) {
		this.values = values;
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
