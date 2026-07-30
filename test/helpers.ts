import { TFile } from './obsidian-mock';

export interface FakeLink {
	key: string;
	link: string;
	original: string;
}

export interface FakeCache {
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
	writeLog: { path: string; fm: Record<string, unknown> }[] = [];

	readonly app = {
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
			create: async (path: string, _content: string) => {
				if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
				const file = new TFile(path);
				this.files.set(path, file);
				this.frontmatter.set(path, {});
				this.caches.set(path, {});
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

	/** BasesEntry stand-ins in insertion order. */
	entries(): { file: TFile; getValue: () => null }[] {
		return [...this.files.values()].map((file) => ({ file, getValue: () => null }));
	}

	fm(path: string): Record<string, unknown> {
		return this.frontmatter.get(path) ?? {};
	}
}
