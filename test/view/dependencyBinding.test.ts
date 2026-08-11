// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { FuzzySuggestModal, Menu, Modal, Notice } from '../helpers/obsidian-mock';
import { flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

/**
 * The half of `Bind a property by using it` that touches the `.base`: making a link with
 * the dependency property unnamed binds it, and every configuration in which that must
 * NOT happen.
 *
 * Its own file rather than a fifth describe in `dependencyMenu.test.ts`, whose subject is
 * what the two entries offer and write. The subject here is the option — which key ends
 * up in the view config, and what stops one arriving — so the assertions are about
 * `config.setCalls` and the notice, not about frontmatter. `linkDrag.test.ts` covers the
 * same rule from the connector's end.
 */

useViewHarness();

/** Two siblings under an epic, so there is always something legal to depend on. */
function vault(): FakeVault {
	const v = new FakeVault();
	v.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	for (const [index, title] of ['A', 'B'].entries()) {
		v.addFile(`${title}.md`, { frontmatter: { type: 'PBI', order: (index + 1) * 10 }, parentLink: 'Epic' });
	}
	return v;
}

function openMenu(containerEl: HTMLElement, title: string): Menu {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error('no menu opened');
	return menu;
}

function suggester(): FuzzySuggestModal<unknown> {
	const modal = Modal.lastOpened;
	if (!(modal instanceof FuzzySuggestModal)) throw new Error('no suggester opened');
	return modal as FuzzySuggestModal<unknown>;
}

/** The option writes this landed on the `.base`, which is what "bound" means here. */
const boundKeys = (setCalls: { key: string; value: unknown }[]): { key: string; value: unknown }[] =>
	setCalls.filter((call) => call.key.endsWith('Property'));

describe('binding the dependency property by writing one', () => {
	it('binds the suggested key and writes the link, in one action', async () => {
		const v = vault();
		const { containerEl, config } = makeView(v);

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		suggester().choose('A A.md');
		await flush();

		// The option, so the picker in the view settings now shows the property...
		expect(boundKeys(config.setCalls)).toEqual([{ key: 'dependsOnProperty', value: 'note.dependsOn' }]);
		// ...and the note, so the property exists in the vault for that picker to offer.
		// Neither half works alone, which is why one action does both.
		expect(v.fm('B.md')['dependsOn']).toEqual(['[[A]]']);
	});

	it('says what it set up, after the fact', async () => {
		const { containerEl } = makeView(vault());

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		suggester().choose('A A.md');
		await flush();

		expect(Notice.messages).toContain('Product Backlog: set up dependsOn to hold dependencies.');
	});

	it('binds once — a second link writes no option at all', async () => {
		const v = vault();
		const { containerEl, config } = makeView(v);

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		suggester().choose('A A.md');
		await flush();
		const afterFirst = config.setCalls.length;

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		suggester().choose('Epic Epic.md');
		await flush();

		expect(boundKeys(config.setCalls.slice(afterFirst))).toEqual([]);
		expect(v.fm('B.md')['dependsOn']).toEqual(['[[A]]', '[[Epic]]']);
	});

	it('leaves an already-named property exactly as the user set it', async () => {
		const v = vault();
		const { containerEl, config } = makeView(v, { dependsOnProperty: 'note.blockedBy' });

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		suggester().choose('A A.md');
		await flush();

		expect(boundKeys(config.setCalls)).toEqual([]);
		expect(v.fm('B.md')['blockedBy']).toEqual(['[[A]]']);
		expect(v.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('changes nothing while the view options collide', async () => {
		// The write would be refused by the gate anyway. What is asserted is that the
		// refusal costs no configuration change: an action that bound a property and then
		// had every write refused would leave the view worse than it found it, which is
		// `runInit`'s own rule applied to the one-property path.
		const v = vault();
		const { containerEl, config } = makeView(v, { orderProperty: 'note.parent' });

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		suggester().choose('A A.md');
		await flush();

		expect(boundKeys(config.setCalls)).toEqual([]);
		expect(v.fm('B.md')['dependsOn']).toBeUndefined();
		expect(Notice.messages.some((message) => message.startsWith('Fix the view options first:'))).toBe(true);
	});

	it('refuses a pick that closes a loop the unbound key was hiding', async () => {
		// The case the suggested key is CHOSEN for: `dependsOn` is the Tasks plugin's own
		// name, so a vault that already uses it is exactly the vault this feature meets
		// unbound. With no key the model reads no edges at all, so `candidates` offered A
		// as a prerequisite for B while A's own frontmatter already waits for B. Binding
		// makes those edges visible — which is a change to the graph the pick was planned
		// against, and the legality has to be re-asked of it.
		const v = vault();
		v.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'B' } });
		const { containerEl, config } = makeView(v);

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		expect(suggester().offered()).toContain('A A.md');
		suggester().choose('A A.md');
		await flush();

		expect(v.fm('B.md')['dependsOn']).toBeUndefined();
		expect(Notice.messages).toContain(
			'Those two already depend on each other in the property just set up, so nothing was written.',
		);
		// The binding stays: it is a valid configuration, and it is what made the conflict
		// visible in the first place.
		expect(boundKeys(config.setCalls)).toEqual([{ key: 'dependsOnProperty', value: 'note.dependsOn' }]);
	});

	it('refuses when another property took the key while the picker was open', async () => {
		// `adoptableProperties` asks the CONFIG whether an option is set and the SETTINGS
		// which keys are taken. `host.settings` is a snapshot from the last refresh, so
		// with the two disagreeing the new owner is skipped without its key joining
		// `taken` — and `dependsOnProperty` is bound onto a key another property owns,
		// which is the collision that blocks every write in the view. Both halves are read
		// from the live config now.
		const v = vault();
		const { containerEl, config } = makeView(v);

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		config.values['riskProperty'] = 'note.dependsOn';
		suggester().choose('A A.md');
		await flush();

		expect(boundKeys(config.setCalls)).toEqual([]);
		expect(v.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('refuses when the option is cleared while the picker is open, and writes nothing', async () => {
		// `dependenciesAvailable` was true when the menu was built, so the entry was
		// legitimately offered; an edit to the `.base` since is what ends that. The same
		// staleness every other pick in this feature re-asks for rather than assumes away
		// — and without the guard the binding would read an empty adoption and throw.
		const v = vault();
		const { containerEl, config } = makeView(v);

		openMenu(containerEl, 'B').item('Depends on…')?.click();
		config.values['dependsOnProperty'] = '';
		suggester().choose('A A.md');
		await flush();

		expect(boundKeys(config.setCalls)).toEqual([]);
		expect(v.fm('B.md')['dependsOn']).toBeUndefined();
		expect(Notice.messages).toContain(
			'The dependency property changed while the picker was open, so nothing was written.',
		);
	});
});
