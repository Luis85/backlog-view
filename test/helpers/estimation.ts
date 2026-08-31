import { vi } from 'vitest';
import { EstimationView } from '../../src/view/estimation/estimationView';
import { WriteLock } from '../../src/view/writeLock';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf, mountView } from './vault';
import { fakeController } from '../helpers/vault';

installObsidianDom();

export interface EstimationHarness {
	view: EstimationView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * The estimation view's own harness — `test/helpers/view.ts`'s `makeView` assignment
 * pattern (`anyView.app/config/data`, then `onDataUpdated()`) narrowed to what this view
 * actually has: no collapse state, no focus level to prime.
 */
export function makeEstimationView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ lock = new WriteLock(), base, viewName }: { lock?: WriteLock; base?: string; viewName?: string } = {},
): EstimationHarness {
	// Bases mounts the view inside the leaf showing the .base file, the same nesting
	// `makeView` builds (`mountLeaf`, shared) — persistence needs the real leaf to identify it.
	const containerEl = mountLeaf(vault, base);
	const view = new EstimationView(fakeController(), containerEl, lock);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	mountView(view, vault, config, vault.entries());
	return { view, config, containerEl };
}

/**
 * The accessors every panel-driven suite needs, here rather than per file: the panel is
 * drawn for whatever `selectedPath` names, so each of these suites starts by clicking a
 * table row and then addresses one control inside the panel it drew.
 */
export function click(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export function selectItem(containerEl: HTMLElement, path: string): void {
	click(containerEl.querySelector(`.pbl-est-row[data-path="${path}"]`) as HTMLElement);
}

/** Addressed by `dataset` rather than by a selector, because a dimension id is user-typed
 *  option text: an id holding a quote is exactly what breaks a hand-built selector. */
export function pickButton(containerEl: HTMLElement, dim: string, value: string, kind?: string): HTMLElement | null {
	return (
		Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-est-panel button')).find(
			(el) => el.dataset.dim === dim && el.dataset.value === value && (kind === undefined || el.dataset.kind === kind),
		) ?? null
	);
}

export function pointButton(containerEl: HTMLElement, dim: string, value: number): HTMLElement {
	const btn = pickButton(containerEl, dim, String(value));
	if (!btn) throw new Error(`no point button for ${dim}=${value}`);
	return btn;
}

export function clearButton(containerEl: HTMLElement, dim: string): HTMLElement | null {
	return pickButton(containerEl, dim, '');
}

export function dimRow(containerEl: HTMLElement, label: string): HTMLElement {
	const found = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-est-panel .pbl-est-dim')).find(
		(el) => el.querySelector('.pbl-est-dim-label')?.textContent === label,
	);
	if (!found) throw new Error(`no dim row labelled ${label}`);
	return found;
}

/** The rubric sentence, the clamp note or the between-points note a row is showing — the
 *  one slot all three land in, so a row saying NOTHING is `null` rather than an empty box. */
export function rowNote(containerEl: HTMLElement, label: string): string | null {
	return dimRow(containerEl, label).querySelector('.pbl-est-rubric')?.textContent ?? null;
}

/**
 * Every `scrollTop` READ of one element, recorded as whether that element was still in
 * the document at the moment of the read.
 *
 * The number itself is not checkable here: a detached element has no layout box, so a
 * browser's getter answers 0 however far it was scrolled, while jsdom answers with
 * whatever was last assigned to it — connected or not. So an assertion on the restored
 * position passes over a restore that cannot work in a real vault, which is what happened.
 * The ORDER is checkable, and this is what checks it: the read has to happen before the
 * teardown that detaches the node. Restore the spy with `vi.restoreAllMocks()`.
 */
export function scrollReads(el: HTMLElement): boolean[] {
	const reads: boolean[] = [];
	const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')?.get;
	if (!original) throw new Error('jsdom defines no scrollTop getter to spy on');
	vi.spyOn(Element.prototype, 'scrollTop', 'get').mockImplementation(function (this: Element): number {
		if (this === el) reads.push(this.isConnected);
		return original.call(this) as number;
	});
	return reads;
}
