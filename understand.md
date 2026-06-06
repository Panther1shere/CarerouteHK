# Housing Policy Loop Navigator

## 1. Problem

Governments rarely fail on policy intent alone. They fail because housing systems are full of connected actors with different incentives:

- planning teams protect process legitimacy
- housing teams push for faster delivery
- developers react to approval risk
- tenant groups react to displacement risk
- infrastructure agencies react to service strain

When policymakers change one part of the system, other parts push back. These reinforcing loops are difficult to see in ordinary policy memos, dashboards, or static reports. As a result, a well-intentioned housing policy can create hidden failure paths:

- approvals get slower
- trust falls
- displacement anxiety rises
- infrastructure strain creates backlash
- the original policy loses political support

## 2. Product

Housing Policy Loop Navigator is a decision-support platform for city housing policy teams.

It helps a city policy analyst:

- map how stakeholders and system factors are connected
- detect reinforcing loops that cause policy failure
- simulate the likely effect of a housing policy
- identify intervention points before implementation
- compare tradeoffs so one fix does not break other parts of the system

The core product idea is not “AI makes policy for government.” The core idea is:

**make the system visible, simulate the effect, then recommend safer intervention points.**

## 3. Primary User

Primary user:

- city policy analyst

Secondary audiences:

- housing department leadership
- urban planning departments
- mayoral or ministerial strategy offices
- public-sector innovation and delivery teams

These users need faster policy reasoning, clearer tradeoff visibility, and a way to explain why a policy may fail before spending political capital on it.

## 4. Demo Workflow

The hackathon version uses a seeded sample city called `Harborview`.

The analyst workflow is:

1. Select a housing policy scenario.
2. Choose the policy objective such as affordability, speed, stability, or trust.
3. Adjust policy intensity.
4. View the causal network graph of stakeholders, system factors, and policy nodes.
5. Run a guided simulation.
6. Review:
   - projected metric shifts
   - reinforcing loops
   - neighborhood impact context
   - ranked intervention suggestions
7. Use the intervention list to refine the policy package.

## 5. Why This Is Innovative

Most public-policy tools do one of these things:

- show KPIs
- show maps
- show reports
- generate general AI summaries

This product combines four things in one workflow:

- systems thinking
- graph-based policy modeling
- explainable simulation
- AI-style policy interpretation layered on deterministic logic

That makes the process:

- faster than manual policy workshops
- clearer than ordinary dashboards
- more defensible than black-box prediction claims
- more useful for real government buying than a pure visualization demo

## 6. Technical Concept

### Frontend

Angular provides a single analyst dashboard with four main surfaces:

- policy input
- causal network graph
- loop and risk explanation
- intervention suggestions

A light neighborhood map is included as contextual city framing, but the graph remains the primary analytical surface.

### Backend

FastAPI serves:

- the seeded city scenario
- graph nodes and edges
- neighborhood metadata
- deterministic policy simulation results
- intervention recommendations

### Database

PostgreSQL stores:

- policy scenario metadata
- stakeholders
- system nodes
- system edges
- failure loops
- neighborhoods
- policies
- interventions
- simulation runs

### Simulation Model

The simulation is intentionally guided rather than pretending to be a full predictive engine.

The backend computes:

- metric shifts
- loop-risk movement
- affected nodes
- neighborhood impact
- ranked interventions

This is important for hackathon credibility:

- it is explainable
- it is reproducible
- it avoids fake precision
- it demonstrates a real product path

## 7. AI Boundary

The advisor layer should never replace the deterministic core.

The deterministic core is responsible for:

- graph structure
- loop detection
- policy effect scoring
- intervention ranking

The advisor layer is responsible for:

- clearer narrative explanation
- policy framing
- recommendation wording
- alternative packaging of intervention options

This boundary matters because government users need systems they can defend internally. A black-box answer alone is not enough.

## 8. B2G Positioning

This is a B2G decision-support product for urban policy design.

Initial wedge:

- housing policy teams

Expansion paths:

- transit and mobility
- land use and zoning reform
- infrastructure sequencing
- utilities and service delivery
- climate adaptation policy

The B2G value proposition is:

- reduce policy failure risk earlier
- shorten the time from policy design to action
- improve cross-department coordination
- make tradeoffs visible before public backlash
- give leadership clearer intervention choices

## 9. Pitch Narrative

Governments do not just need better dashboards. They need a way to see the system before the system pushes back.

Housing Policy Loop Navigator helps them:

- see the hidden loops
- understand why a policy might fail
- test options quickly
- choose interventions that reduce second-order damage

It is a policy intelligence layer for smart cities.

## 10. Why Judges Should Care

- It solves a real government pain point.
- It is more than a data visualization.
- It turns systems complexity into actionable policy design.
- It has a credible path from hackathon demo to public-sector software product.
- It is realistic enough to demo now and extensible enough to become a platform later.
