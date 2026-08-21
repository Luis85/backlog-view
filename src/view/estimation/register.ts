import { Plugin } from 'obsidian';
import { getEstimationViewOptions } from '../../domain/estimationOptions';
import { ESTIMATION_VIEW_TYPE, EstimationView } from './estimationView';
import { WriteLock } from '../writeLock';
import { t } from '../../i18n/t';

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
		// Not the plugin's identity like `registerBacklogView.ts`'s `name` — an ordinary
		// view-type label, so it is translated rather than exempted (see the key's own
		// comment in en.ts for why only one `name:` here gets the eslint-disable).
		name: t('estimation.viewName'),
		icon: 'lucide-calculator',
		factory: (controller, containerEl) => new EstimationView(controller, containerEl, lock),
		options: getEstimationViewOptions,
	});
}
