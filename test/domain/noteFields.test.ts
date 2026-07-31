import { describe, expect, it } from 'vitest';
import { hasTag, normalizeTag, readTags } from '../../src/domain/noteFields';

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
