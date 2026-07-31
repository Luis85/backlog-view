import { App, CachedMetadata, TFile } from 'obsidian';

/**
 * Reading a work item's fields off a note. Frontmatter is user-typed data: a parent
 * may be a wikilink, a bare name, an alias, a list, or present-but-empty, and a
 * number may arrive as a string. Every tolerance for that lives here so the model
 * above can deal in resolved values.
 */

export interface ParentRef {
	/** The note the parent property resolves to, regardless of the Base's filter. */
	file: TFile | null;
	hasValue: boolean;
	/** Parent key present but empty — an explicit "top level" marker in folder mode. */
	explicitRoot: boolean;
}

export function resolveParent(app: App, file: TFile, cache: CachedMetadata | null, parentKey: string): ParentRef {
	if (!cache) return { file: null, hasValue: false, explicitRoot: false };

	// Preferred: the parsed frontmatter link cache (handles wikilinks and aliases).
	for (const link of cache.frontmatterLinks ?? []) {
		if (link.key === parentKey || link.key.startsWith(parentKey + '.')) {
			const dest = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
			return { file: dest ?? null, hasValue: true, explicitRoot: false };
		}
	}

	// Fallback: raw frontmatter value, e.g. a plain note name without brackets.
	const fm = cache.frontmatter;
	const raw: unknown = fm?.[parentKey];
	const rawValue: unknown = Array.isArray(raw) ? raw[0] : raw;
	if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
		const keyPresent = !!fm && parentKey in fm;
		return { file: null, hasValue: false, explicitRoot: keyPresent };
	}
	const linkpath = linkpathFromRawValue(rawValue);
	if (linkpath.length === 0) return { file: null, hasValue: true, explicitRoot: false };
	const dest = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
	return { file: dest ?? null, hasValue: true, explicitRoot: false };
}

/** Strip wikilink brackets, aliases and heading refs from a raw parent value. */
function linkpathFromRawValue(rawValue: string): string {
	let linkpath = rawValue.trim();
	const wiki = linkpath.match(/^\[\[([^\]]+)\]\]$/);
	if (wiki) linkpath = wiki[1];
	return linkpath.split('|')[0].split('#')[0].trim();
}

export function readString(value: unknown): string | null {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (Array.isArray(value)) return value.length > 0 ? readString(value[0]) : null;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return null;
}

export function readNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}
