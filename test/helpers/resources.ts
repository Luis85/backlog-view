/**
 * The resources axis's shared vault fixture.
 *
 * Its own file rather than a function in `./roadmap.ts`, and the reason is mechanical:
 * that module imports the view harness, which touches `HTMLElement` at import time, so a
 * NODE suite importing anything from it fails to load. `test/domain/resources.test.ts`
 * and `test/view/resourceLanes.test.ts` both need this vault and must describe the same
 * one — a fixture copied into each is two fixtures free to drift while both claim to be
 * checking one axis. `absenceVault` joined it for that reason and not a new one: three
 * suites had asked for the same two notes, two of them holding their own copy.
 */
import { absenceTitle } from '../../src/domain/absences';
import { FakeVault } from './vault';

/**
 * A team's worth of dated work, holding one of every case the axis has to answer for: two
 * items for one declared resource (the second spelling her name in another casing), one
 * for a resource nobody declared, one nobody is on at all, and one assigned but never
 * dated.
 */
export function resourceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alice dated.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Cased.md', {
		frontmatter: { type: 'Epic', order: 20, assignee: 'alice', start: '2026-08-05', due: '2026-08-06' },
	});
	vault.addFile('Stray.md', {
		frontmatter: { type: 'Epic', order: 30, assignee: 'Zoe', start: '2026-08-02', due: '2026-08-03' },
	});
	vault.addFile('Nobody.md', { frontmatter: { type: 'Epic', order: 40, start: '2026-08-01', due: '2026-08-02' } });
	vault.addFile('Undated.md', { frontmatter: { type: 'Epic', order: 50, assignee: 'Alice' } });
	return vault;
}

/**
 * One resource with one dated bar, plus whichever stretches the caller wants counted.
 *
 * Here rather than in a suite for this file's own stated reason: `resourceLanes.test.ts`
 * counts absences against it and `milestonesRow.test.ts` draws diamonds over it, and two
 * copies of one vault are two vaults free to drift while both claim to describe the axis.
 */
export function countingVault(stretches: Array<{ title: string; start: string; target: string }> = []): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	for (const one of stretches) {
		vault.addFile(`${one.title}.md`, {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: one.start, due: one.target },
		});
	}
	return vault;
}

/** The one absence in `absenceVault`, at the path the create path would actually file it under. */
export const ALICE_AWAY = absenceTitle({ resource: 'Alice', start: '2026-08-04', target: '2026-08-06' });
export const ALICE_AWAY_PATH = `${ALICE_AWAY}.md`;

/**
 * One epic, and one absence written the way the prompt writes them — the smallest vault in
 * which a stretch and the work it crosses are both on screen: `Work` runs 2026-08-01 →
 * 2026-08-10 and Alice's stretch sits inside it, 08-04 → 08-06.
 *
 * **The note's NAME comes from `absenceTitle`, the same producer the create path uses**, and
 * that is load-bearing rather than tidiness. It was `Alice away.md` — a name no flow in this
 * plugin has produced since the title became derived (4l) — and every accessibility string a
 * stretch has was therefore asserted against a title that carries no dates, which is exactly
 * why nothing here could see the header, the tooltip and the crossing sentence stating the
 * range twice. A fixture that is not what the code writes checks the wrong vault.
 *
 * Derived here rather than typed out, so the fixture cannot drift from the producer either.
 * The HAND-named case still has fixtures of its own — `test/view/absenceCollision.test.ts`
 * and `test/view/legend.test.ts` plant their own `Alice away.md`, and `demoVault()` uses
 * prose — which is what keeps both branches of `absenceSaid` on screen.
 */
export function absenceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile(ALICE_AWAY_PATH, {
		frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
	});
	return vault;
}
