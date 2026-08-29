import { t } from '../i18n/t';
import { ReleaseRow, ScopeRow } from './releases';
import { readmeMarker } from './readmeMarker';
import { ALL_TYPES } from './typeVocabulary';
import { sameValue } from './noteFields';

/**
 * What the generated release notes say — beside `backlogReadme.ts` and shaped like it:
 * this decides what the document SAYS, `storage/releaseNotesFile.ts` decides whether it
 * may be written at all.
 *
 * **Nothing dated goes in the body.** That is what makes a regeneration over an unchanged
 * release byte-identical, and it is the easy thing to get wrong here because the action
 * beside this one exists to write today's date.
 *
 * It states its own POPULATION once — what this base returned — and never how many notes
 * it could not see, because nothing can count those: membership lives on the item, so an
 * excluded item is invisible to the view. A promise this can keep, in place of one it
 * cannot.
 */
export function releaseNotesContent(release: ReleaseRow, rows: ScopeRow[], source: string): string {
	// The context-row rule, at the one place this document could break it: an ancestor is
	// drawn on screen to keep a member in its place and is not IN the release, so it is
	// neither listed nor counted here.
	const members = rows.filter((row) => !row.context);
	const lines = [
		readmeMarker(source),
		'',
		`# ${release.name}`,
		'',
		t('release.notes.generated'),
		'',
		t('release.notes.population'),
		'',
	];
	if (members.length === 0) return [...lines, t('release.notes.empty'), ''].join('\n');
	for (const [heading, group] of groupByType(members)) {
		lines.push(`## ${heading}`, '');
		for (const row of group) lines.push(`- ${row.item.title}`);
		lines.push('');
	}
	return lines.join('\n');
}

/**
 * Members by type, in `ALL_TYPES` order, each group keeping the sequence the tree drew.
 *
 * The `Other` group is not defensive, and what reaches it is narrower than it looks: a
 * type NAME the vocabulary does not know never gets this far, because `buildModel` drops
 * such a note before it can be a member. What does reach it is a note with NO `type` that
 * something parents to — kept for the hierarchy, `typeName` null, belonging to no group.
 * It is grouped rather than dropped because a note that quietly omits work is worse than
 * an untidy heading.
 */
function groupByType(members: ScopeRow[]): [string, ScopeRow[]][] {
	const known = ALL_TYPES.filter((type) => members.some((row) => sameValue(row.item.typeName, type)));
	const others = members.filter((row) => !ALL_TYPES.some((type) => sameValue(row.item.typeName, type)));
	const groups: [string, ScopeRow[]][] = known.map((type) => [
		type,
		members.filter((row) => sameValue(row.item.typeName, type)),
	]);
	return others.length > 0 ? [...groups, [t('release.notes.otherTypes'), others]] : groups;
}
