# PRD — Backlog View as a modular product management toolkit

*Received 2026-08-16. Kept verbatim as the source the epics derived from it cite. The
register's notes are what this plugin will build; this document is the evidence, and it is
not edited to follow decisions taken after it arrived.*

**Product** — Backlog View.
**Product type** — Obsidian plugin extending Obsidian Bases with dedicated
product-management view types.
**Status** — Product direction / capability expansion.

## Purpose of this PRD

This PRD defines the evolution of Backlog View from a backlog-oriented Obsidian Bases view
into a modular, local-first product management toolkit.

The central architectural principle is: **every major product-management capability is
implemented as its own Obsidian Bases view.** Users therefore opt into exactly the
capabilities they need by adding the corresponding view to a Base. A Base may consequently
contain several different Backlog View projections over the same underlying Markdown notes
and properties.

```
Product.base
│
├── Product Backlog
├── Discovery
├── Prioritization
├── Strategy
├── Roadmap
├── Release Planning
└── Backlog Health
```

All views operate on the same underlying vault data. The plugin must not create a
proprietary database or hidden product model. Markdown notes, Obsidian properties, links,
tags, and Bases remain the source of truth.

## 1. Product vision

Backlog View turns an Obsidian vault into a local-first product management environment
connecting:

```
Product Knowledge → Strategy → Discovery → Evidence → Prioritization
→ Planning → Backlog → Delivery → Review
```

The plugin should support the work of Product Owners, Product Managers, Requirements
Engineers, Delivery Managers, founders, and small product teams without attempting to
become a generic enterprise project-management suite.

Backlog View should particularly leverage capabilities intrinsic to Obsidian: Markdown as
durable source of truth, properties as structured metadata, links as relationships, Bases
as structured projections, user-owned local data, extensibility through multiple views, and
interoperability with the wider Obsidian ecosystem.

## 2. Product positioning

Backlog View is not intended to compete primarily with generic task-management tools. The
product should instead occupy the space between Knowledge Management, Product Discovery,
Product Strategy, Prioritization, Product Planning and Backlog Management.

The distinguishing proposition is: **product decisions remain directly connected to the
knowledge, evidence, requirements, decisions, and documentation that justify them.**

A Feature can therefore be connected directly to objectives, Jobs-to-be-Done, customer
feedback, research notes, decisions, assumptions, requirements, architecture, releases and
backlog children — without moving that information into another SaaS platform.

## 3. Product principles

**3.1 Local-first.** All meaningful product information must remain inside the vault. No
hosted backend should be required.

**3.2 Markdown remains authoritative.** The plugin must not introduce a hidden database
that becomes necessary to interpret the backlog. Views derive their state from notes,
frontmatter/properties, links, folders where configured, and Base configuration.

**3.3 Views over workflows.** The plugin should avoid imposing one universal
product-development methodology. Instead it provides specialized views over the same
product model.

**3.4 Opt-in complexity.** A user who only wants a backlog should only need the Product
Backlog view. A more mature product team may progressively add Prioritization, Discovery,
Strategy, Release Planning and Health. No capability should make unrelated views harder to
configure.

**3.5 Progressive configuration.** Every view must work with sensible defaults while
allowing advanced teams to configure property mappings, supported types, status values,
scoring models, relationships, thresholds, visible columns, grouping, filters and behavior.

**3.6 Native Obsidian experience.** The plugin should feel like an extension of Bases
rather than a standalone application embedded inside Obsidian. Where Obsidian already
provides functionality, Backlog View should reuse it rather than recreate it.

## 4. Conceptual product model

The plugin operates on generic Markdown entities. Typical types may include Objective,
Outcome, Opportunity, Idea, Assumption, Evidence, Decision, Release, Milestone, Epic,
Feature, PBI, Task, Bug, Issue, Deliverable.

Backlog hierarchy remains configurable. Default: `Epic → Feature → PBI → Task`.
Alternative configurations may include `Initiative → Epic → Story` or
`Product → Capability → Feature → Use Case`.

Views must therefore rely on configured semantics rather than hard-coded workflow
assumptions wherever practical.

## 5. Shared view architecture

Every capability defined below should become a dedicated view type registered with Obsidian
Bases.

```yaml
views:
  - type: product-backlog
    name: Backlog
  - type: product-prioritization
    name: Prioritization
  - type: product-discovery
    name: Discovery
  - type: product-strategy
    name: Strategy
  - type: product-roadmap
    name: Roadmap
  - type: product-release
    name: Releases
  - type: product-health
    name: Health
```

Each view owns its own configuration. A configuration required by one view must not force
another view to enable the same capability. Common configuration utilities may nevertheless
be shared internally.

## 6. Epic overview

| Epic | Dedicated Bases view | Purpose |
| --- | --- | --- |
| E01 Product Backlog | Product Backlog | Structure and manage product work |
| E02 Discovery | Discovery | Manage ideas, opportunities, assumptions, and validation |
| E03 Prioritization | Prioritization | Compare and rank product investments |
| E04 Strategy | Strategy | Connect backlog work to objectives and outcomes |
| E05 Evidence | Evidence | Connect product decisions to supporting knowledge |
| E06 Roadmap | Roadmap | Plan product direction over time |
| E07 Release Planning | Release Planning | Compose and evaluate releases |
| E08 Dependencies | Dependencies | Understand sequencing and blockers |
| E09 Portfolio | Portfolio | View product work across higher-order structures |
| E10 Backlog Health | Backlog Health | Detect quality, governance, and maintenance problems |
| E11 Analytics | Product Analytics | Understand backlog composition and trends |
| E12 Decision Management | Decisions | Preserve reasoning behind product choices |

Existing functionality should progressively be aligned with these view boundaries.

## 7. E01 — Product Backlog view

**Objective** — provide the operational work-item hierarchy and primary backlog management
experience. This remains the foundational view of the plugin.

**User job** — when I manage product requirements and work items, I want to organize them
into a clear hierarchy so that I can understand scope, order, state, and relationships.

**Feature 1.1 — Configurable backlog hierarchy.** Support configurable hierarchy levels
(default `Epic → Feature → PBI → Task`). Users must be able to configure alternative level
names. Requirements: configure level names; configure allowed child types; determine visual
indentation from hierarchy; support items without explicit type where hierarchy can infer
it; retain existing folder-based inference capability; support extra non-hierarchical
types.

**Feature 1.2 — Hierarchical tree.** Display items as an expandable tree. Support expand,
collapse, expand all, collapse all, row selection, keyboard navigation, open note, open in
new pane, context actions.

**Feature 1.3 — Drag-and-drop structure management.** Users can reorder siblings, re-parent
items, move items to root level, restore folder-derived hierarchy where enabled. Changes
update Markdown properties.

**Feature 1.4 — Work item creation.** Users can create top-level items, child items and
alternative item types. Creation must automatically populate configured structural
properties.

**Feature 1.5 — Inline properties.** Visible Base properties become aligned columns.
Support text, numbers, tags, states, dates, links, configurable property widths.

**Feature 1.6 — Workflow state.** Support configurable workflow states, e.g. New, Designed,
Scoped, Tech Refined, Estimated, Ready, In Progress, Implemented, Tested, Done, Shipped,
Deferred. The view must allow state changes without opening the note.

**Feature 1.7 — Progress roll-up.** Parent items calculate progress from descendants
(`3 / 8`, `38%`). Completion rules are configurable.

**Feature 1.8 — Backlog filtering.** Support text search, type filters, state filters,
property filters inherited from Bases, hide completed work, focus on one hierarchy level.

**Feature 1.9 — Bulk operations.** Allow multi-selection and operations such as set state,
set property, assign milestone, assign release, add tag, change type, archive, move.

**Feature 1.10 — Undo.** All plugin-initiated structural and property mutations should
participate in an undo mechanism where technically feasible.

## 8. E02 — Discovery view

**Objective** — provide an environment for managing work before it becomes committed
backlog scope.

**User job** — when new ideas, problems, and opportunities emerge, I want to develop and
validate them before committing them to the backlog.

Core discovery lifecycle (configurable):
`Captured → Idea → Opportunity → Discovery → Validated → Candidate → Planned`.

**Feature 2.1 — Discovery board.** A board grouped by discovery state. Cards may represent
Idea, Opportunity, Problem, Assumption, Experiment. Users can drag cards between states.

**Feature 2.2 — Idea inbox.** A lightweight capture area for unprocessed ideas: quick
create, title, description, tags, source, date created, author if available, related notes.

**Feature 2.3 — Opportunity management.** Allow Ideas to evolve into structured
Opportunities. Suggested properties: `type: Opportunity`, `problem`, `customer`, `impact`,
`evidence`, `status`, `owner`.

**Feature 2.4 — Assumption tracking.** Users can capture assumptions associated with an
opportunity: value, usability, feasibility, viability assumptions.

**Feature 2.5 — Validation state.** Track whether assumptions or opportunities are Unknown,
Testing, Supported, Rejected, Inconclusive.

**Feature 2.6 — Candidate promotion.** A validated opportunity may be promoted into an
Epic, Feature, PBI or configured backlog type. The original discovery item remains linked to
the generated backlog item.

**Feature 2.7 — Discovery readiness.** Show whether an opportunity has sufficient
information to move forward:

```
Problem defined            ✓
Target user identified     ✓
Evidence attached          ✓
Assumptions captured       ✓
Validation complete        ⚠
Expected outcome defined   ✕
```

## 9. E03 — Prioritization view

**Objective** — provide systematic, transparent comparison of product investments.

**User job** — when competing product opportunities exceed available capacity, I want to
compare them using explicit criteria so that prioritization is explainable and repeatable.

**Feature 3.1 — Configurable scoring model.** Users define scoring dimensions (Strategic
Alignment, Customer Value, Revenue Impact, Risk Reduction, Time Criticality, Confidence,
Effort). Each dimension may define property, range, weight, direction, description.

**Feature 3.2 — Estimation matrix.** Support configurable 1–5 matrices:

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Customer Value | negligible | moderate | transformational |
| Strategic Alignment | unrelated | supports | critical |
| Revenue Impact | none | meaningful | significant |
| Risk Reduction | none | moderate | existential |

The view should explain what each score represents.

**Feature 3.3 — Weighted score.** Calculate `Σ dimension score × dimension weight`. Users
can define the formula or choose a preset.

**Feature 3.4 — Prioritization presets.** Optional templates for common frameworks: Value /
Effort, RICE, ICE, WSJF, weighted score. Presets only configure properties and
calculations. They must not impose methodology on other views.

**Feature 3.5 — Prioritized list.** Display items ordered by calculated priority. Columns
may include Rank, Item, Value, Effort, Confidence, Score, State.

**Feature 3.6 — Value/effort matrix.** A two-dimensional plotting view. Default quadrants:
Quick Wins, Strategic Bets, Fill-ins, Avoid / Reconsider. X and Y properties must be
configurable.

**Feature 3.7 — Scenario planning.** Allow alternative prioritization configurations
without permanently rewriting source properties. Example scenarios: Balanced, Growth,
Compliance, Customer Retention, Cost Reduction. Each scenario may apply different weighting.

**Feature 3.8 — Priority explanation.** Selecting an item displays the score decomposition:

```
Overall Score: 73
Strategic Alignment     5 × 25%
Customer Value          4 × 25%
Revenue Impact          3 × 20%
Risk Reduction          4 × 15%
Confidence              4 × 15%
```

## 10. E04 — Strategy view

**Objective** — connect product work to strategic intent.

**User job** — when reviewing product investments, I want to understand which objectives
and outcomes they support so that the backlog reflects strategy rather than accumulating
disconnected requests.

**Feature 4.1 — Strategic entity types.** Support optional types such as Vision, Theme,
Objective, Outcome, OKR, JTBD, Initiative. Users configure which types participate.

**Feature 4.2 — Strategy hierarchy.** Display strategic relationships, e.g.
`Objective → Outcome → Initiative → Epic → Feature`.

**Feature 4.3 — Backlog alignment.** Display which backlog items support each strategic
entity.

**Feature 4.4 — Unaligned work detection.** Identify work without strategic linkage
(`42 backlog items, 37 aligned, 5 unaligned`).

**Feature 4.5 — Strategy coverage.** Display how much work is associated with each
Objective:

```
Improve Retention       █████████████ 42%
Reduce Cost             ███████       23%
Increase Conversion     █████████     31%
Other                   █              4%
```

**Feature 4.6 — JTBD mapping.** Allow backlog items to reference Jobs-to-be-Done. The
Strategy view should provide, per JTBD, its related opportunities, features and evidence.

## 11. E05 — Evidence view

**Objective** — connect product decisions to supporting knowledge contained in the vault.

**User job** — when deciding whether to invest in a feature, I want to see the evidence
behind it so that decisions are grounded in observed problems rather than opinion alone.

**Feature 5.1 — Evidence links.** Backlog and discovery items may reference evidence notes:

```yaml
evidence:
  - "[[Customer Interview — ACME]]"
  - "[[Support Analysis Q3]]"
  - "[[Sales Call — Globex]]"
```

**Feature 5.2 — Evidence types.** Users may configure categories such as Interview,
Customer Request, Analytics, Support Ticket, Sales Feedback, Research, Observation,
Experiment, Market Research.

**Feature 5.3 — Evidence explorer.** An Evidence view showing relationships between
Evidence → Opportunity → Feature → Objective.

**Feature 5.4 — Evidence strength.** Allow evidence items to carry optional strength or
confidence (Weak, Moderate, Strong, or numeric scoring).

**Feature 5.5 — Evidence coverage.** Identify opportunities with no evidence, Features with
no evidence, evidence not linked to product decisions, and heavily supported opportunities.

**Feature 5.6 — Evidence summary.** For a selected Feature:

```
Evidence
12 customer requests
4 support incidents
3 interviews
2 sales opportunities
1 analytics observation
```

Counts derive from linked notes.

## 12. E06 — Roadmap view

**Objective** — visualize intended product direction over time without turning the plugin
into a detailed project scheduler.

**User job** — when communicating product direction, I want to place initiatives and
Features into time horizons so that stakeholders can understand sequencing and intent.

**Feature 6.1 — Now / Next / Later.** Support horizon planning (Now, Next, Later,
Unplanned). Horizons are configurable.

**Feature 6.2 — Timeline roadmap.** Time-based positioning using configured dates: start
date, target date, milestone, release.

**Feature 6.3 — Roadmap grouping.** Allow grouping by Objective, Epic, Product, Domain,
Team, Release or custom property.

**Feature 6.4 — Roadmap dragging.** Allow moving items between horizons or date ranges
where suitable. Changes update configured properties.

**Feature 6.5 — Unplanned work.** Clearly surface backlog items without roadmap placement.

**Feature 6.6 — Roadmap filters.** Allow roadmap slicing by type, objective, status,
release, tags, owner, arbitrary Base filters.

## 13. E07 — Release planning view

**Objective** — compose product releases and evaluate readiness.

**User job** — when preparing a release, I want to understand its scope, size, progress,
risk, and unresolved work so that release decisions are explicit.

**Feature 7.1 — Release entity.** Support Release notes:

```yaml
type: Release
version: 2.4
target-date: 2026-11-15
status: Planned
```

**Feature 7.2 — Release scope.** Allow work items to reference a Release, and display the
release's contents as a tree.

**Feature 7.3 — Release summary.** Show items, estimated effort, completed effort,
progress, open blockers, risks, unestimated work.

**Feature 7.4 — Release capacity.** Optionally configure capacity:

```
Capacity       320
Committed      347
Difference     +27
Utilization    108%
```

Units are configurable: Story Points, Person Days, Ideal Days, custom points.

**Feature 7.5 — Scope scenario.** Allow users to temporarily add/remove items from a
release scenario, showing resulting capacity, value, risk and dependency impact without
immediately persisting the scenario.

**Feature 7.6 — Release readiness.** Evaluate configurable readiness criteria:

```
All items estimated       ✓
Dependencies resolved     ⚠
Critical risks addressed  ✓
Required testing complete ✕
```

## 14. E08 — Dependency view

**Objective** — visualize product dependencies and blocking relationships.

**User job** — when planning product work, I want to understand which items depend on
others so that sequencing and blockers are visible.

**Feature 8.1 — Dependency properties.** Support configurable relationship properties
(`depends-on`, `blocks`). Only one canonical direction may be necessary internally.

**Feature 8.2 — Dependency graph.** Display relationships as nodes and edges.

**Feature 8.3 — Dependency list.** Alternative table/list projection: Item, Depends On,
Blocks, Dependency Status.

**Feature 8.4 — Blocked item detection.** An item is considered blocked when configured
dependencies fail configured readiness conditions.

**Feature 8.5 — Circular dependency detection.** Detect `A → B → C → A` and expose the
conflict.

**Feature 8.6 — Critical dependency highlighting.** Highlight dependency chains affecting
releases, milestones, high-priority work and objectives.

## 15. E09 — Portfolio view

**Objective** — support users managing multiple products, domains, workstreams, or
higher-order initiatives.

**User job** — when I oversee several product areas, I want to aggregate their work into
one portfolio perspective without changing how individual teams structure their backlog.

**Feature 9.1 — Configurable portfolio levels**, e.g. `Portfolio → Product → Domain → Epic`.

**Feature 9.2 — Portfolio roll-up.** Aggregate progress, item count, value, effort, release
distribution, health, risk.

**Feature 9.3 — Cross-product prioritization.** Allow selected portfolio items to
participate in the Prioritization engine.

**Feature 9.4 — Portfolio roadmap.** Aggregated roadmap grouping by Product or Domain.

**Feature 9.5 — Portfolio filtering.** Allow narrowing to Product, Domain, Owner,
Objective, Release, Status.

## 16. E10 — Backlog health view

**Objective** — continuously expose structural, qualitative, and governance problems in the
product backlog.

**User job** — when maintaining a backlog over time, I want to see which items are
incomplete, stale, disconnected, or structurally invalid so that the backlog remains
trustworthy.

**Feature 10.1 — Health rules engine.** Configurable health rules: missing parent, missing
type, missing estimate, missing state, missing owner, missing objective, missing evidence,
missing acceptance criteria, missing release, invalid hierarchy, circular dependency, stale
item, orphaned item, oversized item, empty Epic.

**Feature 10.2 — Health score.** Optional aggregate (`Backlog Health 82 / 100`). Scoring
must remain explainable.

**Feature 10.3 — Health dashboard.**

```
Structural Integrity     96%
Estimation Coverage      84%
Strategic Alignment      73%
Evidence Coverage        61%
Backlog Freshness        78%
```

**Feature 10.4 — Issue explorer.** List detected issues with severity, rule, item,
explanation, suggested action.

**Feature 10.5 — Quick fixes.** Where safe, allow direct remediation: assign missing type,
initialize property, archive stale item, set parent, assign release. No speculative
destructive correction should occur automatically.

**Feature 10.6 — Definition of ready.** Configurable readiness criteria (problem defined,
acceptance criteria present, estimate present, dependencies known, design complete,
technical refinement complete). The view can identify which items satisfy the configured
DoR.

## 17. E11 — Product analytics view

**Objective** — provide lightweight analytical insight derived directly from the backlog.
This is product/backlog analytics, not runtime product telemetry.

**Feature 11.1 — Backlog composition.** Counts by type, state, objective, release, owner,
tags, horizon.

**Feature 11.2 — Backlog aging.** Group by age: 0–30 days, 31–90, 91–180, 181–365, 365+.

**Feature 11.3 — Stale work.** Identify items with no meaningful modification for a
configured period.

**Feature 11.4 — Throughput.** Where timestamps are available, show items completed over
time.

**Feature 11.5 — Cycle time.** Where workflow timestamps exist, calculate elapsed time
between configured states (Ready → Done, In Progress → Done, Discovery → Validated).

**Feature 11.6 — WIP distribution.** Show current work by workflow stage.

**Feature 11.7 — Estimation distribution.** Display Unestimated, Small, Medium, Large, Very
Large, or numerical distributions.

## 18. E12 — Decision management view

**Objective** — preserve significant product decisions and their context.

**User job** — when priorities or plans change, I want to preserve why the decision was
made so that future discussions have context.

**Feature 12.1 — Decision entity.** Support Markdown notes such as `type: Decision`,
`date: 2026-08-16`, `status: Accepted`.

**Feature 12.2 — Decision relationships.** Decisions may reference Features, Epics,
Objectives, Releases, Opportunities, Evidence.

**Feature 12.3 — Decision register.** A chronological view:

```
16 Aug — Prioritize Guest Checkout
12 Aug — Move SSO to Q4
02 Aug — Drop Legacy Export
```

**Feature 12.4 — Decision context.** Display decision, rationale, alternatives, evidence,
affected items, outcome, depending on available properties or note content.

**Feature 12.5 — Changed priority traceability.** Allow priority or planning changes to
reference a Decision note (`decision: - "[[Prioritize Guest Checkout]]"`). The plugin
should not require full event-sourcing of every property edit.

## 19. Cross-view navigation

Although views remain independently opt-in, they must feel connected. A selected Feature
should allow navigation toward relevant views where those relationships exist — Backlog,
Prioritization, Discovery, Evidence, Dependencies, Release, Decisions. Navigation should
open or activate corresponding Bases views where practical.

## 20. Shared property mapping

Each view should expose its own settings. However, the plugin should provide suggested
canonical property names: `type`, `parent`, `order`, `status`, `owner`, `estimate`,
`priority`, `objective`, `evidence`, `release`, `milestone`, `horizon`, `start-date`,
`target-date`, `depends-on`, `decision`, `created`, `updated`.

Users must be able to map each semantic concept to a different property.

## 21. View configuration philosophy

Each view should expose only settings relevant to itself:

- **Product Backlog** — hierarchy levels, parent property, order property, state property,
  done states, visible behavior, folder inference.
- **Prioritization** — items included, scoring model, weights, formula, X axis, Y axis,
  scenarios.
- **Discovery** — discovery types, lifecycle property, lifecycle states, validation
  property, promotion targets.
- **Strategy** — objective property, strategic types, relationship mappings, coverage rules.
- **Backlog Health** — enabled rules, thresholds, severity, staleness age, definition of
  ready.

This separation is critical. A user must not encounter dozens of irrelevant settings simply
because all capabilities originate from the same plugin.

## 22. View creation UX

When a user adds a Backlog View view type, provide guided empty states:

```
No Prioritization configuration found.
[Use recommended defaults]
[Configure properties]
```

Recommended defaults should initialize only properties needed by that view. Existing values
must never be overwritten silently.

## 23. Inter-view data contract

Views should communicate only through vault data and shared internal interpretation
utilities. The Discovery view writes `status: Validated` to a Markdown note; the
Prioritization view reads it. Avoid hidden coupling through an internal database. The vault
remains the integration layer.

## 24. Existing view refactoring

The current Product Backlog implementation contains several projections that should
gradually become dedicated views:

```
Current Product Backlog
├── Tree               → Product Backlog
├── Board              → potentially Backlog Board
├── Roadmap            → Roadmap View
└── Deliverables       → potentially dedicated Deliverables View
```

The migration should preserve existing user configurations where reasonably possible. No
immediate breaking split is required. A staged extraction is preferred.

## 25. Optional future dedicated Deliverables view

The current Deliverables capability may eventually become another first-class view.
Potential scope: Deliverable, Owner, State, Due date, Related Feature, Related Release,
Acceptance status. This should be evaluated independently from generic task management.

## 26. Explicit non-goals

**26.1 AI functionality.** No proprietary AI layer is required. Because the source data
remains ordinary Markdown, external agents can inspect and manipulate the vault directly.
Backlog View should therefore focus on providing a clean deterministic product model rather
than duplicating agent functionality.

**26.2 Full project scheduling.** The plugin should not attempt to become Microsoft
Project. Avoid deep investment in resource leveling, critical-path scheduling, automatic
task scheduling, detailed person-hour allocation, timesheets, complex calendar scheduling.

**26.3 Time tracking.** Not a core Product Management concern for Backlog View.

**26.4 Team communication.** The plugin should not reproduce Slack, Teams, comments
platforms or notifications infrastructure. Markdown and existing Obsidian integrations
remain preferable.

**26.5 Proprietary cloud synchronization.** Vault synchronization remains an Obsidian/user
concern.

## 27. Suggested product navigation

Users interact primarily through Bases. A mature product Base could offer Backlog,
Discovery, Prioritization, Strategy, Evidence, Roadmap, Releases, Dependencies, Portfolio,
Health, Analytics and Decisions as views; a smaller setup might simply be Backlog,
Prioritization, Roadmap. This composability is a core part of the product proposition.

## 28. Recommended delivery sequence

The Epics should not all be developed simultaneously.

**Wave 1 — Product decision foundation.** E01 Product Backlog, E03 Prioritization, E10
Backlog Health. The existing backlog provides the operational foundation; Prioritization
creates immediate additional Product Management value; Backlog Health improves the quality
of the data all later views depend on.

**Wave 2 — Product discovery and strategy.** E02 Discovery, E04 Strategy, E05 Evidence.
This creates the chain Evidence → Opportunity → Strategy → Prioritization → Backlog. At
this point the product differentiates strongly from generic Obsidian project-management
plugins.

**Wave 3 — Product planning.** E06 Roadmap, E07 Release Planning, E08 Dependencies. This
creates the bridge between strategic prioritization and delivery.

**Wave 4 — Product governance.** E09 Portfolio, E11 Analytics, E12 Decisions. These
capabilities become increasingly useful as the quantity and maturity of product data grows.

## 29. North-star workflow

The complete product should enable the following lifecycle without leaving the vault:

```
Capture an Idea → Identify an Opportunity → Attach Evidence → Define Assumptions
→ Validate Opportunity → Connect to Objective / JTBD → Score and Compare
→ Promote to Backlog → Place on Roadmap → Assign to Release → Resolve Dependencies
→ Deliver → Review Health and Analytics → Record Significant Decisions
```

Each stage is optional. The plugin must support both the simple user (Backlog alone) and
the advanced product team (Discovery + Evidence + Strategy + Prioritization + Backlog +
Roadmap + Releases + Dependencies + Health + Analytics + Decisions) using the same Markdown
model.

## 30. Product success criteria

Backlog View succeeds when:

1. a user can start with a simple Base and Product Backlog view without configuring the
   rest of the product;
2. additional Product Management capabilities can be enabled merely by adding another Bases
   view;
3. views share product information through ordinary Markdown properties and links;
4. no capability requires a hosted Backlog View service;
5. product work can be traced from strategy and evidence down to individual backlog items;
6. prioritization becomes explainable rather than simply represented by manual ordering;
7. stale, incomplete, or poorly connected backlog items become discoverable automatically;
8. product planning can occur without turning Backlog View into generic project-management
   software;
9. individual views remain understandable because settings are scoped to their capability;
10. users retain full ownership and portability of every relevant piece of product
    information.

## 31. Target product architecture

```
                   OBSIDIAN VAULT
                        │
        Markdown + Properties + Links
                        │
                        ▼
              Shared Product Model
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
      ▼                 ▼                 ▼
  Discovery        Prioritization       Strategy
      │                 │                 │
      └─────────────┬───┴───────┬─────────┘
                    │           │
                    ▼           ▼
                 Backlog      Evidence
                    │
          ┌─────────┼───────────┐
          ▼         ▼           ▼
       Roadmap   Releases   Dependencies
          │         │           │
          └─────────┼───────────┘
                    ▼
              Portfolio / Health
                    │
                    ▼
            Analytics / Decisions
```

Technically, however, no central proprietary data store exists. The "Shared Product Model"
is the consistent interpretation of vault-native information.

## 32. Strategic product outcome

Backlog View should evolve from an Obsidian view for managing a hierarchical product
backlog into a modular Product Management toolkit for Obsidian Bases, where strategy,
discovery, evidence, prioritization, planning, and delivery remain connected through local
Markdown data.

The key architectural decision is that these capabilities do not become an increasingly
complex single view. They become a family of focused Bases views sharing one open data
model.
