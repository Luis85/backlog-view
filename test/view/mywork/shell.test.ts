// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MyWorkView } from '../../../src/view/mywork/myWorkView';
import { WriteLock } from '../../../src/view/writeLock';
import { makeMyWorkView, myWorkVault } from '../../helpers/mywork';
import { t } from '../../../src/i18n/t';

describe('the my-work view', () => {
	it('shows the shared loading state before the first data update', () => {
		const containerEl = document.createElement('div');
		const view = new MyWorkView({} as never, containerEl, new WriteLock());

		expect(view.viewEl.querySelector('.pbl-loading')).not.toBeNull();
	});

	it('says the assignee property is unbound rather than drawing an empty pane', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault(), { assigneeProperty: '' });
		expect(view.viewEl.querySelector('.pbl-empty-title')).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-tree')).toBeNull();
	});

	it('says the base returns no people when the roster is empty', () => {
		const vault = myWorkVault({ resources: false });
		const { view }: { view: MyWorkView } = makeMyWorkView(vault);
		expect(view.viewEl.querySelector('.pbl-empty-title')).not.toBeNull();
	});

	it('asks for a person when nothing is picked', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault());
		expect(view.pickedPerson).toBeNull();
		expect(view.viewEl.querySelector('.pbl-empty')).not.toBeNull();
	});

	it('remembers the pick across a remount of the same base', () => {
		const vault = myWorkVault();
		makeMyWorkView(vault).view.pick('People/Ada.md');
		expect(makeMyWorkView(vault).view.pickedPerson).toBe('People/Ada.md');
	});

	it('keeps the pick when there is no view identity, instead of resetting it', () => {
		// An embedded base: `resolveViewIdentity` returns null on purpose, so the pick is
		// session-only. Assigning null in that branch would reset it on every data update.
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault(), {}, { embedded: true });
		view.pick('People/Ada.md');
		view.onDataUpdated();
		expect(view.pickedPerson).toBe('People/Ada.md');
	});

	it('offers a press for a roster of one, and picks that person with it', () => {
		const vault = myWorkVault();
		// The fixture ships two people; a roster of ONE is what this press is for.
		vault.files.delete('People/Bo.md');
		vault.frontmatter.delete('People/Bo.md');
		const { view } = makeMyWorkView(vault);

		const btn = view.viewEl.querySelector<HTMLElement>('.pbl-mw-solo');
		expect(btn?.textContent).toBe(t('mywork.empty.noPick.cta', { name: 'Ada' }));

		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.pickedPerson).toBe('People/Ada.md');
	});

	it('draws no such press when the roster holds more than one person', () => {
		const { view } = makeMyWorkView(myWorkVault());

		expect(view.viewEl.querySelector('.pbl-mw-solo')).toBeNull();
	});
});

describe('focus across a redraw (PR #234 correction 1)', () => {
	it('restores focus to the tree control after a redraw, instead of dropping it on the body', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const tree = view.viewEl.querySelector<HTMLElement>('.pbl-mw-tree');
		expect(tree).not.toBeNull();
		tree?.focus();
		expect(document.activeElement).toBe(tree);

		// An ordinary redraw of the SAME screen — a Bases metadata refresh, not a pick.
		view.onDataUpdated();

		expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-mw-tree'));
	});
});

describe('the tree carries the shared .pbl-tree class (fix round 1)', () => {
	it('draws .pbl-tree once a person is picked, and never before', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault());
		// Nobody picked yet: the earlier `.pbl-tree` assertion above is only honest if a
		// drawn tree really would carry this class — proven by the positive case below.
		expect(view.viewEl.querySelector('.pbl-tree')).toBeNull();

		view.pick('People/Ada.md');

		expect(view.viewEl.querySelector('.pbl-tree')).not.toBeNull();
	});
});

describe('a stale model after the assignee property is unbound (PR #234 correction 2)', () => {
	it('refuses a write planned before the property was cleared', async () => {
		const vault = myWorkVault();
		const { view, config } = makeMyWorkView(vault, { assigneeProperty: 'note.assignee' });
		// Captured while the property was still bound — the row a menu would have opened.
		const target = view.model!.byPath.get('PBI Ada.md')!.file;

		config.values.assigneeProperty = '';
		view.onDataUpdated();

		const before = vault.writeLog.length;
		await view.gate.applySafely([{ file: target, state: 'Done' }]);

		// The behavioural claim first, so a broken fix fails HERE rather than at the
		// mechanism assertion below (fix round 1, PR #234 finding 4: watching the wrong
		// half fail never actually observed the refusal fail).
		expect(vault.writeLog.length).toBe(before);
		// `state` maps through the default `stateKey` suggestion, `status`
		// (`optionalProperty('state').suggested`) — never the raw `state` field name a
		// write's own shape happens to share (finding 3: the prior key asserted an absence
		// that would have held even if the write had landed).
		expect(vault.fm(target.path).status).toBeUndefined();
		// The mechanism behind the refusal, corroborating rather than gating the claim above.
		expect(view.model).toBeNull();
	});
});
