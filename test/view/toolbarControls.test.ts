// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { ProductBacklogView } from '../../src/view/backlogView';
import { collapseAll, expandAll } from '../../src/view/render/toolbarControls';
import { fakeController } from '../helpers/vault';

installObsidianDom();

describe('expandAll and collapseAll before a model exists', () => {
	// `renderToolbar` never wires the buttons this early — the toolbar returns before
	// drawing anything when `host.model` is null — but the two are exported standalone
	// now, so a caller that reaches them before the first data update (or the `⋯`
	// menu, once it can render before a load finishes) must get a no-op, not a throw.
	it('does nothing when the host has no model yet', () => {
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView(fakeController(), containerEl);

		expect(view.model).toBeNull();
		expect(() => expandAll(view)).not.toThrow();
		expect(() => collapseAll(view)).not.toThrow();
	});
});
