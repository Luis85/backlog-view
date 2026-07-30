/**
 * Minimal stand-in for the 'obsidian' module so the pure logic modules
 * (settings, model, ops) can run under vitest. Only what those modules
 * touch at runtime is implemented.
 */

export type BasesPropertyId = `${'note' | 'formula' | 'file'}.${string}`;

export interface BasesProperty {
	type: 'note' | 'formula' | 'file';
	name: string;
}

export function parsePropertyId(propertyId: BasesPropertyId): BasesProperty {
	const idx = propertyId.indexOf('.');
	return {
		type: propertyId.substring(0, idx) as BasesProperty['type'],
		name: propertyId.substring(idx + 1),
	};
}

export class TFolder {
	path = '';
	name = '';
}

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.filter((part) => part.length > 0)
		.join('/');
}

export class TFile {
	path: string;
	basename: string;
	extension: string;
	parent: { path: string } | null;

	constructor(path: string) {
		this.path = path;
		const slash = path.lastIndexOf('/');
		const name = slash === -1 ? path : path.substring(slash + 1);
		const dot = name.lastIndexOf('.');
		this.basename = dot === -1 ? name : name.substring(0, dot);
		this.extension = dot === -1 ? '' : name.substring(dot + 1);
		this.parent = { path: slash === -1 ? '/' : path.substring(0, slash) };
	}
}

export class Notice {
	static messages: string[] = [];
	constructor(message: string) {
		Notice.messages.push(message);
	}
}

// Types referenced by the modules under test but never instantiated there.
export type App = any;
export type BasesEntry = any;
export type BasesAllOptions = any;
export type BasesViewConfig = any;
