// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Modal } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { laneRoadmap, makeRoadmap } from '../helpers/roadmap';

useViewHarness();

/**
 * The resources axis's own creation control (Task 4 of [[Making a resource from the
 * timeline]]). The acceptance criterion is "draws on the resources axis and nowhere
 * else", which is a claim about absence as much as presence — every case below is one
 * screen the button must not appear on.
 */

const button = (containerEl: HTMLElement) => containerEl.querySelector<HTMLElement>('[data-pbl-key="new-resource"]');

describe('the new-resource button', () => {
	it('draws on the roadmap, on the resources axis', () => {
		const { containerEl } = laneRoadmap(new FakeVault());
		expect(button(containerEl)).not.toBeNull();
	});

	it('is absent on the horizons axis', () => {
		const { view, containerEl } = makeRoadmap(new FakeVault());
		view.setAxisPick('horizons');
		expect(button(containerEl)).toBeNull();
	});

	it('is absent on the dated axis', () => {
		const { view, containerEl } = makeRoadmap(new FakeVault(), {
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setAxisPick('dates');
		expect(button(containerEl)).toBeNull();
	});

	it('is absent on the tree, even with the resources axis picked', () => {
		const vault = new FakeVault();
		const { view, containerEl } = makeView(vault, {
			startProperty: 'note.start',
			targetProperty: 'note.due',
			assigneeProperty: 'note.assignee',
		});
		view.setAxisPick('resources');
		expect(button(containerEl)).toBeNull();
	});

	it('is absent on both boards, even with the resources axis picked', () => {
		const vault = new FakeVault();
		const { view, containerEl } = makeView(vault, {
			startProperty: 'note.start',
			targetProperty: 'note.due',
			assigneeProperty: 'note.assignee',
		});
		view.setAxisPick('resources');

		view.setProjection('board');
		expect(button(containerEl)).toBeNull();

		view.setProjection('deliverables');
		expect(button(containerEl)).toBeNull();
	});

	it('opens the resource prompt when pressed', () => {
		const { containerEl } = laneRoadmap(new FakeVault());
		button(containerEl)?.dispatchEvent(new MouseEvent('click'));

		expect(Modal.lastOpened).not.toBeNull();
		expect(Modal.lastOpened?.titleEl.textContent).toBe('New resource');
	});
});
