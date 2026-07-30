/**
 * Minimal stand-in for the 'obsidian' module so both the pure logic modules
 * (settings, model, ops) and the DOM layer (view, modal — under jsdom) can run
 * under vitest. Only what those modules touch at runtime is implemented.
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

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.filter((part) => part.length > 0)
		.join('/');
}

export class TFolder {
	path = '';
	name = '';
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
	static reset(): void {
		Notice.messages = [];
	}
}

export class NullValue {}

// ------------------------------------------------------------------ components

export class Component {
	load(): void {}
	unload(): void {
		this.onunload();
	}
	onload(): void {}
	onunload(): void {}
	register(_cb: () => void): void {}
	registerDomEvent(el: { addEventListener: (t: string, cb: (evt: unknown) => void) => void }, type: string, cb: (evt: unknown) => void): void {
		el.addEventListener(type, cb);
	}
}

/** Matches the runtime surface ProductBacklogView relies on; app/config/data are assigned by the test harness. */
export class BasesView extends Component {
	app: unknown;
	config: unknown;
	data: unknown;
	controller: unknown;
	constructor(controller: unknown) {
		super();
		this.controller = controller;
	}
}

export type QueryController = unknown;
export type App = any;
export type BasesEntry = any;
export type BasesAllOptions = any;
export type BasesViewConfig = any;

// ------------------------------------------------------------------------- ui

export const Keymap = {
	isModEvent(evt: { ctrlKey?: boolean; metaKey?: boolean } | null | undefined): 'tab' | false {
		return evt && (evt.ctrlKey || evt.metaKey) ? 'tab' : false;
	},
};

export function setIcon(el: HTMLElement, icon: string): void {
	el.dataset.icon = icon;
}

export function setTooltip(el: HTMLElement, tooltip: string): void {
	el.dataset.tooltip = tooltip;
}

export class MenuItem {
	titleText = '';
	iconName = '';
	checked = false;
	submenu: Menu | null = null;
	clickHandler: (() => unknown) | null = null;

	setTitle(title: string): this {
		this.titleText = title;
		return this;
	}
	setIcon(icon: string): this {
		this.iconName = icon;
		return this;
	}
	setChecked(checked: boolean): this {
		this.checked = checked;
		return this;
	}
	onClick(cb: () => unknown): this {
		this.clickHandler = cb;
		return this;
	}
	setSubmenu(): Menu {
		this.submenu = new Menu();
		return this.submenu;
	}
	click(): void {
		this.clickHandler?.();
	}
}

export class Menu {
	/** The menu most recently opened via showAtMouseEvent — submenus are never shown. */
	static lastShown: Menu | null = null;
	items: MenuItem[] = [];
	separators = 0;

	addItem(cb: (item: MenuItem) => unknown): this {
		const item = new MenuItem();
		this.items.push(item);
		cb(item);
		return this;
	}
	addSeparator(): this {
		this.separators++;
		return this;
	}
	showAtMouseEvent(_evt: unknown): this {
		Menu.lastShown = this;
		return this;
	}
	/** Find an item by its (exact) title. */
	item(title: string): MenuItem | undefined {
		return this.items.find((i) => i.titleText === title);
	}
}

class TextComponent {
	inputEl: HTMLInputElement;
	constructor(containerEl: HTMLElement) {
		this.inputEl = containerEl.createEl('input') as HTMLInputElement;
	}
	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}
	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}
	onChange(cb: (value: string) => unknown): this {
		this.inputEl.addEventListener('input', () => cb(this.inputEl.value));
		return this;
	}
}

class ButtonComponent {
	buttonEl: HTMLButtonElement;
	constructor(containerEl: HTMLElement) {
		this.buttonEl = containerEl.createEl('button') as HTMLButtonElement;
	}
	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}
	setCta(): this {
		return this;
	}
	onClick(cb: () => unknown): this {
		this.buttonEl.addEventListener('click', cb);
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
	}
	setName(_name: string): this {
		return this;
	}
	setDesc(_desc: string): this {
		return this;
	}
	setHeading(): this {
		return this;
	}
	addText(cb: (text: TextComponent) => unknown): this {
		cb(new TextComponent(this.settingEl));
		return this;
	}
	addButton(cb: (btn: ButtonComponent) => unknown): this {
		cb(new ButtonComponent(this.settingEl));
		return this;
	}
}

export class Modal {
	app: unknown;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	constructor(app: unknown) {
		this.app = app;
		this.titleEl = document.createElement('div');
		this.contentEl = document.createElement('div');
	}
	open(): void {
		(this as unknown as { onOpen?: () => void }).onOpen?.();
	}
	close(): void {
		(this as unknown as { onClose?: () => void }).onClose?.();
	}
}

export abstract class AbstractInputSuggest<T> {
	app: any;
	constructor(app: unknown, _textInputEl: unknown) {
		this.app = app;
	}
	setValue(_value: string): void {}
	getValue(): string {
		return '';
	}
	close(): void {}
	protected abstract getSuggestions(query: string): T[] | Promise<T[]>;
	abstract renderSuggestion(value: T, el: HTMLElement): void;
	abstract selectSuggestion(value: T, evt: unknown): void;
}
