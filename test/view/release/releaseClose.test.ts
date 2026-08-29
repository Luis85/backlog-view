// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Modal } from '../../helpers/obsidian-mock';
import {
	button,
	confirmDialog,
	emptyReleaseVault,
	releaseScreen,
	scopeVault,
	twoWorkflowVault,
} from '../../helpers/release';
import { resolveReleaseSettings } from '../../../src/domain/releaseOptions';
import { todayStamp } from '../../../src/domain/noteFields';
import { en } from '../../../src/i18n/en';

beforeEach(() => {
	document.body.empty();
	Modal.lastOpened = null;
});

/** Every row the confirmation offers to open, in the order it lists them. */
const listed = (): (string | null)[] =>
	[...(Modal.lastOpened?.contentEl.querySelectorAll('.pbl-confirm-link') ?? [])].map((el) => el.textContent);

describe('marking a release as released', () => {
	it('writes the status and the date in one batch', async () => {
		const { view, vault } = releaseScreen({ status: 'In progress' });
		button(view, '.pbl-rel-close').click();
		await confirmDialog();

		expect(vault.fm('0.9.md')['status']).toBe('Released');
		expect(vault.fm('0.9.md')['released']).toBe(todayStamp());
	});

	it('lists the members that are not finished, and no others', () => {
		// Two questions of the scope rows, not one: `context` false is the POPULATION, and
		// being done is a second question — asked of `ownWorkflowReading`, so a Deliverable
		// finished by its OWN workflow counts as finished. The two overrides are what bind
		// that second workflow; without them both members read unconfigured and the list
		// would be empty for a reason this test is not about.
		const { view } = releaseScreen({ status: 'In progress' }, twoWorkflowVault(), {
			deliverableStateProperty: 'note.docStatus',
			deliverableDoneValues: 'Published',
		});
		button(view, '.pbl-rel-close').click();
		expect(listed()).toEqual(['Unfinished PBI']);
	});

	it('opens a listed member without deciding anything', async () => {
		const { view, vault } = releaseScreen({ status: 'In progress' }, twoWorkflowVault(), {
			deliverableStateProperty: 'note.docStatus',
			deliverableDoneValues: 'Published',
		});
		button(view, '.pbl-rel-close').click();
		Modal.lastOpened?.contentEl.querySelector<HTMLElement>('.pbl-confirm-link')?.click();

		expect(vault.opened.map((o) => o.path)).toEqual(['Unfinished PBI.md']);
		// Navigation, not an answer: nothing is written and the dialog is still up.
		expect(vault.fm('0.9.md')['status']).toBe('In progress');
	});

	it('says progress cannot be read rather than listing nothing', () => {
		// `done` unconfigured is not "everything is finished": with no state key the
		// members cannot be counted at all, and an empty list would claim they were.
		const { view } = releaseScreen({ status: 'In progress' }, twoWorkflowVault(), { stateProperty: '' });
		button(view, '.pbl-rel-close').click();
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-confirm-message')?.textContent).toBe(
			en['release.close.progressUnreadable'],
		);
		expect(listed()).toEqual([]);
	});

	it('is offered on a release with no members at all', () => {
		// `renderScope` returns before the toolbar on this screen — the actions must be
		// above that return, or the one case extension 1a is about is unreachable.
		const { view } = releaseScreen({ status: 'In progress' }, emptyReleaseVault());
		expect(view.viewEl.querySelector('.pbl-rel-close')).not.toBeNull();
	});

	it('withholds it on a release that is already out', () => {
		const { view } = releaseScreen({ status: 'Released' });
		expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();
	});

	it('names the option to bind rather than only withholding the button', () => {
		const { view } = releaseScreen({ status: 'In progress' }, scopeVault(), { releasedStatusValues: '' });
		expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();
		expect(view.viewEl.textContent).toContain(en['release.option.releasedValues']);
	});

	it('says which field cannot be read rather than naming an option', () => {
		// A NOTE problem, not a configuration one: every option is bound, and the answer
		// the reader needs is about the note in front of them.
		const { view } = releaseScreen({ status: { a: 1 } });
		expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();
		expect(view.viewEl.textContent).toContain(en['release.close.unreadableStatus']);
	});

	it('refuses when the transition value changed to ANOTHER valid one mid-dialog', async () => {
		// The case a re-asked `closeOffer` cannot catch: the configuration is still
		// perfectly valid, just not the one the reader agreed to.
		const { view, vault } = releaseScreen({ status: 'In progress' }, scopeVault(), {
			releasedStatusValues: 'Released, Archived',
			releasedTransitionValue: 'Released',
		});
		button(view, '.pbl-rel-close').click();
		view.config.set('releasedTransitionValue', 'Archived');
		view.settings = resolveReleaseSettings(view.config as never);
		await confirmDialog();
		expect(vault.fm('0.9.md')['status']).toBe('In progress');
	});

	it('writes to the key it confirmed against, never one remapped mid-dialog', async () => {
		// The KEY moves across this await as well as the value, and this case slips past
		// every guard that reads the live settings: remapped from one EMPTY property to
		// another, `closeOffer` stays valid, the row is unchanged, and `reconfiguredKey`
		// compares the planned key against the NEW role key and agrees with it. Planning
		// against the CAPTURED settings is what turns that check back into a refusal.
		const { view, vault } = releaseScreen({ status: 'In progress' });
		button(view, '.pbl-rel-close').click();
		view.config.set('releasedDateProperty', 'note.shipped'); // also empty on this note
		view.settings = resolveReleaseSettings(view.config as never);
		await confirmDialog();
		// Neither key is written: the batch named `released`, and `reconfiguredKey` refuses
		// it because that is no longer the released-date role's key.
		expect(vault.fm('0.9.md')['shipped']).toBeUndefined();
		expect(vault.fm('0.9.md')['released']).toBeUndefined();
		expect(vault.fm('0.9.md')['status']).toBe('In progress');
	});

	// Task 12 adds `.pbl-rel-notes` to this array with the button that carries it. The
	// class is already registered beside this one, because the focus list is one
	// vocabulary rather than a per-button registration.
	it.each(['.pbl-rel-close'])('keeps focus on %s across a metadata refresh', (selector) => {
		const { view } = releaseScreen({ status: 'In progress' });
		button(view, selector).focus();
		view.onDataUpdated();
		expect(document.activeElement).toBe(view.viewEl.querySelector(selector));
	});

	it('is disabled while a SIBLING view holds the write lock', () => {
		// A sibling's batch, not this view's: this view's own batch is the case that
		// already worked, and would pass against a guard that only checks local progress.
		const { view, lock } = releaseScreen({ status: 'In progress' });
		lock.applying = true;
		view.render();
		expect(button(view, '.pbl-rel-close').hasAttribute('disabled')).toBe(true);
	});

	it('cancels without writing anything', async () => {
		const { view, vault } = releaseScreen({ status: 'In progress' });
		button(view, '.pbl-rel-close').click();
		Modal.lastOpened?.close();
		expect(vault.fm('0.9.md')['status']).toBe('In progress');
		expect(vault.fm('0.9.md')['released']).toBeUndefined();
	});
});
