import { Plugin } from 'obsidian';
import { getEstimationViewOptions } from '../../domain/estimationOptions';
import { ESTIMATION_VIEW_TYPE, EstimationView } from './estimationView';
import { WriteLock } from '../writeLock';

/**
 * The estimation view's own registration — one file per view, so a second capability adds
 * a file rather than a branch in main (ADR 0030, [[A view type per capability]]). The
 * lock arrives from main because the write path is the one piece of plugin-wide runtime
 * state; this view's own write gate is not built until a later task, but the lock is
 * threaded through from the start so the view never needs a second one.
 */
export function registerEstimationView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(ESTIMATION_VIEW_TYPE, {
		name: 'Estimation',
		icon: 'lucide-calculator',
		factory: (controller, containerEl) => new EstimationView(controller, containerEl, lock),
		options: getEstimationViewOptions,
	});
}
