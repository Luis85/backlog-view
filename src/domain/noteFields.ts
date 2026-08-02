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

/**
 * Frontmatter tags, in either shape Obsidian accepts: a YAML list, or one string
 * holding several tags separated by commas or spaces. The leading '#' is optional
 * in frontmatter, so it is stripped here and re-added only for display.
 */
export function readTags(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : [value];
	const tags: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== 'string') continue;
		for (const part of entry.split(/[,\s]+/)) {
			const tag = part.trim().replace(/^#+/, '');
			if (tag.length > 0 && !hasTag(tags, tag)) tags.push(tag);
		}
	}
	return tags;
}

/**
 * Tags compare case-insensitively — `#Sprint` and `#sprint` are one tag to Obsidian.
 * Every membership test, dedupe and delta comparison goes through these two, so the
 * notion of "same tag" is one decision rather than a `toLowerCase()` in each layer.
 */
export function tagKey(tag: string): string {
	return tag.toLowerCase();
}

export function hasTag(tags: string[], tag: string): boolean {
	return tags.some((existing) => tagKey(existing) === tagKey(tag));
}

/**
 * What Obsidian will accept as a frontmatter tag, applied to what a user typed.
 * Letters, digits, combining marks, underscores, hyphens and '/' as the nesting
 * separator survive; anything else between them becomes a hyphen, and anything else
 * at the edges is dropped ("Sprint 12!" is "Sprint-12", not "Sprint-12-"). Returns ''
 * for input that cannot be a tag at all: Obsidian also requires one non-numeric
 * character, so "123" would be written and then never recognized — a hyphen or a
 * slash satisfies that, which is what makes "2026-07" a perfectly good tag.
 *
 * This is the write-side inverse of `readTags`, and `applyTagDelta` runs it on the way
 * to disk, so no caller can put a tag Obsidian will not read into a note.
 */
export function normalizeTag(input: string): string {
	const tag = input
		.trim()
		// Unusable characters at the edges are dropped, not turned into a hyphen:
		// "Sprint 12!" is "Sprint-12", not "Sprint-12-".
		.replace(/^[^\p{L}\p{N}\p{M}_/-]+|[^\p{L}\p{N}\p{M}_/-]+$/gu, '')
		// One hyphen per run of unusable characters — hyphens caught up in such a run
		// ("a!-!b") are part of the separator, so they collapse with it. A run made
		// only of hyphens is not a separator: "release--candidate" is what was typed
		// and is a perfectly good tag, so it survives untouched.
		.replace(/[^\p{L}\p{N}\p{M}_/]*[^\p{L}\p{N}\p{M}_/-][^\p{L}\p{N}\p{M}_/]*/gu, '-')
		// A hyphen the user typed is theirs to keep at either end too — "-urgent" and
		// "123-" are real tags. A slash there is not: it means an empty nesting
		// segment, which is why only those are collapsed and trimmed.
		.replace(/\/{2,}/g, '/')
		.replace(/^\/+|\/+$/g, '');
	return /[^\p{N}]/u.test(tag) ? tag : '';
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

/**
 * A calendar date as the note spells it — year, month (1–12), day — with no time
 * and no zone. The roadmap places by civil dates deliberately: converting to the
 * viewer's zone would put the same note in different cells on different devices.
 */
export interface CivilDate {
	year: number;
	month: number;
	day: number;
}

/**
 * A field read that tells absence from refusal. The two mean different things on
 * the roadmap — an absent placement is work not yet triaged, while a value the
 * reader refuses shelves the item with the reason visible — so a reader that
 * collapsed them would turn "can't read this" into a silent "not planned".
 */
export interface FieldReading<T> {
	value: T | null;
	/** True when the key holds a value this reader refuses to guess at. */
	invalid: boolean;
}

export function absentReading<T>(): FieldReading<T> {
	return { value: null, invalid: false };
}

/**
 * A single placement value (a roadmap horizon), read with `readString`'s
 * tolerances: a list takes its first entry, numbers and booleans read as their
 * text. What resists even that — an object, a list of unreadable entries — is
 * invalid rather than absent, and an empty value is absence, not refusal.
 */
export function readPlacement(value: unknown): FieldReading<string> {
	if (value === null || value === undefined) return absentReading();
	const text = readString(value);
	if (text !== null) return { value: text, invalid: false };
	const emptyish = typeof value === 'string' || (Array.isArray(value) && value.length === 0);
	return { value: null, invalid: !emptyish };
}

/**
 * Tolerant civil-date read, beside the tolerant number the orders use. Accepts
 * the shapes frontmatter takes — `2026-08-01`, a datetime with any suffix, a
 * quoted string, a list's first entry — and places by the civil date the value
 * spells: the leading year-month-day, never converted to the viewer's zone.
 * A value that exists but spells no calendar date is invalid, never guessed at.
 */
export function readDate(value: unknown): FieldReading<CivilDate> {
	if (value === null || value === undefined) return absentReading();
	if (Array.isArray(value)) return value.length > 0 ? readDate(value[0]) : absentReading();
	if (typeof value !== 'string') return { value: null, invalid: true };
	const text = value.trim();
	if (text.length === 0) return absentReading();
	const match = /^(\d{4})-(\d{1,2})-(\d{1,2})([Tt\s].*)?$/.exec(text);
	if (!match) return { value: null, invalid: true };
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		return { value: null, invalid: true };
	}
	return { value: { year, month, day }, invalid: false };
}

/** Month lengths, leap years included — what makes `2026-02-30` invalid, not a guess. */
export function daysInMonth(year: number, month: number): number {
	// Day 0 of the next month is this month's last day; pure calendar arithmetic.
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
