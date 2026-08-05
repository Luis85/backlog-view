/**
 * Which colour scheme the page draws in, and the control that switches it.
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
