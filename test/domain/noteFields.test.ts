import { describe, expect, it } from 'vitest';
import type { App, CachedMetadata } from 'obsidian';
import { TFile } from '../helpers/obsidian-mock';
import { hasTag, normalizeTag, readDate, readPlacement, readTags, resolveParent } from '../../src/domain/noteFields';

describe('readTags', () => {
	it('reads a list or a single string, deduped case-insensitively and without the hash', () => {
		expect(readTags(['#alpha', 'beta', 'Alpha'])).toEqual(['alpha', 'beta']);
		expect(readTags('gamma, #delta epsilon')).toEqual(['gamma', 'delta', 'epsilon']);
	});

	it('ignores values that are not strings', () => {
		expect(readTags(42)).toEqual([]);
		expect(readTags(undefined)).toEqual([]);
		expect(readTags([null, 'alpha', 7])).toEqual(['alpha']);
	});
});

describe('hasTag', () => {
	it('compares case-insensitively, the way Obsidian does', () => {
		expect(hasTag(['Sprint'], 'sprint')).toBe(true);
		expect(hasTag(['sprint/12'], 'Sprint/12')).toBe(true);
		expect(hasTag(['sprint'], 'sprint-12')).toBe(false);
		expect(hasTag([], 'anything')).toBe(false);
	});
});

describe('normalizeTag', () => {
	it('keeps what Obsidian accepts and hyphenates the rest', () => {
		expect(normalizeTag('Sprint 12')).toBe('Sprint-12');
		expect(normalizeTag('release/1-0')).toBe('release/1-0');
		expect(normalizeTag('a & b')).toBe('a-b');
		expect(normalizeTag('under_score')).toBe('under_score');
	});

	it('drops unusable characters at the edges instead of hyphenating them', () => {
		// "Sprint 12!" is "Sprint-12", not "Sprint-12-"
		expect(normalizeTag('#Sprint 12!')).toBe('Sprint-12');
		expect(normalizeTag('  ¡hola!  ')).toBe('hola');
	});

	it('leaves hyphens the user typed alone, wherever they are', () => {
		// Hyphens are tag characters, so a doubled one is a different tag, not a typo
		expect(normalizeTag('release--candidate')).toBe('release--candidate');
		// …but hyphens caught up in a run of unusable characters are part of it
		expect(normalizeTag('a!-!b')).toBe('a-b');
		expect(normalizeTag('a - b')).toBe('a-b');
	});

	it('keeps a typed hyphen at either end but never a boundary slash', () => {
		// A hyphen is a legal tag character and the user's choice; a leading or
		// trailing slash would be an empty nesting segment.
		expect(normalizeTag('-urgent')).toBe('-urgent');
		expect(normalizeTag('123-')).toBe('123-');
		expect(normalizeTag('/release/1-0/')).toBe('release/1-0');
		expect(normalizeTag('a//b')).toBe('a/b');
	});

	it('refuses input that could never be a tag', () => {
		// Obsidian requires one non-numeric character — a separator counts
		expect(normalizeTag('123')).toBe('');
		expect(normalizeTag('!!!')).toBe('');
		expect(normalizeTag('   ')).toBe('');
		expect(normalizeTag('2026-07')).toBe('2026-07');
		expect(normalizeTag('2026/07')).toBe('2026/07');
	});

	it('leaves scripts that spell a letter with combining marks intact', () => {
		// The vowel signs are marks, not letters: excluding them turned हिंदी into ह-द
		expect(normalizeTag('हिंदी')).toBe('हिंदी');
		expect(normalizeTag('বাংলা')).toBe('বাংলা');
		// Decomposed é — the accent is a combining mark of its own
		expect(normalizeTag('café')).toBe('café');
		expect(normalizeTag('日本語')).toBe('日本語');
	});
});

describe('readDate', () => {
	it('reads the shapes frontmatter takes, unpadded digits included', () => {
		expect(readDate('2026-08-01')).toEqual({ value: { year: 2026, month: 8, day: 1 }, invalid: false });
		expect(readDate('2026-8-1')).toEqual({ value: { year: 2026, month: 8, day: 1 }, invalid: false });
		expect(readDate(['2026-08-01'])).toEqual({ value: { year: 2026, month: 8, day: 1 }, invalid: false });
	});

	it('places a datetime by the civil date it spells, never a converted one', () => {
		// Whatever the offset says, the note names this calendar day.
		expect(readDate('2026-08-01T23:30:00+11:00').value).toEqual({ year: 2026, month: 8, day: 1 });
		expect(readDate('2026-08-01 09:00').value).toEqual({ year: 2026, month: 8, day: 1 });
	});

	it('tells absence from refusal — the two mean different things on the roadmap', () => {
		expect(readDate(undefined)).toEqual({ value: null, invalid: false });
		expect(readDate(null)).toEqual({ value: null, invalid: false });
		expect(readDate('  ')).toEqual({ value: null, invalid: false });
		expect(readDate([])).toEqual({ value: null, invalid: false });
		expect(readDate('next tuesday')).toEqual({ value: null, invalid: true });
		expect(readDate(20260801)).toEqual({ value: null, invalid: true });
		expect(readDate({ nested: true })).toEqual({ value: null, invalid: true });
	});

	it('refuses a date the calendar does not have rather than guessing', () => {
		expect(readDate('2026-02-30').invalid).toBe(true);
		expect(readDate('2026-13-01').invalid).toBe(true);
		expect(readDate('2026-00-10').invalid).toBe(true);
		// The leap day exists only when it does.
		expect(readDate('2028-02-29').invalid).toBe(false);
		expect(readDate('2026-02-29').invalid).toBe(true);
	});
});

describe('readPlacement', () => {
	it('reads with readString tolerances: lists take their first, scalars their text', () => {
		expect(readPlacement('Now')).toEqual({ value: 'Now', invalid: false });
		expect(readPlacement(['Next', 'Later'])).toEqual({ value: 'Next', invalid: false });
		expect(readPlacement(3)).toEqual({ value: '3', invalid: false });
	});

	it('reads emptiness as absence and resistance as refusal', () => {
		expect(readPlacement(undefined)).toEqual({ value: null, invalid: false });
		expect(readPlacement('')).toEqual({ value: null, invalid: false });
		expect(readPlacement('   ')).toEqual({ value: null, invalid: false });
		expect(readPlacement([])).toEqual({ value: null, invalid: false });
		expect(readPlacement({ nested: true })).toEqual({ value: null, invalid: true });
		expect(readPlacement([{ nested: true }])).toEqual({ value: null, invalid: true });
	});
});

describe('resolveParent', () => {
	it('reads absence when the note has no metadata cache at all', () => {
		// A note with no frontmatter never gets a cache object (`test/CLAUDE.md`'s own
		// note on the fake vault) — the early return this exercises directly, never
		// touching `app` or `file` on that path.
		const result = resolveParent(null as unknown as App, null as unknown as TFile, null, 'parent');
		expect(result).toEqual({ file: null, hasValue: false, explicitRoot: false });
	});

	it('carries the key but resolves to nothing for a pure in-note heading link', () => {
		// `[[#Heading]]` names no note at all — `linkpathFromRawValue` strips the wiki
		// brackets and everything from `#` on, leaving an empty linkpath. The key is
		// present (so this is not folder-mode's "top level" marker), it just names
		// nothing this lookup can resolve.
		const app = { metadataCache: { getFirstLinkpathDest: () => null } } as unknown as App;
		const cache: CachedMetadata = { frontmatterLinks: [], frontmatter: { parent: '[[#Heading]]' } };
		const result = resolveParent(app, null as unknown as TFile, cache, 'parent');
		expect(result).toEqual({ file: null, hasValue: true, explicitRoot: false });
	});
});
