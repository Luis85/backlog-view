/**
 * Installs the Obsidian DOM prototype extensions (createEl, addClass, setCssProps, …)
 * that the plugin's rendering code relies on. Call once per jsdom test file before
 * constructing any view or modal.
 */

interface CreateOptions {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
	/** Mirrors Obsidian's `DomElementInfo.value` — an `<option>`'s or `<input>`'s value. */
	value?: string;
	/** Mirrors Obsidian's `DomElementInfo.type` — an `<input>`'s type. */
	type?: string;
}

function applyOptions(el: HTMLElement, options?: CreateOptions | string): void {
	const opts: CreateOptions = typeof options === 'string' ? { cls: options } : options ?? {};
	if (opts.cls) {
		const classes = Array.isArray(opts.cls) ? opts.cls : opts.cls.split(/\s+/);
		el.classList.add(...classes.filter((c) => c.length > 0));
	}
	if (opts.text !== undefined) el.textContent = opts.text;
	if (opts.attr) {
		for (const [key, value] of Object.entries(opts.attr)) el.setAttribute(key, value);
	}
	// Set as attributes, not IDL properties: an <option>'s `value` IDL property exists
	// only once it does, but the attribute is what a <select> reads to resolve its own
	// `.value` regardless of element type, and it is what `setAttribute` always accepts.
	if (opts.value !== undefined) el.setAttribute('value', opts.value);
	if (opts.type !== undefined) el.setAttribute('type', opts.type);
}

/**
 * A minimal `ResizeObserver` for jsdom, which implements none: `observe` and `disconnect`
 * — the two `backlogView.ts` calls — just track which elements a callback is watching,
 * and nothing fires on its own, since real layout never happens here. `fireResize` (below) is what a test uses to
 * say "the platform just told every observer of this element that it resized", the same
 * one-shot shape `dragend`/`keydown` already stand in for real platform events.
 */
class MockResizeObserver {
	private static instances: MockResizeObserver[] = [];
	private readonly targets = new Set<Element>();

	constructor(private readonly callback: ResizeObserverCallback) {
		MockResizeObserver.instances.push(this);
	}

	observe(target: Element): void {
		this.targets.add(target);
	}

	disconnect(): void {
		this.targets.clear();
	}

	/** Every observer currently watching `target`, in registration order. */
	static watching(target: Element): MockResizeObserver[] {
		return MockResizeObserver.instances.filter((o) => o.targets.has(target));
	}

	fire(): void {
		this.callback([], this as unknown as ResizeObserver);
	}
}

/**
 * Simulate the platform reporting that `target` resized — every live observer watching
 * it fires once, synchronously (real ones batch into a microtask; nothing here needs
 * that ordering). A `disconnect`ed view's observer is not "watching" any more, so this
 * is naturally a no-op once `onunload` has run, exactly like a real one.
 */
export function fireResize(target: Element): void {
	for (const observer of MockResizeObserver.watching(target)) observer.fire();
}

export function installObsidianDom(): void {
	if (typeof globalThis.ResizeObserver === 'undefined') {
		globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
	}
	const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
	if (proto.__obsidianDomInstalled) return;
	proto.__obsidianDomInstalled = true;

	proto.createEl = function (this: HTMLElement, tag: string, options?: CreateOptions | string): HTMLElement {
		const el = document.createElement(tag);
		applyOptions(el, options);
		this.appendChild(el);
		return el;
	};
	proto.createDiv = function (this: HTMLElement, options?: CreateOptions | string): HTMLElement {
		return (this as HTMLElement & { createEl: (t: string, o?: CreateOptions | string) => HTMLElement }).createEl('div', options);
	};
	proto.createSpan = function (this: HTMLElement, options?: CreateOptions | string): HTMLElement {
		return (this as HTMLElement & { createEl: (t: string, o?: CreateOptions | string) => HTMLElement }).createEl('span', options);
	};
	/**
	 * Obsidian's own namespace-aware sibling of `createEl`, installed on ELEMENT rather
	 * than HTMLElement because that is where the real API declares it and because an SVG
	 * parent needs it: `SVGSVGElement` does not inherit from `HTMLElement`, so a copy
	 * beside `createDiv` would exist on the layer's parent and be missing on the layer.
	 *
	 * It does NOT reuse `applyOptions`, and the difference is the whole point. `addClass`
	 * lives on `HTMLElement`, so Obsidian hands an SVG node's `cls` straight to
	 * `classList.add` — which rejects a space-separated STRING with `InvalidCharacterError`
	 * where the HTML helpers would have split it happily. Sharing `applyOptions` made this
	 * fake KINDER than the real thing, and a two-class arrow path threw in a vault while
	 * every test and the browser harness drew it without complaint: the error aborted the
	 * whole render, so the timeline's grid never registered its drop target and dragging a
	 * bar silently did nothing. An array is the form that always works, in both.
	 */
	(Element.prototype as unknown as Record<string, unknown>).createSvg = function (
		this: Element,
		tag: string,
		options?: CreateOptions | string,
	): SVGElement {
		const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
		const opts: CreateOptions = typeof options === 'string' ? { cls: options } : (options ?? {});
		if (opts.cls) for (const cls of Array.isArray(opts.cls) ? opts.cls : [opts.cls]) el.classList.add(cls);
		if (opts.text !== undefined) el.textContent = opts.text;
		if (opts.attr) for (const [key, value] of Object.entries(opts.attr)) el.setAttribute(key, value);
		this.appendChild(el);
		return el;
	};
	proto.empty = function (this: HTMLElement): void {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
	proto.detach = function (this: HTMLElement): void {
		this.parentNode?.removeChild(this);
	};
	proto.setText = function (this: HTMLElement, text: string): void {
		this.textContent = text;
	};
	proto.appendText = function (this: HTMLElement, text: string): void {
		this.appendChild(document.createTextNode(text));
	};
	proto.addClass = function (this: HTMLElement, ...classes: string[]): void {
		this.classList.add(...classes);
	};
	proto.removeClass = function (this: HTMLElement, ...classes: string[]): void {
		this.classList.remove(...classes);
	};
	proto.toggleClass = function (this: HTMLElement, cls: string, on: boolean): void {
		this.classList.toggle(cls, on);
	};
	proto.hasClass = function (this: HTMLElement, cls: string): boolean {
		return this.classList.contains(cls);
	};
	proto.setCssProps = function (this: HTMLElement, props: Record<string, string>): void {
		for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
	};
	// jsdom does not implement scrollIntoView; selection code calls it.
	if (!proto.scrollIntoView) {
		proto.scrollIntoView = function (): void {};
	}
}
