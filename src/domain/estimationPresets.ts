/**
 * The shipped indicator presets — data only, no imports, `defaultModel.ts`'s own shape and
 * for the same reason: a preset's NAME is written into the `.base`, so it must not depend
 * on which locale wrote it. Everything a reader is shown ABOUT a preset — its description
 * and the line naming what it reads through this model — is catalog text, keyed by id in
 * `view/estimation/presets.ts`.
 *
 * All four are INDICATOR presets, which is why none of them declares a kind: an indicator
 * persists nothing, so applying any of them leaves the value model and every stored total
 * exactly as they were. A value preset is a second kind and a second PBI.
 */
export interface IndicatorPreset {
	id: string;
	name: string;
	operands: string[];
	divisor: string | null;
}

export const INDICATOR_PRESETS: IndicatorPreset[] = [
	{ id: 'rice', name: 'RICE', operands: ['reach', 'business-impact', 'confidence'], divisor: 'effort' },
	// Impact × confidence × EASE, no divisor — the Feature's own definition. Ease is the
	// effort scale reversed on its range, not `1 ÷ effort`, which is a different ranking.
	{ id: 'ice', name: 'ICE', operands: ['business-impact', 'confidence', 'ease'], divisor: null },
	// Cost of delay over job size, read through this model's own value. A vault that
	// declares a cost-of-delay dimension points the operand at it and gets the real thing.
	{ id: 'wsjf', name: 'WSJF', operands: ['value'], divisor: 'effort' },
	{ id: 'value-over-effort', name: 'Value over effort', operands: ['adjustedValue'], divisor: 'effort' },
];
