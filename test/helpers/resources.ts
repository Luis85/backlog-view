/**
 * The resources axis's shared vault fixture.
 *
 * Its own file rather than a function in `./roadmap.ts`, and the reason is mechanical:
 * that module imports the view harness, which touches `HTMLElement` at import time, so a
 * NODE suite importing anything from it fails to load. `test/domain/resources.test.ts`
 * and `test/view/resourceLanes.test.ts` both need this vault and must describe the same
 * one — a fixture copied into each is two fixtures free to drift while both claim to be
 * checking one axis.
 */
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
