/** The shipped default model — data only. Rubric sentences are persisted into the
 * `.base` fingerprint, so they are DATA, not catalog text (two locales must not
 * write two models). Source: the PRD of 2026-08-16, kept verbatim in docs/prds/. */
export const DEFAULT_DIMENSIONS: { id: string; label: string; weight: number; rubric: string[] }[] = [
	{ id: 'strategic-alignment', label: 'Strategic alignment', weight: 20, rubric: [
		'Marginal or no strategic relevance', 'Weak contribution', 'Supports an established objective',
		'Strong contribution to an important objective', 'Directly enables a top strategic priority'] },
	{ id: 'customer-value', label: 'Customer value', weight: 20, rubric: [
		'Cosmetic or minor convenience', 'Small improvement', 'Meaningful improvement',
		'Solves a significant user problem', 'Enables or fundamentally improves a critical job'] },
	{ id: 'business-impact', label: 'Business impact', weight: 15, rubric: [
		'Negligible', 'Small', 'Measurable', 'Significant', 'Transformational or major impact'] },
	{ id: 'reach', label: 'Reach', weight: 10, rubric: [
		'Very small group', 'Limited segment', 'Significant segment', 'Majority',
		'Nearly all relevant users or processes'] },
	{ id: 'risk-reduction', label: 'Risk reduction', weight: 10, rubric: [
		'Negligible', 'Small', 'Meaningful', 'Significant', 'Removes or materially mitigates critical risk'] },
	{ id: 'compliance', label: 'Compliance', weight: 10, rubric: [
		'Completely optional', 'Internal preference', 'Important commitment',
		'Strong contractual or policy requirement', 'Mandatory or legal requirement'] },
	{ id: 'time-criticality', label: 'Time criticality', weight: 10, rubric: [
		'No meaningful time pressure', 'Can reasonably wait', 'Delay has measurable consequences',
		'Strong timing dependency', 'Hard deadline or rapidly decaying value'] },
	{ id: 'enablement', label: 'Enablement', weight: 5, rubric: [
		'Standalone', 'Minor dependencies', 'Enables several items',
		'Important platform capability', 'Foundational prerequisite for major capabilities'] },
];

export function defaultDimension(id: string): { label: string; weight: number; rubric: string[] } | null {
	return DEFAULT_DIMENSIONS.find((d) => d.id === id) ?? null;
}

export const DEFAULT_SCALE_RUBRICS: Record<'confidence' | 'effort' | 'complexity', string[]> = {
	confidence: ['Assumption', 'Anecdotal evidence', 'Qualitative evidence', 'Quantitative evidence', 'Validated or observed evidence'],
	effort: ['Very small', 'Small', 'Medium', 'Large', 'Very large'],
	complexity: ['Well understood', 'Low complexity', 'Moderate complexity', 'Significant unknowns', 'Highly complex or uncertain'],
};

/** The 13 suggested bindings the guided empty state adopts — option id, suggested key, spoken label. */
export const SUGGESTED_KEYS: { option: string; suggested: string; label: string }[] = [
	...DEFAULT_DIMENSIONS.map((d) => ({ option: `dimProperty.${d.id}`, suggested: d.id, label: d.label.toLowerCase() })),
	{ option: 'confidenceProperty', suggested: 'confidence', label: 'confidence' },
	{ option: 'effortProperty', suggested: 'effort', label: 'effort' },
	{ option: 'complexityProperty', suggested: 'complexity', label: 'complexity' },
	{ option: 'valueProperty', suggested: 'business-value', label: 'business value' },
	{ option: 'stampProperty', suggested: 'business-value-model', label: 'business value model stamp' },
];
