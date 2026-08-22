// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { Modal } from '../../helpers/obsidian-mock';
import { INDICATOR_PRESETS } from '../../../src/domain/estimationPresets';
import { presetText } from '../../../src/view/estimation/presets';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 2 } });
	return vault;
}

function open(containerEl: HTMLElement): HTMLElement {
	(containerEl.querySelector('.pbl-est-presets') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
	return Modal.lastOpened?.contentEl as HTMLElement;
}

function row(contentEl: HTMLElement, id: string): HTMLElement {
	return contentEl.querySelector(`.pbl-est-preset[data-preset="${id}"]`) as HTMLElement;
}

function click(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('starting from a known framework', () => {
	it('lists the four presets, each with a description and a formula', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		expect(contentEl.querySelectorAll('.pbl-est-preset')).toHaveLength(4);
		expect(row(contentEl, 'rice').querySelector('.pbl-est-preset-desc')?.textContent).toContain('Favours work');
		expect(row(contentEl, 'rice').querySelector('.pbl-est-preset-formula')?.textContent).toBe(
			'Reach × Business impact × Confidence ÷ Effort',
		);
	});

	it('writes nothing until Apply, and nothing at all on Cancel', () => {
		const { containerEl, config } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		expect(config.setCalls).toHaveLength(0);
		click(contentEl.querySelector('.pbl-est-preset-cancel') as HTMLElement);
		expect(config.setCalls).toHaveLength(0);
	});

	it('sets exactly the three indicator keys on Apply, and writes no note', () => {
		const { containerEl, config } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		click(contentEl.querySelector('.pbl-est-preset-apply') as HTMLElement);
		expect(config.setCalls.map((call) => call.key).sort()).toEqual([
			'indicatorDivisor',
			'indicatorLabel',
			'indicatorOperands',
		]);
		expect(config.values.indicatorOperands).toBe('reach, business-impact, confidence');
		expect(config.values.indicatorLabel).toBe('RICE');
	});

	it('says the value model is unchanged, and states the kind once rather than per row', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'wsjf'));
		expect(contentEl.querySelector('.pbl-est-preview')?.textContent).toContain('value model is unchanged');
		expect(contentEl.querySelectorAll('.pbl-est-preset-kind')).toHaveLength(0);
		expect(contentEl.querySelector('.pbl-est-preset-kinds')?.textContent).toContain('beside the business value');
	});

	it('puts focus back in the toolbar after Apply, not on the body', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		click(contentEl.querySelector('.pbl-est-preset-apply') as HTMLElement);
		Modal.lastOpened?.close();
		// The button that opened the dialog was detached by the refresh Apply ran, so this
		// asserts the REPLACEMENT was found rather than that the original kept focus.
		const active = containerEl.ownerDocument.activeElement as HTMLElement;
		expect(containerEl.querySelector('.pbl-toolbar')?.contains(active)).toBe(true);
	});

	it('announces which preset is picked, not only colours it', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		expect(row(contentEl, 'rice').getAttribute('aria-pressed')).toBe('true');
		click(row(contentEl, 'ice'));
		// The one just deselected is the half a single-element update would miss.
		expect(row(contentEl, 'rice').getAttribute('aria-pressed')).toBe('false');
		expect(row(contentEl, 'ice').getAttribute('aria-pressed')).toBe('true');
	});

	it('gives every preset row a non-empty description — the id→catalog-key mapping is not one-to-one', () => {
		// `value-over-effort` is kebab-case; its catalog keys are `valueOverEffort` —
		// camelCase. A missed or misspelled mapping renders an empty description with no
		// other test failing, so this checks every id rather than just that one.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		for (const preset of INDICATOR_PRESETS) {
			const desc = row(contentEl, preset.id).querySelector('.pbl-est-preset-desc')?.textContent ?? '';
			expect(desc.length).toBeGreaterThan(0);
		}
	});

	it('falls back to blank prose for an id the catalog table does not carry', () => {
		expect(presetText('not-a-real-preset')).toEqual({ description: '', note: '' });
	});

	it('applying with nothing picked writes nothing — Apply is disabled, but the guard is real', () => {
		const { containerEl, config } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(contentEl.querySelector('.pbl-est-preset-apply') as HTMLElement);
		expect(config.setCalls).toHaveLength(0);
	});

	it('picks a preset by keyboard — Enter and Space both select, another key does not', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		const rice = row(contentEl, 'rice');
		rice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(rice.getAttribute('aria-pressed')).toBe('false');
		rice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(rice.getAttribute('aria-pressed')).toBe('true');
		const ice = row(contentEl, 'ice');
		ice.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(ice.getAttribute('aria-pressed')).toBe('true');
		expect(rice.getAttribute('aria-pressed')).toBe('false');
	});

	it('applying a preset with no divisor clears the divisor key rather than leaving the old one', () => {
		const { containerEl, config } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'ice'));
		click(contentEl.querySelector('.pbl-est-preset-apply') as HTMLElement);
		expect(config.values.indicatorDivisor).toBe('');
	});

	it('names the current indicator as None when nothing is configured', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues({ indicatorOperands: '' }));
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		expect(contentEl.querySelector('.pbl-est-preview')?.textContent).toContain('None');
	});

	it('names the current indicator by its label when one is set', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues({ indicatorLabel: 'Score' }));
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		expect(contentEl.querySelector('.pbl-est-preview')?.textContent).toContain('Score —');
	});
});
