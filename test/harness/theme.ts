/**
 * What the page tells the plugin's stylesheet about its environment: the colour scheme,
 * and whether this is a phone. Both are a body class in Obsidian and nothing more, which
 * is why they belong together and why a URL can ask for either.
 *
 * The scheme first.
 *
 * Obsidian marks the scheme with `theme-dark` / `theme-light` on the body and swaps the
 * variables under it; the stub (`theme.css`) is built the same way, so applying the class
 * is the whole mechanism. The plugin's partials read the variables and never name a
 * scheme — checked, not assumed: no `theme-dark`, `theme-light` or `prefers-color-scheme`
 * appears anywhere in `styles/`. So this switches the page without the view knowing, which
 * is exactly what makes it worth looking at both ways: anything that only reads in one
 * scheme is the plugin's own contrast to answer for, not the theme's.
 *
 * `?theme=light` opens straight into one, for the same reason `?view=roadmap` exists: a
 * headless screenshot of a URL needs nothing to click, which is what keeps ADR 0020's
 * refusal of a browser-automation dependency cheap rather than merely principled.
 *
 * The toggle is the HARNESS's furniture, not the view's — it is drawn outside the
 * mounted view and marked as such, because a control in a screenshot that nobody can
 * find in the plugin is worse than no control at all.
 */
type Scheme = 'dark' | 'light';

const SCHEMES: Scheme[] = ['dark', 'light'];

/** `?theme=light`, else dark — the app's own default, and the stub's original one. */
function wantedScheme(search: string): Scheme {
	const asked = new URLSearchParams(search).get('theme');
	return SCHEMES.find((scheme) => scheme === asked) ?? 'dark';
}

/**
 * `?phone` — the phone body classes, so the rules keyed on them can be looked at.
 *
 * Obsidian's app shell puts BOTH `is-mobile` and `is-phone` on the body of a phone, and
 * both earn their place here: `styles/manual.css`'s seven phone rules key on `.is-phone`,
 * and the vendored sheet's own `.is-mobile` block redefines a batch of variables (the
 * modal radius, the touch sizes) that everything else then reads. Until now neither class
 * appeared anywhere in the page, so every rule written for a phone was unreachable in the
 * one tool built for looking — including the manual's stacked layout, which exists
 * because a fixed 190px sidebar crushes the pane on a narrow screen.
 *
 * It is a class switch and no more: the viewport is still the browser window, the input is
 * still a mouse, and `styles/touch.css` keys on `@media (hover: none)` rather than on a
 * class, so nothing in that partial is reached from here — a browser's own device
 * emulation is what answers those, and a real device is what answers the gestures
 * ([[Finding 2 — the touch path is decided, built, and has never met a device]]).
 * Applied before the mount, not after, because the toolbar measures itself as it draws.
 */
export function applyPlatform(search: string): void {
	const phone = new URLSearchParams(search).has('phone');
	// `classList`, not `toggleClass` — Obsidian's prototype extensions are installed by
	// `mountHarness`, which has not run yet at the one call site that matters. The suite
	// cannot see that: every jsdom file calls `installObsidianDom()` at module top, so
	// `toggleClass` here passed the test and would have thrown on the real page, taking
	// the whole mount with it. `applyScheme` below runs after the mount and is fine.
	document.body.classList.toggle('is-mobile', phone);
	document.body.classList.toggle('is-phone', phone);
}

function applyScheme(scheme: Scheme): void {
	document.body.toggleClass('theme-dark', scheme === 'dark');
	document.body.toggleClass('theme-light', scheme === 'light');
}

/**
 * Draw the switch — the module's whole surface, since nothing outside the page needs to
 * ask for a scheme. The suite checks the STUB rather than the switching (that both
 * schemes define what the partials read), and a browser asks by URL.
 */
export function drawSchemeToggle(): void {
	let scheme = wantedScheme(window.location.search);
	applyScheme(scheme);

	const btn = document.body.createEl('button', {
		cls: 'pbl-harness-scheme',
		attr: { type: 'button' },
	});
	const label = () => {
		btn.setText(scheme === 'dark' ? 'Harness: dark' : 'Harness: light');
		btn.setAttribute('aria-label', `Switch the harness to ${scheme === 'dark' ? 'light' : 'dark'}`);
	};
	label();
	btn.addEventListener('click', () => {
		scheme = scheme === 'dark' ? 'light' : 'dark';
		applyScheme(scheme);
		label();
	});
}
