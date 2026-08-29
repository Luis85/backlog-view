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
 * items on one resource, one on a resource with no date to place it at, one assigned to
 * nobody, and one nobody is assigned to at all.
 *
 * `Alice.md`, `Bob.md` and `Zoe.md` are `Resource` notes — every row is one now (Task 5),
 * so every row a write in this fixture aims at needs a note behind it. `Cased.md`'s
 * `[[Alice]]` is a bracketed link in the note's own exact casing rather than a bare,
 * differently-cased string: matching moved from a case-insensitive NAME comparison to the
 * resolved FILE (Task 5), so there is no longer a middle answer for a spelling that
 * resolves to nothing to demonstrate here — `resourceRoster.test.ts` covers that shape at
 * the domain level instead, where `FakeVault`'s own case-sensitive link resolution (a
 * known fidelity gap against Obsidian's, `test/helpers/vault.ts`) cannot quietly stand in
 * for a resolution question this file is not asking.
 */
export function resourceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Bob.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Zoe.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Alice dated.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Cased.md', {
		frontmatter: { type: 'Epic', order: 20, assignee: '[[Alice]]', start: '2026-08-05', due: '2026-08-06' },
	});
	vault.addFile('Stray.md', {
		frontmatter: { type: 'Epic', order: 30, assignee: 'Zoe', start: '2026-08-02', due: '2026-08-03' },
	});
	vault.addFile('Nobody.md', { frontmatter: { type: 'Epic', order: 40, start: '2026-08-01', due: '2026-08-02' } });
	vault.addFile('Undated.md', { frontmatter: { type: 'Epic', order: 50, assignee: 'Alice' } });
	return vault;
}

/**
 * Two resources — one with one dated bar, one with nothing at all — plus whichever
 * stretches the caller wants counted.
 *
 * Here rather than in a suite for this file's own stated reason: `resourceLanes.test.ts`
 * counts absences against it and `milestonesRow.test.ts` draws diamonds over it, and two
 * copies of one vault are two vaults free to drift while both claim to describe the axis.
 * `Bob.md` is a `Resource` note with no work at all — every caller that reads a SECOND,
 * empty row off this vault (the readout tests' own "quiet row") needs one behind it now
 * that a row is a note (Task 5) rather than a name a work item happened to carry.
 */
export function countingVault(stretches: Array<{ title: string; start: string; target: string }> = []): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Bob.md', { frontmatter: { type: 'Resource' } });
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
 *
 * `Alice.md` and `Bob.md` are `Resource` notes: a row is one now (Task 5), so the stretch
 * below needs one behind it to draw in at all, and the absence-editing flows this vault
 * also serves need a SECOND row to open their form from without touching Alice's own.
 */
export function absenceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Bob.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile(ALICE_AWAY_PATH, {
		frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
	});
	return vault;
}
