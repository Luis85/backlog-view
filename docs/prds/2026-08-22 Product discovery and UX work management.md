# PRD — Product Discovery & UX Work Management

## 1. Product Vision

Product Backlog should support not only software delivery but the complete product-development lifecycle.

A Product Manager, UX Designer, Requirements Engineer and Software Engineer should be able to work against the same Epics, Features and PBIs while managing their discipline-specific activities independently.

UX work should therefore not live in a separate design backlog.

Instead, research, interaction design, prototyping, validation and design refinement should be traceable to the product work they support.

The plugin should make the relationship visible:

Problem → Discovery → UX Design → Requirement → Delivery → Validation

without requiring the team to leave the Obsidian Vault.

⸻

## 2. Problem

The current Product Backlog primarily models product scope and implementation work:

Epic → Feature → PBI → Task

This works well for managing what gets delivered but does not sufficiently represent the work required before an item becomes ready for engineering.

UX Designers typically perform activities such as:

* user research
* stakeholder interviews
* workflow analysis
* journey mapping
* information architecture
* interaction design
* wireframing
* prototyping
* design reviews
* usability testing
* design iteration

These activities are often managed outside the delivery backlog.

This creates several problems:

* UX work becomes invisible during planning.
* Features can appear ready when UX work is still outstanding.
* Product and Engineering cannot easily see discovery progress.
* Research findings become disconnected from requirements.
* Designers maintain separate task systems.
* UX deliverables are difficult to trace back to product decisions.
* UX capacity cannot be considered alongside engineering capacity.
* Product Discovery and Product Delivery become disconnected.

⸻

## 3. Goal

Enable cross-functional product teams to manage Discovery, UX and Delivery work against one shared product model.

The plugin should answer questions such as:

* Which Features currently require UX work?
* What is the UX Designer working on?
* Which PBIs are waiting for design?
* Which designs are waiting for validation?
* Which Features have completed usability testing?
* What research supports this Feature?
* Which design decisions resulted from that research?
* Which PBIs are blocked because UX work is incomplete?
* What UX work is planned for the next iteration?
* Where has design debt accumulated?

⸻

## 4. Core Design Principle

UX work SHALL NOT introduce another hierarchy parallel to:

Epic → Feature → PBI → Task

Instead, UX becomes a workstream and lifecycle dimension.

A Task may therefore represent:

```yaml
type: task
discipline: ux
activity: prototype
parent: "[[Feature - Backlog Estimation]]"
status: in-progress
assignee: Jane
```

An engineering task might use:

```yaml
type: task
discipline: engineering
activity: implementation
parent: "[[PBI - Estimate Business Value]]"
status: ready
```

And a product task:

```yaml
type: task
discipline: product
activity: requirement
parent: "[[Feature - Backlog Estimation]]"
status: in-progress
```

The hierarchy continues to describe what is being built.

The workstream describes who is doing what to make it possible.

⸻

## 5. Proposed Workstream Model

Introduce an optional property:

`discipline:`

Initial values:

* product
* ux
* requirements
* engineering
* qa

The list SHOULD be configurable.

Additional optional property:

`activity:`

UX activities might include:

* research
* journey-mapping
* information-architecture
* interaction-design
* wireframe
* prototype
* usability-test
* design-review
* design-refinement
* design-debt

These values should not become fundamental Product Backlog work-item types.

They are classifications of work.

⸻

## 6. Epic — UX Work Management

### Objective

Allow UX Designers to plan and execute their work inside the same Product Backlog used by Product and Engineering.

⸻

### Feature 1 — Discipline / Workstream Classification

Product Backlog items and Tasks can optionally carry a discipline.

Example:

```yaml
discipline: ux
```

#### Capabilities

The user can:

* configure available disciplines
* assign a discipline to work
* filter the backlog by discipline
* group work by discipline
* visually distinguish UX work without changing hierarchy
* show only UX-related work

#### Example

A Feature could contain:

```text
Feature: Backlog Estimation
├── PBI: Configure estimation dimensions
│
├── PBI: Estimate backlog item
│
├── Task: Analyse user workflow
│      discipline: ux
│
├── Task: Create interaction prototype
│      discipline: ux
│
├── Task: Validate prototype
│      discipline: ux
│
└── Task: Implement estimation panel
       discipline: engineering
```

⸻

## 7. Epic — UX Planning View

### Objective

Give the UX Designer a focused view of work without creating a separate backlog.

The UX Designer should be able to filter the shared backlog to:

`discipline = ux`

and obtain a UX-oriented planning surface.

### Feature — UX Board

Example workflow:

```text
Planned
   ↓
Research
   ↓
Designing
   ↓
Ready for Review
   ↓
Validating
   ↓
Done
```

The workflow SHOULD be configurable independently from the engineering workflow.

This allows a designer to manage their own work while retaining links to the Product hierarchy.

Example:

```text
RESEARCH
[Analyse estimation workflow]
Feature: Estimation
DESIGNING
[Create estimation interaction]
Feature: Estimation
VALIDATING
[Test estimation prototype]
Feature: Estimation
```

⸻

## 8. Epic — Discovery & Evidence

### Objective

Connect UX decisions to evidence.

UX activities frequently produce information rather than software.

The plugin should allow backlog items to reference supporting evidence.

Introduce optional relationships such as:

```yaml
evidence:
  - "[[Research - Backlog Refinement Interviews]]"
  - "[[Usability Test - Estimation Prototype]]"
```

Possible evidence notes include:

* interview
* observation
* research study
* usability test
* analytics finding
* customer feedback
* survey
* design critique

These do not need to become Product Backlog work-item types.

They can remain normal Obsidian notes.

⸻

### Feature — Evidence Links

A Feature or PBI can reference evidence.

Example:

```yaml
type: feature
evidence:
  - "[[Research - Product Manager Interviews]]"
  - "[[UT-004 Estimation Workflow]]"
```

The item UI may surface:

```text
Feature: Business Value Estimation
Evidence  3
Design    2
Tests     1
```

Selecting these opens the corresponding notes.

⸻

## 9. Epic — UX Deliverables

### Objective

Make UX outputs visible without converting documents into backlog items.

Introduce an optional relationship:

`deliverables:`

Example:

```yaml
deliverables:
  - "[[Journey - Backlog Refinement]]"
  - "[[Flow - Estimate Business Value]]"
  - "[[Prototype - Estimation Panel]]"
```

Deliverables could include:

* journey
* flow
* wireframe
* prototype
* information architecture
* usability report
* design specification

The files remain normal Obsidian notes or external references.

The backlog simply provides traceability.

⸻

## 10. Epic — UX Readiness

### Objective

Prevent work from entering implementation before necessary UX work is complete.

Introduce optional readiness dimensions.

Example:

```yaml
readiness:
  product: ready
  ux: in-progress
  engineering: ready
```

The Feature might therefore appear:

```text
Feature: Estimation
Product       ✓
UX            ◐
Engineering   ✓
Overall       NOT READY
```

⸻

### Feature — UX Definition of Ready

The team can configure UX readiness criteria.

Example:

* user problem understood
* main workflow identified
* interaction designed
* empty state defined
* error states defined
* accessibility considered
* design reviewed
* usability validation performed

A Feature requiring UX cannot reach ready while mandatory UX criteria remain incomplete.

⸻

## 11. Epic — UX Research & Usability Testing

### Objective

Make validation activities visible in the backlog.

UX Tasks may represent usability studies.

Example:

```yaml
type: task
discipline: ux
activity: usability-test
parent: "[[Feature - Estimation]]"
status: planned
```

The associated study note may contain:

```yaml
participants: 5
status: completed
result: issues-found
```

The backlog can display an aggregate:

```text
Feature: Estimation
UX validation
5 participants
3 findings
2 unresolved
```

⸻

## 12. Epic — UX Findings

### Objective

Turn usability findings into actionable backlog work.

A usability study may generate Findings.

Example:

```text
Usability Test
      │
      ├── Finding
      │      ↓
      │    PBI
      │
      └── Finding
             ↓
           Bug
```

A Finding note could contain:

```yaml
finding: true
severity: major
source: "[[UT-004 Estimation Workflow]]"
affects: "[[Feature - Estimation]]"
```

A finding could then be:

* accepted
* converted to backlog work
* deferred
* rejected
* resolved

This creates traceability from:

research evidence → finding → product decision → implementation

⸻

## 13. Epic — Cross-Functional Feature Overview

### Objective

Provide Product Managers with a single view of Feature readiness across disciplines.

Example:

```text
Feature                    Product    UX        Dev       QA
Backlog Estimation          ✓          ✓         ◐         -
Roadmap Dependencies        ✓          ◐         -         -
Bulk Editing                ◐          -         -         -
Search Improvements         ✓          ✓         ✓         ✓
```

This should answer:

What prevents this Feature from moving forward?

rather than merely:

What status is the Feature in?

⸻

## 14. Epic — Design Debt

UX work does not always have to happen before release.

The team should be able to explicitly classify deferred UX improvements.

Example:

```yaml
discipline: ux
activity: design-debt
```

Potential dimensions:

```yaml
severity: minor
effort: small
```

This allows Product Backlog to surface accumulated design debt alongside technical and product work.

⸻

## 15. Example Product-Team Workflow

A Feature starts as:

```text
FEATURE
Improve backlog estimation
```

Product creates discovery work:

```text
Task
Understand how Product Managers currently estimate work
discipline: product
```

UX creates:

```text
Task
Observe backlog refinement workflow
discipline: ux
activity: research
```

Research produces:

```text
Research Note
Backlog refinement observations
```

The Feature links to that evidence.

UX then creates:

```text
Task
Design estimation interaction
discipline: ux
activity: interaction-design
```

followed by:

```text
Task
Prototype estimation workflow
discipline: ux
activity: prototype
```

and:

```text
Task
Validate estimation workflow
discipline: ux
activity: usability-test
```

Once UX readiness is achieved, PBIs move into engineering refinement.

Engineering Tasks then appear underneath those PBIs.

The same Feature therefore evolves through:

```text
          FEATURE
             │
     ┌───────┴─────────┐
     │                 │
 Discovery          Delivery
     │                 │
 Product             PBI
 UX Research          │
 UX Design          Tasks
 Validation       Engineering
     │
 Evidence
```

All of it remains within one product backlog.

⸻

## 16. Recommended UX-Focused Saved Views

The same underlying notes can support different team perspectives.

### Product Backlog

```text
Epic
  Feature
    PBI
      Task
```

### UX Work

filter:
`discipline = ux`

Board:

`Planned | Research | Designing | Review | Validate | Done`

### Discovery

Filter:

```text
activity IN
research
prototype
usability-test
```

### UX Ready / Not Ready

Features grouped by UX readiness.

### UX Debt

Filter:

`activity = design-debt`

### My Work

Filter:

`assignee = current-user`

regardless of discipline.

⸻

## 17. Product Principle

Product Backlog should not attempt to become Figma, Miro, Dovetail or a dedicated research repository.

Its responsibility is orchestration and traceability.

External tools may create the artifact.

Obsidian may store the artifact.

Product Backlog manages the work required to produce it and its relationship to the Product.

The model therefore becomes:

```text
                    PRODUCT BACKLOG
                         Epic
                          │
                       Feature
                          │
                ┌─────────┴──────────┐
                │                    │
            Discovery             Delivery
                │                    │
        Product / UX Tasks           PBI
                │                    │
             Evidence              Tasks
                │                    │
          UX Deliverables        Engineering
                │
             Findings
```

This turns Product Backlog from a software-development backlog into a cross-functional product-development workspace.
