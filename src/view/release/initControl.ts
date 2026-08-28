import { Notice, setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { adoptCandidates } from '../../domain/optionalProperties';
import { declaredPropertyKeys } from '../../domain/releaseOptions';
import { bindAndReport } from './newRelease';
import { RELEASE_SUGGESTED_KEYS } from './init';

/**
 * The release view's ✨, in two positions that answer the same question differently.
 *
 * **On the BAR it is always drawn.** `render/toolbar.ts` and `estimation/toolbar.ts` both
 * draw theirs unconditionally, and a toolbar control that came and went as the
 * configuration changed would be worse than one that no-ops — so a press with nothing to
 * bind says so instead of looking dead.
 *
 * **On an EMPTY STATE it is withheld** when nothing `fixes` names is adoptable —
 * `renderSetupCta`'s own rule in `render/emptyStates.ts`, narrowed the same way that one's
 * own `fixes: OptionalField[]` narrows it: an option somebody CLEARED is a decision this
 * must not overrule, and — the sharper reason a first draft here missed — a DIFFERENT
 * option merely being adoptable is not a reason to draw this frame's button either. The
 * `noMembership` state names ONE option; if `versionProperty` alone were untouched, the
 * wider question would report true, the press would bind it, and the reader would be told
 * something changed while looking at the exact empty state that told them to fix
 * membership. `fixes` is what keeps the button's promise honest: drawn only when pressing
 * it would touch the option the guidance beside it names.
 *
 * It writes no note in either position — `bindAndReport` reaches `runReleaseInit`, which
 * touches the `.base` and nothing else (`test/view/releaseNeverEdits.test.ts`).
 */
export function renderReleaseInit(
	view: ReleaseView,
	parentEl: HTMLElement,
	position: 'bar' | 'empty',
	fixes: string[] = [],
): void {
	if (position === 'empty' && !anythingToBind(view, fixes)) return;
	const btn = parentEl.createEl('button', {
		cls: position === 'bar' ? 'clickable-icon pbl-rel-init' : 'pbl-rel-init mod-cta',
		attr: { type: 'button', 'aria-label': t('release.init.label') },
	});
	setIcon(position === 'bar' ? btn : btn.createSpan({ cls: 'pbl-btn-icon' }), 'sparkles');
	if (position === 'empty') btn.createSpan({ text: t('release.init.label') });
	setTooltip(btn, t('release.init.label'));
	btn.addEventListener('click', () => {
		void bindAndReport(view).then((bound) => {
			new Notice(bound ? t('release.new.bound') : t('release.init.nothing'));
			view.render();
		});
	});
}

/**
 * Whether a press could bind something `fixes` names — asked of the LIVE config through
 * the same `adoptCandidates` the action itself uses, never of `view.settings`, which is a
 * snapshot from the last data update (the trap `init.ts` already documents), and narrowed
 * to `fixes` BEFORE asking, not after: `adoptCandidates` mutates its `taken` set as it
 * finds each candidate free, and this view's action still binds every one of the four
 * when pressed — only the frame's OFFER is narrower than what the press behind it does.
 */
function anythingToBind(view: ReleaseView, fixes: string[]): boolean {
	const taken = new Set(declaredPropertyKeys(view.config).filter((key) => key !== ''));
	const candidates = RELEASE_SUGGESTED_KEYS.filter((candidate) => fixes.includes(candidate.option));
	return adoptCandidates(view.config, candidates, taken).length > 0;
}
