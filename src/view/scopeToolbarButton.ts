import { setIcon, setTooltip } from 'obsidian';

/**
 * One `clickable-icon` toolbar button — `aria-label` and a matching tooltip from the same
 * `label`, an icon from `setIcon`, and a click handler. Extracted out of
 * `view/release/scopeToolbar.ts` and `view/mywork/toolbar.ts` (fix round 1 on Task 8 of
 * [[Assigned work in the sidebar]]): both toolbars drew this exact eight-line shape with
 * no per-view logic in it at all — not two views converging on the same PATTERN the way
 * `renderTree.ts`/`scopeTree.ts` and `myWorkView.ts`/`releaseView.ts` do (same name, same
 * shape, different bodies per view), but one context-free helper copied verbatim. Lives
 * directly under `view/` rather than in either scope's own directory, `scopeFolds.ts`'s
 * and `scopeKeys.ts`'s own reason: two unrelated screens under `view/release/` and
 * `view/mywork/` both need it, and neither may import the other's directory.
 *
 * Named apart from `render/toolbarControls.ts`'s own `iconButton` — a different shape
 * entirely (it also stamps `KEY_ATTR` for that toolbar's own keyed focus-restore
 * mechanism, which neither scope toolbar uses) — so the two never collide as a fallow
 * duplicate export.
 */
export function scopeIconButton(barEl: HTMLElement, icon: string, label: string, cls: string, run: () => void): void {
	const btn = barEl.createEl('button', {
		cls: `clickable-icon ${cls}`,
		attr: { type: 'button', 'aria-label': label },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	btn.addEventListener('click', run);
}
