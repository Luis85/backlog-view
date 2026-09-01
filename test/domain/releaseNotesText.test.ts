import { describe, expect, it } from 'vitest';
import { releaseIndex, releaseScope, ReleaseRow } from '../../src/domain/releases';
import { ScopeRow } from '../../src/domain/scopeRows';
import { releaseNotesContent } from '../../src/domain/releaseNotesText';
import { joinSource } from '../../src/domain/readmeMarker';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';
import { en } from '../../src/i18n/en';

const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };
const SOURCE = joinSource('P.base', 'Releases', '0.9');

const KEYS = { typeKey: 'type', parentKey: 'parent', orderKey: 'order', membershipKey: 'release' };

/**
 * A real release and its real scope rows, derived by `releaseScope` from a vault — never a
 * hand-built `ScopeRow`, whose `context` flag and type name are exactly what this module
 * is asked to respect and would be asserted into existence by a literal.
 */
function scopeOf(members: Record<string, Record<string, unknown>>): { release: ReleaseRow; rows: ScopeRow[] } {
	const vault = new FakeVault();
	vault.addFile('0.9.md', { frontmatter: { type: 'Release' } });
	for (const [path, fm] of Object.entries(members)) vault.addFile(path, { frontmatter: fm });
	const settings = releaseSettingsWith(KEYS);
	const model = buildModel(vault.app, vault.entries(), settingsWith());
	const index = releaseIndex(vault.app, model, settings, { stateKey: '', today: TODAY });
	const release = index.rows.find((r) => r.path === '0.9.md');
	if (release === undefined) throw new Error('no release row');
	return { release, rows: releaseScope(vault.app, model, settings, index, '0.9.md').rows };
}

/** Every `##` heading, in the order the document writes them. */
const headings = (text: string): string[] =>
	text
		.split('\n')
		.filter((line) => line.startsWith('## '))
		.map((line) => line.slice(3));

const MEMBERS = {
	'Bug one.md': { type: 'Bug', release: '[[0.9]]', order: 1 },
	'First PBI.md': { type: 'PBI', release: '[[0.9]]', order: 1 },
	'Second PBI.md': { type: 'PBI', release: '[[0.9]]', order: 2 },
	'A feature.md': { type: 'Feature', release: '[[0.9]]', order: 1 },
};

describe('the generated release notes', () => {
	it('groups members by type in vocabulary order, keeping the tree’s sequence within each', () => {
		const { release, rows } = scopeOf(MEMBERS);
		const text = releaseNotesContent(release, rows, SOURCE);

		// Vocabulary order, not the order the vault happened to return them in — `Bug` is
		// first in the fixture and last in `ALL_TYPES`.
		expect(headings(text)).toEqual(['Feature', 'PBI', 'Bug']);
		// The tree's own sequence, read from the one derivation the reader just looked at —
		// never a second ordering key that could disagree with it.
		expect(text.indexOf('Second PBI')).toBeGreaterThan(text.indexOf('First PBI'));
	});

	it('files a member the vocabulary cannot name under other, rather than dropping it', () => {
		// An UNTYPED note that something parents to — which is what this case actually looks
		// like in a vault, and it took three fixture attempts to find. A type NAME the
		// vocabulary does not know is refused by `buildModel` and never reaches these rows,
		// and an untyped LEAF is dropped too; an untyped note holding children is kept, and
		// arrives here with `typeName` null belonging to no group. A note that quietly
		// omits work is worse than an untidy heading.
		const { release, rows } = scopeOf({
			'No type yet.md': { release: '[[0.9]]' },
			'A child.md': { type: 'PBI', parent: 'No type yet' },
			'A feature.md': { type: 'Feature', release: '[[0.9]]' },
		});
		const text = releaseNotesContent(release, rows, SOURCE);

		expect(rows.map((row) => row.item.typeName)).toContain(null);
		expect(text).toContain('No type yet');
		expect(headings(text)).toEqual(['Feature', en['release.notes.otherTypes']]);
	});

	it('lists no context row, and adding one changes no line', () => {
		// An Epic holding a member in place is drawn on screen and is not IN the release.
		const withContext = scopeOf({
			'E.md': { type: 'Epic' },
			'First PBI.md': { type: 'PBI', parent: 'E', release: '[[0.9]]', order: 1 },
		});
		const without = scopeOf({ 'First PBI.md': { type: 'PBI', release: '[[0.9]]', order: 1 } });

		expect(withContext.rows.some((row) => row.context)).toBe(true);
		expect(releaseNotesContent(withContext.release, withContext.rows, SOURCE)).toBe(
			releaseNotesContent(without.release, without.rows, SOURCE),
		);
	});

	it('still writes a file for a release with no members', () => {
		// An empty release notes file is a fact; a missing one is ambiguous.
		const { release, rows } = scopeOf({});
		expect(releaseNotesContent(release, rows, SOURCE)).toContain(en['release.notes.empty']);
	});

	it('holds no date of its own, so two generations are byte-identical', () => {
		// The easy thing to get wrong, because this action sits beside one whose whole job
		// is writing today's date.
		const { release, rows } = scopeOf(MEMBERS);
		expect(releaseNotesContent(release, rows, SOURCE)).toBe(releaseNotesContent(release, rows, SOURCE));
		expect(releaseNotesContent(release, rows, SOURCE)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
	});

	it('carries the marker that names base, view and release', () => {
		const { release, rows } = scopeOf(MEMBERS);
		// The first line, so `firstLine` in the writer finds it.
		expect(releaseNotesContent(release, rows, SOURCE).split('\n')[0]).toContain(SOURCE);
	});
});
