/** The bundle entry for the ESTIMATION view — `page.ts`'s own shape (thin, everything
 *  real reachable from a test), over `mountEstimation.ts` instead of `mount.ts`, so the
 *  estimation view stays permanently lookable: `npm run harness -- test/harness/estimation.ts`. */
import { mountEstimationHarness, EstimationConfigVariant } from './mountEstimation';
import { applyWantedEstimationSelection, drawEstimationMeasurements } from './knobs';
import { applyPlatform, drawSchemeToggle } from './theme';

/**
 * `?config=empty` mounts with nothing bound (the guided empty state); `?config=problems`
 * binds only the business value property (the config-warning state, `.pbl-est-problems`).
 * Anything else — the default — binds all thirteen keys (`estimationOptions()`).
 */
const wantedConfig = new URLSearchParams(window.location.search).get('config');
const config: EstimationConfigVariant = wantedConfig === 'empty' || wantedConfig === 'problems' ? wantedConfig : 'full';

// Before the mount — `page.ts`'s own ordering, kept for the day this view grows a
// toolbar whose own fit measurement needs to see the platform class first.
applyPlatform(window.location.search);

const { view, containerEl } = mountEstimationHarness(document.body, config);

// After the mount — the toggle is the harness's own furniture, appended to the body,
// which `mountEstimationHarness` empties.
drawSchemeToggle();

// `?select=<title>` — the one state a screenshot cannot click its way to: a row
// selected, so the panel beside the table is on screen.
applyWantedEstimationSelection(view, window.location.search);

// After the selection knob: the panel has to be on screen before its type can be read.
if (new URLSearchParams(window.location.search).has('measure')) drawEstimationMeasurements(view);

/** The view and its container, for a throwaway probe pasted into a console — `page.ts`'s own hook. */
(window as unknown as Record<string, unknown>).__pbl = { view, containerEl };
