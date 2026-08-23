/** The bundle entry for the RELEASE view — `estimation.ts`'s own shape (thin, everything
 *  real reachable from a test), over `mountRelease.ts`, so the release view is lookable at
 *  all: `npm run harness -- test/harness/release.ts`. */
import { mountReleaseHarness, ReleaseConfigVariant } from './mountRelease';
import { applyPlatform, drawSchemeToggle } from './theme';

const params = new URLSearchParams(window.location.search);

/**
 * `?config=empty` mounts a base holding no release; `?config=notype` leaves the type
 * property unbound; `?config=nomembership` leaves the membership property unbound.
 * Anything else — the default — binds all seven keys.
 */
const wantedConfig = params.get('config');
const VARIANTS: ReleaseConfigVariant[] = ['empty', 'notype', 'nomembership'];
const config = VARIANTS.includes(wantedConfig as ReleaseConfigVariant) ? (wantedConfig as ReleaseConfigVariant) : 'full';

// Before the mount — `page.ts`'s own ordering, kept for the day this view grows a control
// whose own fit measurement needs to see the platform class first.
applyPlatform(window.location.search);

const { view, containerEl } = mountReleaseHarness(document.body, config);

// After the mount — the toggle is the harness's own furniture, appended to the body,
// which `mountReleaseHarness` empties.
drawSchemeToggle();

/**
 * `?pick=Releases/0.8.md` opens one release's screen — the state a screenshot cannot click
 * its way to, and `?view=` / `?select=`'s own bargain on the other two entries. It goes
 * through `pick`, which is the real gesture, so the pick persists exactly as a click's
 * would and the next plain open shows the release last asked for.
 */
const pick = params.get('pick');
if (pick !== null) view.pick(pick);

/** The view and its container, for a throwaway probe pasted into a console — `page.ts`'s own hook. */
(window as unknown as Record<string, unknown>).__pbl = { view, containerEl };
