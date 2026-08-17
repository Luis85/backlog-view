import { EstimationView } from '../../src/view/estimation/estimationView';
import { WriteLock } from '../../src/view/writeLock';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig } from './vault';
import { FileView } from './obsidian-mock';

installObsidianDom();

export interface EstimationHarness {
	view: EstimationView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * The estimation view's own harness — `test/helpers/view.ts`'s `makeView` assignment
 * pattern (`anyView.app/config/data`, then `onDataUpdated()`) narrowed to what this view
 * actually has this task: no toolbar, no collapse state, no focus level to prime.
 */
export function makeEstimationView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ lock, base, viewName }: { lock?: WriteLock; base?: string; viewName?: string } = {},
): EstimationHarness {
	// Bases mounts the view inside the leaf showing the .base file, the same nesting
	// `makeView` builds — a later task's persistence needs the real leaf to identify it.
	const leafEl = document.body.createDiv();
	const containerEl = leafEl.createDiv();
	if (base) vault.addLeaf(new FileView(vault.addFile(base), leafEl));
	const view = new EstimationView({} as never, containerEl, lock);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
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
