import { Plugin } from 'obsidian';
import { WriteLock } from '../writeLock';
import { getReleaseViewOptions } from '../../domain/releaseOptions';
import { RELEASE_VIEW_TYPE, ReleaseView } from './releaseView';
import { t } from '../../i18n/t';

/**
 * The release view's own registration — one file per view, so a third capability adds a
 * file rather than a branch in main (ADR 0030).
 *
 * It takes the plugin-wide `WriteLock` now, as `registerEstimationView` always has. It
 * did not until 2026-08-29, and the reason it did not is worth keeping because it is the
 * rule rather than the state: a lock serializes BATCHES and hands out the undo slot, and
 * this view planned none — a create captures no inverse and races nothing. Editing a
 * release's own status and description ([[Editing a release from its own screen]]) is a
 * batch, so the lock is now a relationship that exists rather than symmetry.
 *
 * A create still installs no undo slot, for its own reason: there is nothing to take back.
 */
export function registerReleaseView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(RELEASE_VIEW_TYPE, {
		// An ordinary view-type label, so it is translated — only the plugin's own identity
		// in `registerBacklogView.ts` gets the eslint-disable.
		name: t('release.viewName'),
		icon: 'lucide-package',
		factory: (controller, containerEl) => new ReleaseView(controller, containerEl, lock),
		options: getReleaseViewOptions,
	});
}
