/** The bundle entry for the MY-WORK view — `release.ts`'s own shape (thin, everything
 *  real reachable from a test), over `mountMyWork.ts`, so the view is lookable at all:
 *  `npm run harness -- test/harness/mywork.ts`. */
import { mountMyWorkHarness } from './mountMyWork';
import { applyPlatform, drawSchemeToggle } from './theme';

const params = new URLSearchParams(window.location.search);

// Before the mount — `release.ts`'s own ordering, kept for the day a control here needs
// to see the platform class first.
applyPlatform(window.location.search);

/**
 * `?width=280` narrows the mounted pane to that many pixels — Task 10's own reason a
 * `<iframe>` or the browser's own window-resize cannot stand in for it: a `.base` tab
 * dragged into the left sidebar is bounded by the LEAF, not by the window, and this
 * harness has no sidebar chrome to drag narrow by hand. Missing, zero or unparsable
 * leaves the pane at the window's own width, which is every other entry's default.
 */
const wantedWidth = Number(params.get('width'));
const width = Number.isFinite(wantedWidth) && wantedWidth > 0 ? wantedWidth : undefined;

const { view, containerEl } = mountMyWorkHarness(document.body, width);

// After the mount — the toggle is the harness's own furniture, appended to the body,
// which `mountMyWorkHarness` empties.
drawSchemeToggle();

/**
 * `?person=People/Ada.md` picks a person through the real `pick`, so it persists exactly
 * as a click's would and the next plain open shows the person last asked for — `release.
 * ts`'s own `?pick=` bargain, over this view's own picker.
 */
const person = params.get('person');
if (person !== null) view.pick(person);

/** The view and its container, for a throwaway probe pasted into a console — every other
 *  entry's own hook. */
(window as unknown as Record<string, unknown>).__pbl = { view, containerEl };
