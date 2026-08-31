// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { BasesViewRegistration } from 'obsidian';
import { registerEstimationView } from '../../../src/view/estimation/register';
import { WriteLock } from '../../../src/view/writeLock';
import { ESTIMATION_VIEW_TYPE, EstimationView } from '../../../src/view/estimation/estimationView';
import { useViewHarness, captureRegistrations } from '../../helpers/view';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { fakeController, FakeVault, FakeViewConfig, mountView } from '../../helpers/vault';

useViewHarness();

describe('registerEstimationView', () => {
	it('registers the estimation view with the correct config', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();

		const lock = new WriteLock();
		registerEstimationView(fakePlugin, lock);

		expect(specs.has(ESTIMATION_VIEW_TYPE)).toBe(true);
		const spec = specs.get(ESTIMATION_VIEW_TYPE)!;
		expect(spec.name).toBe('Estimation');
		expect(spec.icon).toBe('lucide-calculator');
		expect(spec.options).toBeDefined();
	});

	it('factory-built view is an EstimationView constructed with the given lock', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();
		const lock = new WriteLock();
		registerEstimationView(fakePlugin, lock);
		const spec = specs.get(ESTIMATION_VIEW_TYPE)!;

		const containerEl = document.body.createDiv();
		const view = spec.factory(fakeController(), containerEl);

		expect(view).toBeInstanceOf(EstimationView);
		expect((view as EstimationView).lock).toBe(lock);
	});

	it('factory-built view shares the lock observably: view B undoes a write view A made', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const lockA = new WriteLock();

		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();
		registerEstimationView(fakePlugin, lockA);
		const spec = specs.get(ESTIMATION_VIEW_TYPE)!;

		const containerA = document.body.createDiv();
		const viewA = spec.factory(fakeController(), containerA);
		mountView(viewA, vault, new FakeViewConfig(configuredValues()), vault.entries());

		// A second view with the SAME lock, built the ordinary test-helper way.
		const { view: viewB } = makeEstimationView(vault, configuredValues(), { lock: lockA });

		const fileOf = (path: string) => vault.entries().find((e) => e.file.path === path)!.file;
		await (viewA as unknown as EstimationView).applySafely([
			{ file: fileOf('Item.md'), sets: [{ key: 'strategic-alignment', value: 3 }] },
		]);

		// Observable proof: view B (never the one writing) can undo the batch view A made
		// through the factory — the same shape `registerBacklogView.test.ts` proves for
		// the backlog view, and evidence this view's own gate is built from the shared
		// lock rather than a private one.
		expect(viewB.gate.canUndo()).toBe(true);
	});
});
