# PRD — Business Value Estimation & Prioritization View

*Received 2026-08-16. Kept verbatim as the source the epic "Business value estimation" was
derived from. The register's notes are what this plugin will build; this document is the evidence
they cite, and it is not edited to follow decisions taken after it arrived.*

## 1. Product summary

The Business Value Estimation & Prioritization View is a dedicated view within the product
backlog that enables product teams to assess backlog items using a consistent
multidimensional estimation matrix.

Instead of assigning an arbitrary single "Business Value" number, the view guides users
through a set of value dimensions scored from 1–5 and derives a normalized Business Value
Score.

The view separates:

- Value — Should we want this?
- Urgency — Why should we do it now?
- Confidence — How certain are our assumptions?
- Effort — What will it cost?
- Priority — Given the above, what should we do first?

The objective is not to automate product decisions, but to make the reasoning behind
prioritization explicit, comparable, evidence-based and transparent.

## 2. Problem statement

Product backlog prioritization frequently relies on stakeholder opinion, loosely defined
"business value" fields, urgency, HiPPO decisions, intuition, or implementation estimates.

A single Business Value number hides the reasoning behind the estimate. For example, two
Features may both receive `Business Value = 5` while representing fundamentally different
reasons:

- **Feature A** — high strategic importance, low immediate customer impact, foundational
  enablement.
- **Feature B** — high customer impact, high reach, low strategic importance.

The resulting number therefore provides little information for decision-making.

Furthermore, teams frequently mix business value, urgency, implementation cost, risk, and
confidence into a single priority assessment. This makes prioritization difficult to
explain, reproduce or challenge constructively.

## 3. Product vision

Provide product teams with a lightweight, transparent and evidence-aware method for
estimating the value of backlog items and turning those assessments into informed
prioritization decisions.

The system should make it possible to answer: *why do we believe this item is valuable, how
confident are we in that belief, and how does it compare to other items?*

## 4. Goals

The view shall enable teams to:

1. Evaluate backlog items consistently.
2. Decompose Business Value into understandable dimensions.
3. Compare items using normalized scores.
4. Separate value from implementation effort.
5. Capture uncertainty through Confidence.
6. Make assumptions visible.
7. Attach evidence to estimations.
8. Identify disagreements between estimators.
9. Re-estimate items as knowledge improves.
10. Use estimation results for backlog prioritization.
11. Understand why an item received its score.
12. Maintain an auditable history of estimation decisions.

## 5. Non-goals

The feature shall initially not:

- automatically decide backlog priority,
- replace product management judgment,
- replace effort estimation,
- provide financial forecasting,
- calculate ROI or NPV,
- replace Discovery or User Research,
- require mathematically perfect scoring,
- force all backlog hierarchy levels to use identical dimensions.

The calculated score is decision support, not the decision itself.

## 6. Primary users

**Product Manager / Product Owner** — assess expected value, compare Features, prioritize
the backlog, document assumptions, communicate prioritization decisions.

**Requirements Engineer** — understand expected outcomes, identify weak assumptions,
connect requirements to business objectives, refine value estimates as requirements mature.

**Delivery Manager** — compare value against expected delivery effort, identify
high-value/low-effort opportunities, facilitate prioritization workshops, identify
estimation uncertainty.

**UX / Research** — provide evidence for Customer Value and Reach, challenge unsupported
assumptions, increase Confidence through research.

**Engineering** — understand prioritization rationale, estimate Effort and Complexity,
identify enabling or foundational work.

## 7. Core concept

Each backlog item can have an Estimation Profile.

```text
Backlog Item
    │
    └── Estimation Profile
          │
          ├── Value Dimensions
          │     ├── Strategic Alignment
          │     ├── Customer Value
          │     ├── Business Impact
          │     ├── Reach
          │     ├── Risk Reduction
          │     ├── Compliance
          │     ├── Time Criticality
          │     └── Enablement Value
          │
          ├── Confidence
          │
          ├── Delivery
          │     ├── Effort
          │     └── Complexity
          │
          ├── Evidence
          │
          └── Calculated Scores
```

All estimation dimensions use a 1–5 scale.

## 8. Business value dimensions

### 8.1 Strategic alignment

*How strongly does this item contribute to current strategic objectives?*

| Score | Meaning |
| --- | --- |
| 1 | Marginal or no strategic relevance |
| 2 | Weak contribution |
| 3 | Supports an established objective |
| 4 | Strong contribution to an important objective |
| 5 | Directly enables a top strategic priority |

### 8.2 Customer / user value

*How significantly does this improve the user's ability to accomplish an important job?*

| Score | Meaning |
| --- | --- |
| 1 | Cosmetic / minor convenience |
| 2 | Small improvement |
| 3 | Meaningful improvement |
| 4 | Solves a significant user problem |
| 5 | Enables or fundamentally improves a critical job |

### 8.3 Business impact

*What economic or operational impact could this create?* Consider revenue, cost reduction,
productivity, process efficiency, retention, acquisition.

| Score | Meaning |
| --- | --- |
| 1 | Negligible |
| 2 | Small |
| 3 | Measurable |
| 4 | Significant |
| 5 | Transformational / major impact |

### 8.4 Reach

*How much of the relevant target group is affected?*

| Score | Meaning |
| --- | --- |
| 1 | Very small group |
| 2 | Limited segment |
| 3 | Significant segment |
| 4 | Majority |
| 5 | Nearly all relevant users / processes |

### 8.5 Risk reduction

*How much business, operational or technical risk does this item reduce?*

| Score | Meaning |
| --- | --- |
| 1 | Negligible |
| 2 | Small |
| 3 | Meaningful |
| 4 | Significant |
| 5 | Removes or materially mitigates critical risk |

### 8.6 Compliance / obligation

*To what extent is implementation required by regulation, contract, policy or external
commitment?*

| Score | Meaning |
| --- | --- |
| 1 | Completely optional |
| 2 | Internal preference |
| 3 | Important commitment |
| 4 | Strong contractual / policy requirement |
| 5 | Mandatory / legal requirement |

### 8.7 Time criticality

*How significantly does delaying implementation reduce its value or increase negative
consequences?*

| Score | Meaning |
| --- | --- |
| 1 | No meaningful time pressure |
| 2 | Can reasonably wait |
| 3 | Delay has measurable consequences |
| 4 | Strong timing dependency |
| 5 | Hard deadline or rapidly decaying value |

### 8.8 Enablement value

*How much additional valuable work does this item unlock?*

| Score | Meaning |
| --- | --- |
| 1 | Standalone |
| 2 | Minor dependencies |
| 3 | Enables several items |
| 4 | Important platform capability |
| 5 | Foundational prerequisite for major capabilities |

## 9. Confidence

Confidence must remain separate from Business Value.

*How strong is the evidence supporting this estimation?*

| Score | Evidence |
| --- | --- |
| 1 | Assumption |
| 2 | Anecdotal evidence |
| 3 | Qualitative evidence |
| 4 | Quantitative evidence |
| 5 | Validated / observed evidence |

The UI should make low-confidence / high-value items particularly visible. `Business Value:
4.7 / 5` with `Confidence: 1 / 5` communicates something fundamentally different from the
same value with `Confidence: 5 / 5`.

## 10. Delivery dimensions

Delivery characteristics must not influence the Business Value calculation.

**Effort** — relative expected implementation cost: 1 Very small, 2 Small, 3 Medium,
4 Large, 5 Very large.

**Complexity / delivery risk** — expected difficulty and uncertainty of implementation:
1 Well understood, 2 Low complexity, 3 Moderate complexity, 4 Significant unknowns,
5 Highly complex / uncertain.

## 11. Scoring model

The initial default weighting is:

| Dimension | Weight |
| --- | --- |
| Strategic Alignment | 20% |
| Customer Value | 20% |
| Business Impact | 15% |
| Reach | 10% |
| Risk Reduction | 10% |
| Compliance | 10% |
| Time Criticality | 10% |
| Enablement Value | 5% |

Weights must be configurable. The weights must total 100%.

`Business Value = Σ(Dimension Score × Dimension Weight)`, normalized to 1.00–5.00.

Example:

```text
Strategic Alignment  5 × 0.20 = 1.00
Customer Value       4 × 0.20 = 0.80
Business Impact      4 × 0.15 = 0.60
Reach                3 × 0.10 = 0.30
Risk Reduction       2 × 0.10 = 0.20
Compliance           1 × 0.10 = 0.10
Time Criticality     4 × 0.10 = 0.40
Enablement           3 × 0.05 = 0.15
Business Value = 3.55
```

## 12. Confidence-adjusted value

The system may additionally calculate `Confidence Factor = Confidence / 5` and
`Confidence-Adjusted Value = Business Value × Confidence Factor`.

However, this value should not replace Business Value. Both should remain visible. A low
Confidence score represents uncertainty, not necessarily low value.

## 13. Priority / value-to-effort

The view should provide an optional derived indicator:
`Value-to-Effort = Confidence-Adjusted Value / Effort`.

This enables rough comparison of opportunities. The system must avoid presenting this as an
objectively correct priority. Instead, it should be labeled as a Prioritization Indicator.

## 14. Estimation view

Selecting Estimate on a backlog item opens the Estimation View.

```text
┌─────────────────────────────────────────────────────┐
│ Feature: Automated Invoice Reconciliation           │
│                                                     │
│ Business Value     4.2 / 5        Confidence  3/5   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ VALUE                                               │
│                                                     │
│ Strategic Alignment    ● ● ● ● ●    5               │
│ Customer Value         ● ● ● ● ○    4               │
│ Business Impact        ● ● ● ● ○    4               │
│ Reach                  ● ● ● ○ ○    3               │
│ Risk Reduction         ● ● ○ ○ ○    2               │
│ Compliance             ● ○ ○ ○ ○    1               │
│ Time Criticality       ● ● ● ● ○    4               │
│ Enablement             ● ● ● ○ ○    3               │
│                                                     │
├─────────────────────────────────────────────────────┤
│ EVIDENCE                                            │
│                                                     │
│ Confidence             ● ● ● ○ ○    3               │
│                                                     │
│ Research:  Customer interviews                      │
│ Analytics: Invoice processing analysis              │
│                                                     │
├─────────────────────────────────────────────────────┤
│ DELIVERY                                            │
│                                                     │
│ Effort                 ● ● ● ● ○    4               │
│ Complexity             ● ● ● ○ ○    3               │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Business Value                     4.2              │
│ Confidence Adjusted Value          2.5              │
│ Value / Effort                     0.63             │
└─────────────────────────────────────────────────────┘
```

Changing a score recalculates results immediately.

## 15. Scoring interaction

Each dimension should be displayed as an interactive 1–5 selector. Hovering or selecting a
value displays its semantic definition:

```text
Customer Value
1      2      3      4      5
○      ○      ○      ●      ○
4 — Solves a significant user problem
```

This is important because users should estimate against defined criteria, rather than
interpreting numbers independently.

## 16. Evidence

An estimation should be capable of referencing supporting evidence: customer interviews,
analytics, research, business cases, strategic objectives, contracts, incidents,
experiments, stakeholder feedback, linked backlog items, external documents.

Each evidence item should contain at minimum: Type, Title, Reference / URL, optional note.

The system should encourage evidence particularly when a dimension receives a score of 4
or 5.

## 17. Estimation rationale

Users should be able to provide a short rationale per dimension:

```text
Customer Value: 5
Rationale:
Invoice reconciliation currently requires approximately
20 minutes of manual work per invoice.
Evidence:
→ Finance Process Analysis
→ User Interview FIN-023
```

Rationale is optional for normal scores but should be encouraged for extreme scores.

## 18. Backlog integration

Business Value must be visible directly from the backlog.

| Item | Value | Confidence | Effort | Priority indicator |
| --- | --- | --- | --- | --- |
| Automated Reconciliation | 4.6 | 4 | 3 | High |
| Reporting Export | 3.2 | 5 | 2 | High |
| Dashboard Redesign | 3.8 | 2 | 4 | Low |
| Regulatory Export | 4.1 | 5 | 5 | Medium |

Columns must be sortable. Users must be able to filter by Business Value, Confidence,
Effort, individual dimensions, and estimation status.

## 19. Value vs. effort matrix

The view should provide a portfolio visualization:

```text
HIGH VALUE
    │
    │  Strategic Bets       Quick Wins
    │
    │      ●                   ● ●
    │
    │
    │      ●                    ●
    │
    │  Reconsider            Fill-ins
    │
    └────────────────────────────────
          HIGH EFFORT        LOW EFFORT
```

Each point represents a backlog item. Selecting a point opens the item. This enables teams
to identify Quick Wins, Strategic Investments, low-value work and disproportionately
expensive items without turning the matrix into an automatic prioritization mechanism.

## 20. Confidence visualization

The system should explicitly surface:

- **High value / high confidence** — likely candidates for prioritization.
- **High value / low confidence** — candidates for Discovery.
- **Low value / high confidence** — candidates for deprioritization.
- **Low value / low confidence** — potential candidates for removal or further
  investigation.

This creates an important connection between Discovery and Delivery. A high-value /
low-confidence Feature does not necessarily need implementation next. It may need research
next.

## 21. Estimation status

Every estimatable item receives an estimation lifecycle:

```text
Not Estimated → Draft → Estimated → Validated → Needs Re-estimation
```

Changes to important underlying information may mark an estimation as Needs Re-estimation.

## 22. Estimation history

The system should retain estimation history. Each revision records timestamp, estimator,
dimension values, calculated Business Value, Confidence, Effort, rationale.

```text
May 04
Value 3.4 → 4.2
Confidence 2 → 4
Reason:
Customer research completed.
```

This provides traceability and helps teams understand how product knowledge develops.

## 23. Hierarchy and inheritance

Different backlog levels may use different estimation dimensions.

| Dimension | Epic | Feature | PBI / Use case |
| --- | --- | --- | --- |
| Strategic Alignment | ✓ | inherited | inherited |
| Customer Value | ✓ | ✓ | ✓ |
| Business Impact | ✓ | ✓ | optional |
| Reach | ✓ | ✓ | ✓ |
| Risk Reduction | ✓ | ✓ | optional |
| Compliance | ✓ | ✓ | inherited |
| Time Criticality | ✓ | ✓ | ✓ |
| Enablement | ✓ | ✓ | ✓ |
| Confidence | ✓ | ✓ | ✓ |
| Effort | Rough | ✓ | ✓ |

Inherited values must visually indicate their source:

```text
Strategic Alignment
5 / 5
↑ inherited from Epic "Finance Automation"
```

A product configuration may determine which dimensions are required, optional, inherited or
disabled for each backlog item type.

## 24. Configuration

Administrators / Product Managers should be able to configure an Estimation Model.

```yaml
name: Default Product Value Model
dimensions:
  strategic_alignment:
    enabled: true
    weight: 20
  customer_value:
    enabled: true
    weight: 20
  business_impact:
    enabled: true
    weight: 15
  reach:
    enabled: true
    weight: 10
  risk_reduction:
    enabled: true
    weight: 10
  compliance:
    enabled: true
    weight: 10
  time_criticality:
    enabled: true
    weight: 10
  enable
```

*(The document as received ends here, mid-key. Nothing after this point was supplied, and
nothing has been invented to complete it.)*
