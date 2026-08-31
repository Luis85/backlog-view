// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { BasesViewRegistration } from 'obsidian';
import { registerBacklogView } from '../../src/view/registerBacklogView';
import { WriteLock } from '../../src/view/writeLock';
import { PRODUCT_BACKLOG_VIEW_TYPE } from '../../src/view/backlogView';
import { useViewHarness, fixture, makeView, captureRegistrations } from '../helpers/view';
import { fakeController, FakeViewConfig } from '../helpers/vault';

useViewHarness();

describe('registerBacklogView', () => {
	it('registers the backlog view with the correct config', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();

		const lock = new WriteLock();
		registerBacklogView(fakePlugin, lock);

		expect(specs.has(PRODUCT_BACKLOG_VIEW_TYPE)).toBe(true);
		const spec = specs.get(PRODUCT_BACKLOG_VIEW_TYPE)!;
		expect(spec.name).toBe('Product Backlog');
		expect(spec.icon).toBe('lucide-list-tree');
	});

	it('factory-built view shares the lock with other views', async () => {
		const vault = fixture();
		const lockA = new WriteLock();

		// Register and capture the spec
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();
		registerBacklogView(fakePlugin, lockA);
		const spec = specs.get(PRODUCT_BACKLOG_VIEW_TYPE)!;

		// Create first view via factory
		const containerA = document.body.createDiv();
		const viewA = spec.factory(fakeController(), containerA) as unknown as Record<string, unknown>;

		// Set up the necessary properties like makeView does
		viewA.app = vault.app;
		viewA.config = new FakeViewConfig({});
		viewA.data = { data: vault.entries() };
		(viewA as any).onDataUpdated();

		// Create a second view with the SAME lock using makeView
		const { view: viewB } = makeView(vault, {}, { lock: lockA });

		// Write through view A (factory-built) via applySafely
		const fileOf = (path: string) => vault.entries().find((e) => e.file.path === path)!.file;
		await (viewA as any).applySafely([{ file: fileOf('Epic A.md'), order: 99 }]);

		// Observable proof: viewB can undo a write that viewA made
		// This proves the factory view received the same lock, not a private one
		expect(viewB.canUndo()).toBe(true);
	});
});
