import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { renderModeSwitch, renderProgressBar } from './iterationHeader';
import { iterationProgress, IterationProgress } from '../../domain/iterationDaily';
import { BacklogModel } from '../../domain/model';
import { sameValue } from '../../domain/noteFields';
import { buildRoadmap, RoadmapModel } from '../../domain/roadmap';

/**
 * The horizon board's header: where the work sits, said in one line a stakeholder can read
 * aloud, and the Present/Plan switch that takes the editing chrome away for a meeting.
 *
 * Every number is a RESULT count — `bucket.count`, and the shelf, which on this axis holds
 * results only — so a context row the Base excluded is never counted (the context-row
 * rule). The shelf's count is said here in Present too, where the shelf is not drawn: the
 * mode hides work that is not placed yet, it never makes it secret.
 */
export function renderHorizonHeader(
	host: BacklogViewHost,
	frameEl: HTMLElement,
	paneEl: HTMLElement,
	roadmap: RoadmapModel,
): void {
	const headerEl = frameEl.createDiv({ cls: 'pbl-iteration-header pbl-horizon-header' });
	const titlebar = headerEl.createDiv({ cls: 'pbl-iteration-titlebar' });
	const titles = titlebar.createDiv();
	titles.createDiv({ cls: 'pbl-iteration-kicker', text: t('horizons.kicker') });
	titles.createEl('h2', { cls: 'pbl-iteration-name', text: t('horizons.title') });
	renderModeSwitch(titlebar, paneEl, t('horizons.modeLabel'), [
		{
			text: t('horizons.modePresent'),
			tip: t('horizons.modePresentTip'),
			pressed: host.horizonPresent,
			choose: () => host.setHorizonPresent(true),
		},
		{
			text: t('horizons.modePlan'),
			tip: t('horizons.modePlanTip'),
			pressed: !host.horizonPresent,
			choose: () => host.setHorizonPresent(false),
		},
	]);
	// Each count is its own sentence, so the `·` between them is a separator span, not text joined.
	const parts = roadmap.buckets.map((bucket) => t('horizons.bucketCount', { bucket: bucket.value, count: bucket.count }));
	if (roadmap.shelf.length > 0) parts.push(t('horizons.unplaced', { count: roadmap.shelf.length }));
	const summary = headerEl.createDiv({ cls: 'pbl-iteration-meta pbl-horizon-summary' });
	parts.forEach((text, i) => {
		if (i > 0) summary.createSpan({ cls: 'pbl-iteration-sep', text: '·', attr: { 'aria-hidden': 'true' } });
		summary.createSpan({ text });
	});
}

/**
 * Each bucket's progress, by its value. Progress is about the plan, not the screen: counted
 * over the same membership and focus with the completed toggle IGNORED, so hiding finished
 * work never reads as nothing finished. `iterationProgress` skips context rows — results only.
 */
export function bucketProgress(host: BacklogViewHost, model: BacklogModel): (value: string) => IterationProgress {
	// ponytail: a second `buildRoadmap` per horizon render; a counting pass if it shows in `npm run perf`.
	const counted = buildRoadmap(model, host.settings, (item) => !host.isRowUndrawn(item), 'horizons');
	return (value) =>
		iterationProgress(counted.buckets.find((b) => sameValue(b.value, value))?.cards ?? [], host.settings);
}

/** A bucket's share of done work: the bar is decoration, the text carries the number. */
export function renderBucketProgress(colEl: HTMLElement, progress: IterationProgress): void {
	const el = colEl.createDiv({ cls: 'pbl-bucket-progress' });
	renderProgressBar(el, progress);
	el.createSpan({ text: t('horizons.bucketProgress', { resolved: progress.resolved, total: progress.total }) });
}
