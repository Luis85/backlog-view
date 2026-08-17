import { Plugin } from 'obsidian';
import { getEstimationViewOptions } from '../../domain/estimationOptions';
import { ESTIMATION_VIEW_TYPE, EstimationView } from './estimationView';
import { WriteLock } from '../writeLock';

/**
 * The estimation view's own registration — one file per view, so a second capability adds
 * a file rather than a branch in main (ADR 0030, [[A view type per capability]]). The
 * lock arrives from main because the write path is the one piece of plugin-wide runtime
 * state: this view's own `WriteGate` (`estimationView.ts`) is built from it, so a batch
 * here and a batch in the backlog view serialize against the SAME lock and share the
 * same undo slot, rather than each view needing one of its own.
 */
export function registerEstimationView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(ESTIMATION_VIEW_TYPE, {
		name: 'Estimation',
		icon: 'lucide-calculator',
		factory: (controller, containerEl) => new EstimationView(controller, containerEl, lock),
		options: getEstimationViewOptions,
	});
}
