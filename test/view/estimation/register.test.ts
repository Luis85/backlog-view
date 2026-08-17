// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BasesViewRegistration } from 'obsidian';
import { registerEstimationView } from '../../../src/view/estimation/register';
import { WriteLock } from '../../../src/view/writeLock';
import { ESTIMATION_VIEW_TYPE, EstimationView } from '../../../src/view/estimation/estimationView';
import { useViewHarness } from '../../helpers/view';

useViewHarness();

describe('registerEstimationView', () => {
	it('registers the estimation view with the correct config', () => {
		const specs = new Map<string, BasesViewRegistration>();
		const fakePlugin = {
			registerBasesView: (type: string, spec: BasesViewRegistration) => {
				specs.set(type, spec);
			},
		};

		const lock = new WriteLock();
		registerEstimationView(fakePlugin as never, lock);

		expect(specs.has(ESTIMATION_VIEW_TYPE)).toBe(true);
		const spec = specs.get(ESTIMATION_VIEW_TYPE)!;
		expect(spec.name).toBe('Estimation');
		expect(spec.icon).toBe('lucide-calculator');
		expect(spec.options).toBeDefined();
	});

	// registerBacklogView.test.ts proves its factory view SHARES the lock observably —
	// view B undoing a write view A made. That proof needs a write gate, and this view's
	// own gate does not arrive until a later task, so this only proves the factory builds
	// an EstimationView holding the exact lock instance it was given.
	it('factory-built view is an EstimationView constructed with the given lock', () => {
		const specs = new Map<string, BasesViewRegistration>();
		const fakePlugin = {
			registerBasesView: (type: string, spec: BasesViewRegistration) => {
				specs.set(type, spec);
			},
		};
		const lock = new WriteLock();
		registerEstimationView(fakePlugin as never, lock);
		const spec = specs.get(ESTIMATION_VIEW_TYPE)!;

		const containerEl = document.body.createDiv();
		const view = spec.factory({} as never, containerEl);

		expect(view).toBeInstanceOf(EstimationView);
		expect((view as EstimationView).lock).toBe(lock);
	});
});
