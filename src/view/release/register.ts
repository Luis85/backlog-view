import { Plugin } from 'obsidian';
import { getReleaseViewOptions } from '../../domain/releaseOptions';
import { RELEASE_VIEW_TYPE, ReleaseView } from './releaseView';
import { t } from '../../i18n/t';

/**
 * The release view's own registration — one file per view, so a third capability adds a
 * file rather than a branch in main (ADR 0030).
 *
 * No `WriteLock` parameter, unlike `registerEstimationView`: this view plans no batch, so
 * there is nothing for a lock to serialize and no undo slot to share. Threading one in
 * "for symmetry" would state a relationship that does not exist.
 */
export function registerReleaseView(plugin: Plugin): void {
	plugin.registerBasesView(RELEASE_VIEW_TYPE, {
		// An ordinary view-type label, so it is translated — only the plugin's own identity
		// in `registerBacklogView.ts` gets the eslint-disable.
		name: t('release.viewName'),
		icon: 'lucide-package',
		factory: (controller, containerEl) => new ReleaseView(controller, containerEl),
		options: getReleaseViewOptions,
	});
}
