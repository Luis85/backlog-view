// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
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

	it('refuses a row the live note has already moved past, before opening anything', () => {
		// Obsidian's metadata cache advances BEFORE Bases hands this view fresh results, so
		// the screen can still show `In progress` while the note already says otherwise.
		// The raw value captured at the press would then be the EDIT, handed to the write
		// as the value it expects to find — blessing the change rather than catching it,
		// which the compare-and-swap can never see because it happened before the dialog.
		const { view, vault } = releaseScreen({ status: 'In progress' });
		const cache = vault.caches.get('0.9.md');
		if (cache === undefined) throw new Error('no cache for 0.9.md');
		cache.frontmatter = { ...cache.frontmatter, status: 'Released' };

		button(view, '.pbl-rel-close').click();

		expect(Modal.lastOpened).toBeNull();
		expect(vault.fm('0.9.md')['released']).toBeUndefined();
	});

	it('hands focus back to the control that opened the confirmation', () => {
		// Obsidian removes the modal and focus falls to the body. The focus-handle list
		// cannot help: the redraw a confirmation triggers runs AFTER the modal is gone, so
		// it would capture the body. Refocusing on the way out is what puts the button back
		// under `document.activeElement` in time for that redraw to find it.
		const { view } = releaseScreen({ status: 'In progress' });
		const btn = button(view, '.pbl-rel-close');
		btn.focus();
		btn.click();
		// BLUR, not `document.body.focus()`: the body is not focusable without a tabindex,
		// so focusing it leaves `activeElement` on the button and this test passes without
		// the fix. Watched doing exactly that before it was written this way.
		btn.blur();

		Modal.lastOpened?.close();

		expect(document.activeElement).toBe(btn);
	});

	it('hands focus to the LIVE control when a refresh redrew the screen mid-dialog', () => {
		// A Bases metadata refresh redraws the scope while the confirmation is open, which
		// DETACHES the button that opened it. Focusing the element captured at the press is
		// then a no-op and the reader is left on the body — the same place the fix above
		// exists to keep them off (found by review, Codex, PR #219).
		const { view } = releaseScreen({ status: 'In progress' });
		const opener = button(view, '.pbl-rel-close');
		opener.focus();
		opener.click();
		// Focus moves INTO the modal, which is what makes the redraw below lose it: the
		// focus-handle list captures `document.activeElement`, and with the opener still
		// focused it would restore the new button by itself and this test would pass
		// without the fix. Watched doing exactly that.
		opener.blur();
		view.onDataUpdated();
		const live = button(view, '.pbl-rel-close');
		expect(live).not.toBe(opener);

		Modal.lastOpened?.close();

		expect(document.activeElement).toBe(live);
	});

	it('falls back to the one control the screen always has when the close control goes', () => {
		// A refresh mid-dialog can take the button away entirely rather than replace it —
		// the release is out now, a date arrived, or it left the base's results. An
		// optional query then focuses nothing and the reader is on the body again, which
		// is the third shape of this one bug (found by review, Codex, PR #219). The back
		// control is the terminus: `drawHeader` draws it above BOTH empty-state returns,
		// for the reason it exists at all — a release nobody can read must not be a dead
		// end — so there is always something to land on.
		const { view, vault } = releaseScreen({ status: 'In progress' });
		const opener = button(view, '.pbl-rel-close');
		opener.focus();
		opener.click();
		opener.blur();

		vault.fm('0.9.md')['status'] = 'Released';
		const cache = vault.caches.get('0.9.md');
		if (cache === undefined) throw new Error('no cache for 0.9.md');
		cache.frontmatter = { ...cache.frontmatter, status: 'Released' };
		view.onDataUpdated();
		expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();

		Modal.lastOpened?.close();

		expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-rel-back'));
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

	// BOTH controls, in one parameterised case: registering one and forgetting the other
	// is what the focus-handle list exists to prevent, and a test per button is how the
	// second one gets forgotten.
	it.each(['.pbl-rel-close', '.pbl-rel-notes'])('keeps focus on %s across a metadata refresh', (selector) => {
		const { view } = releaseScreen({ status: 'In progress' }, scopeVault(), { releaseNotesFolder: 'notes' });
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

describe('the actions live in the header', () => {
	it('draws them inside the header block, not between it and the toolbar', () => {
		// The division is the codebase's own, stated at `drawOpenNote`: the toolbar's
		// controls are about the TREE, and these two are about the release the title names.
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-header .pbl-rel-scope-actions')).not.toBeNull();
	});

	it('puts the summary and the actions on one line', () => {
		// `scopeVault()` links its members to a DIFFERENT release ('R'), which leaves this
		// release with none and `drawSummary` withholds the strip entirely (extension 1a) —
		// so this needs a vault whose members actually name '0.9', the same fixture
		// `twoWorkflowVault` already supplies for the closing tests above.
		const { view } = releaseScreen({ status: 'In progress' }, twoWorkflowVault());
		const foot = view.viewEl.querySelector('.pbl-rel-footline');
		expect(foot?.querySelector('.pbl-rel-summary')).not.toBeNull();
		expect(foot?.querySelector('.pbl-rel-scope-actions')).not.toBeNull();
	});

	it('still draws them on a release with no members', () => {
		// The empty-scope screen is the one place extension 1a can be exercised at all.
		// Drawn inside the header this holds structurally rather than by a comment nobody
		// must break — and this test is what says so.
		const { view } = releaseScreen({ status: 'In progress' }, emptyReleaseVault());
		expect(view.viewEl.querySelector('.pbl-rel-scope-actions')).not.toBeNull();
	});
});

describe('a refusal is not a caption on the button beside it', () => {
	// **Narrower than the claim, and the narrow sentence is the honest one** —
	// `rowChrome.test.ts`'s own shape and reason. jsdom computes no layout, so what is
	// checked is that `styles/releaseScope.css` still declares the full-width line. It
	// would not notice a different rule overriding it.
	const css = readFileSync('styles/releaseScope.css', 'utf8');

	it('gives the note a line of its own inside the action area', () => {
		// Before this, the area was a plain horizontal row and a refusal replaced its own
		// button IN PLACE — so `[Mark as released]  To generate release notes, bind the
		// release membership property.` put a sentence about generation immediately right
		// of the marking button. Both sentences name their own action; the layout invited
		// the wrong reading anyway.
		const block = css.match(/\.pbl-rel-actions-note\s*\{[^}]*\}/);
		expect(block, 'no rule for the actions note').not.toBeNull();
		expect(block?.[0]).toContain('flex: 1 0 100%');
	});

	// Two findings carried from Task 5's review, landing in the same compound rule. jsdom
	// asserts neither claim directly — one is about the CASCADE (a declaration this rule
	// must supply itself rather than borrow) and the other about wrapping (seen only in the
	// browser harness, at a narrow window, with `?pick=Releases/1.1.md`: the area's own
	// `flex: 0 0 auto` sized it to the unwrapped note's max-content width and the line ran
	// past the pane) — so both are pinned as a declaration the partial must keep making.
	const areaBlock = css.match(/\.pbl-rel-actions\.pbl-rel-scope-actions\s*\{[^}]*\}/);

	it('supplies its own display: flex rather than borrowing release.css’s bare .pbl-rel-actions', () => {
		// `flex-wrap`, `justify-content` and `gap` on this rule are inert without a `display:
		// flex` of its own — the compound rule laid out only because the bare `.pbl-rel-actions`
		// in `styles/release.css` supplied it, which contradicts `releaseClose.ts`'s own
		// docblock: `.pbl-rel-scope-actions` is documented as "this area's LAYOUT alone".
		expect(areaBlock, 'no rule for the compound actions/scope-actions selector').not.toBeNull();
		expect(areaBlock?.[0]).toContain('display: flex');
	});

	it('lets the action area shrink, so a full-width note can wrap instead of overflowing the pane', () => {
		// `flex: 0 0 auto` refused to shrink, so the area sized itself to the NOTE's own
		// max-content width (the note's `flex: 1 0 100%` resolves against the area's own
		// box) — at a narrow window the sentence ran off the edge of the pane rather than
		// wrapping. Seen in the browser harness at 400px and 320px on `?pick=Releases/1.1.md`
		// and `?pick=Releases/0.8.md&config=nomembership`; confirmed fixed at both widths
		// once the area could shrink. `min-inline-size: 0` is what lets it shrink past its
		// content's own min-content width, which a flex item refuses by default.
		expect(areaBlock?.[0]).toContain('flex: 1 1 auto');
		expect(areaBlock?.[0]).toContain('min-inline-size: 0');
	});
});
