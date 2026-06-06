# Policy Analysis & System Mapping API

## Overview
This backend feature accepts a housing policy text, sends it to an LLM, generates a dynamic stakeholder analysis and system map, stores the result in PostgreSQL, and exposes retrieval endpoints for frontend visualization and inspection.

Swagger UI is available at `/swagger-ui/index.html`.

## Backend Structure
### Controller
- `backend/app/policy_analysis_router.py`
- Owns all `/policy` routes.

### Service
- `backend/app/policy_analysis_service.py`
- Handles LLM orchestration, request validation flow, and read/write service calls.

### Repository
- `backend/app/policy_analysis_repository.py`
- Handles persistence, lookup queries, graph assembly, notes, and delete operations.

### DTOs / Schemas
- `backend/app/schemas.py`
- Request/response models for policy analysis, stakeholders, nodes, connections, loops, boundary, notes, graph payloads, list views, and delete responses.

## Database Entities / Tables
- `policy_documents`: root record for each submitted policy.
- `stakeholder_entities`: reusable stakeholder catalog.
- `policy_stakeholder_analyses`: policy-specific Micro/Meso/Macro analysis rows.
- `policy_system_node_catalog`: reusable node catalog.
- `policy_system_nodes`: policy-scoped graph nodes.
- `policy_system_connections`: policy-scoped graph edges.
- `policy_feedback_loops`: feedback loop metadata.
- `policy_feedback_loop_nodes`: loop-to-node mapping.
- `policy_feedback_loop_connections`: loop-to-connection mapping.
- `policy_system_boundaries`: system boundary records.
- `policy_boundary_nodes`: boundary-to-node mapping.
- `policy_notes`: user-authored notes attached to policy objects.

## Entity Relationships
- One `policy_documents` row has many `policy_stakeholder_analyses`.
- One `policy_documents` row has many `policy_system_nodes`.
- One `policy_documents` row has many `policy_system_connections`.
- One `policy_documents` row has many `policy_feedback_loops`.
- One `policy_documents` row has zero or one active `policy_system_boundaries` record in the current retrieval contract.
- One `policy_documents` row has many `policy_notes`.
- `policy_stakeholder_analyses.stakeholder_entity_id` links to reusable `stakeholder_entities`.
- `policy_system_nodes.node_catalog_id` links to reusable `policy_system_node_catalog`.
- Feedback loops map to nodes and connections through join tables.

## Common Error Cases
- `400 Bad Request`: malformed JSON body.
- `404 Not Found`: policy or related record does not exist.
- `422 Unprocessable Entity`: schema validation failed.
- `502 Bad Gateway`: LLM request failed or returned invalid structured output.
- `503 Service Unavailable`: `OPENAI_API_KEY` is missing.

---

## 1. Create Policy Analysis
### Endpoint name
`CreatePolicyAnalysis`

### HTTP method
`POST`

### URL path
`/policy`

### Purpose
Accept a policy text, call the LLM, generate stakeholders plus system-map artifacts, save the full structure, and return the saved result.

### Request body expected
```json
{
  "text": "Full housing policy text here"
}
```

### Query parameters
None.

### Path variables
None.

### Response body format
- `policy_id`
- `text`
- `policy_domain`
- `llm_model`
- `created_at`
- `stakeholders`
- `nodes`
- `connections`
- `feedback_loops`
- `system_boundary`
- `notes`
- `possible_intervention_points`

### Example request
```bash
curl -X POST http://localhost:8000/policy \
  -H "Content-Type: application/json" \
  -d '{"text":"This housing policy expands subsidized rental supply, strengthens tenant protection, and coordinates infrastructure upgrades."}'
```

### Example response
```json
{
  "policy_id": 4,
  "text": "This housing policy expands subsidized rental supply, strengthens tenant protection, and coordinates infrastructure upgrades.",
  "policy_domain": "Housing",
  "llm_model": "gpt-4o-mini",
  "created_at": "2026-06-06T21:44:52.760645",
  "stakeholders": [
    {
      "analysis_id": 10,
      "stakeholder_id": 8,
      "stakeholder_key": "government_agencies",
      "stakeholder_name": "Government Agencies",
      "stakeholder_type": "Public Sector",
      "stakeholder_summary": "Entities responsible for implementing housing policies and regulations.",
      "micro_level": {},
      "meso_level": {},
      "macro_level": {}
    }
  ],
  "nodes": [],
  "connections": [],
  "feedback_loops": [],
  "system_boundary": {},
  "notes": [],
  "possible_intervention_points": []
}
```

### Error cases
- `422` if `text` is too short.
- `502` if the LLM schema call fails.
- `503` if `OPENAI_API_KEY` is missing.

### Database entities/tables affected
- `policy_documents`
- `stakeholder_entities`
- `policy_stakeholder_analyses`
- `policy_system_node_catalog`
- `policy_system_nodes`
- `policy_system_connections`
- `policy_feedback_loops`
- `policy_feedback_loop_nodes`
- `policy_feedback_loop_connections`
- `policy_system_boundaries`
- `policy_boundary_nodes`

---

## 2. List Policies
### Endpoint name
`ListPolicies`

### HTTP method
`GET`

### URL path
`/policy`

### Purpose
Return all saved policy records with lightweight metadata and counts for dashboards and list views.

### Request body expected
None.

### Query parameters
None currently.

### Path variables
None.

### Response body format
Array of policy summaries:
- `policy_id`
- `text_preview`
- `policy_domain`
- `llm_model`
- `created_at`
- `stakeholder_count`
- `node_count`
- `connection_count`
- `feedback_loop_count`
- `note_count`

### Example request
```bash
curl http://localhost:8000/policy
```

### Example response
```json
[
  {
    "policy_id": 4,
    "text_preview": "This housing policy expands subsidized rental supply...",
    "policy_domain": "Housing",
    "llm_model": "gpt-4o-mini",
    "created_at": "2026-06-06T21:44:52.760645",
    "stakeholder_count": 3,
    "node_count": 7,
    "connection_count": 5,
    "feedback_loop_count": 0,
    "note_count": 1
  }
]
```

### Error cases
- Normally returns `200` with an empty array if no policies exist.

### Database entities/tables affected
- Reads `policy_documents`
- Reads policy child tables for counts

---

## 3. Get Policy By ID
### Endpoint name
`GetPolicy`

### HTTP method
`GET`

### URL path
`/policy/{policyId}`

### Purpose
Return the full saved policy analysis and system-map payload by ID.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer policy ID

### Response body format
Same shape as `POST /policy`.

### Example request
```bash
curl http://localhost:8000/policy/4
```

### Example response
```json
{
  "policy_id": 4,
  "text": "Full policy text",
  "policy_domain": "Housing",
  "llm_model": "gpt-4o-mini",
  "created_at": "2026-06-06T21:44:52.760645",
  "stakeholders": [],
  "nodes": [],
  "connections": [],
  "feedback_loops": [],
  "system_boundary": {},
  "notes": [],
  "possible_intervention_points": []
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads all policy-analysis tables

---

## 4. Get Policy Stakeholders
### Endpoint name
`GetPolicyStakeholders`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/stakeholders`

### Purpose
Return all stakeholders linked to a policy with IDs and analysis fields.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
Array of `PolicyStakeholderAnalysis`.

### Example request
```bash
curl http://localhost:8000/policy/4/stakeholders
```

### Example response
```json
[
  {
    "analysis_id": 10,
    "stakeholder_id": 8,
    "stakeholder_key": "government_agencies",
    "stakeholder_name": "Government Agencies",
    "stakeholder_type": "Public Sector",
    "stakeholder_summary": "Entities responsible for implementing housing policies and regulations.",
    "micro_level": {},
    "meso_level": {},
    "macro_level": {}
  }
]
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_stakeholder_analyses`
- Reads `stakeholder_entities`

---

## 5. Get Policy Analysis
### Endpoint name
`GetPolicyAnalysisOnly`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/analysis`

### Purpose
Return the Micro/Meso/Macro analysis view for a policy without the graph payload.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
- `policy_id`
- `text`
- `policy_domain`
- `llm_model`
- `created_at`
- `stakeholders`

### Example request
```bash
curl http://localhost:8000/policy/4/analysis
```

### Example response
```json
{
  "policy_id": 4,
  "text": "Full policy text",
  "policy_domain": "Housing",
  "llm_model": "gpt-4o-mini",
  "created_at": "2026-06-06T21:44:52.760645",
  "stakeholders": []
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_documents`
- Reads `policy_stakeholder_analyses`
- Reads `stakeholder_entities`

---

## 6. Get Policy Nodes
### Endpoint name
`GetPolicyNodes`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/nodes`

### Purpose
Return all saved system-map nodes for frontend rendering.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
Array of `PolicySystemNode`.

### Example request
```bash
curl http://localhost:8000/policy/4/nodes
```

### Example response
```json
[
  {
    "policy_node_id": 15,
    "node_id": 8,
    "node_key": "subsidized_rental_supply",
    "label": "Subsidized Rental Supply",
    "description": "Government-supported housing options to reduce rental costs.",
    "level": "Macro",
    "category": "Policy Factor",
    "related_stakeholder_ids": [8, 12]
  }
]
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_system_nodes`
- Reads `policy_system_node_catalog`

---

## 7. Get Policy Connections
### Endpoint name
`GetPolicyConnections`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/connections`

### Purpose
Return all graph edges/connections for the policy.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
Array of `PolicySystemConnection`.

### Example request
```bash
curl http://localhost:8000/policy/4/connections
```

### Example response
```json
[
  {
    "connection_id": 6,
    "connection_key": "connection-6",
    "policy_id": 4,
    "source_node_id": 15,
    "target_node_id": 19,
    "relationship_type": "Resource Flow",
    "explanation": "Subsidized rentals provided by the government aim to support tenants financially.",
    "polarity": "+"
  }
]
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_system_connections`

---

## 8. Get Policy Feedback Loops
### Endpoint name
`GetPolicyFeedbackLoops`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/feedback-loops`

### Purpose
Return feedback loops plus node and connection memberships.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
Array of `PolicyFeedbackLoop`.

### Example request
```bash
curl http://localhost:8000/policy/4/feedback-loops
```

### Example response
```json
[
  {
    "feedback_loop_id": 2,
    "loop_key": "feedback-loop-2",
    "policy_id": 4,
    "loop_name": "Trust-to-delivery loop",
    "involved_node_ids": [15, 18],
    "involved_connection_ids": [6, 7],
    "loop_type": "reinforcing",
    "explanation": "Housing delivery progress can strengthen trust and enable faster action.",
    "affected_stakeholder_ids": [8, 12],
    "possible_intervention_points": ["Coordinate approvals", "Publish milestone tracking"]
  }
]
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_feedback_loops`
- Reads `policy_feedback_loop_nodes`
- Reads `policy_feedback_loop_connections`

---

## 9. Get Policy Boundary
### Endpoint name
`GetPolicyBoundary`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/boundary`

### Purpose
Return the saved system boundary for the policy.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
`PolicySystemBoundary` or `null`.

### Example request
```bash
curl http://localhost:8000/policy/4/boundary
```

### Example response
```json
{
  "boundary_id": 2,
  "policy_id": 4,
  "system_purpose": "To enhance the availability of affordable housing through coordinated efforts.",
  "included_node_ids": [15, 16, 17, 18],
  "excluded_or_external_factors": [
    "Unregulated rental markets",
    "External economic downturns"
  ],
  "explanation": "The system focuses on housing policy measures and stakeholder interactions that directly influence subsidized rentals."
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_system_boundaries`

---

## 10. Get Policy Notes
### Endpoint name
`GetPolicyNotes`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/notes`

### Purpose
Return all notes saved against the policy and related objects.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
Array of `PolicyNoteResponse`.

### Example request
```bash
curl http://localhost:8000/policy/4/notes
```

### Example response
```json
[
  {
    "note_id": 1,
    "related_object_type": "policy",
    "related_object_id": 4,
    "policy_id": 4,
    "note_text": "Flag tenant-protection assumptions for manual review.",
    "created_at": "2026-06-06T21:44:58.744627",
    "updated_at": "2026-06-06T21:44:58.744627"
  }
]
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_notes`

---

## 11. Add Policy Note
### Endpoint name
`CreatePolicyNote`

### HTTP method
`POST`

### URL path
`/policy/{policyId}/notes`

### Purpose
Add a note to a policy, stakeholder, node, connection, feedback loop, boundary, or intervention point.

### Request body expected
```json
{
  "related_object_type": "policy",
  "related_object_id": 4,
  "note_text": "Flag tenant-protection assumptions for manual review."
}
```

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
`PolicyNoteResponse`

### Example request
```bash
curl -X POST http://localhost:8000/policy/4/notes \
  -H "Content-Type: application/json" \
  -d '{"related_object_type":"policy","related_object_id":4,"note_text":"Flag tenant-protection assumptions for manual review."}'
```

### Example response
```json
{
  "note_id": 1,
  "related_object_type": "policy",
  "related_object_id": 4,
  "policy_id": 4,
  "note_text": "Flag tenant-protection assumptions for manual review.",
  "created_at": "2026-06-06T21:44:58.744627",
  "updated_at": "2026-06-06T21:44:58.744627"
}
```

### Error cases
- `404` if the policy does not exist.
- `422` if `related_object_type` or `note_text` is invalid.

### Database entities/tables affected
- Writes `policy_notes`

---

## 12. Get Intervention Points
### Endpoint name
`GetPolicyInterventionPoints`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/intervention-points`

### Purpose
Return a deduplicated list of intervention points inferred from feedback loops.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
```json
{
  "policy_id": 4,
  "intervention_points": []
}
```

### Example request
```bash
curl http://localhost:8000/policy/4/intervention-points
```

### Example response
```json
{
  "policy_id": 4,
  "intervention_points": [
    "Coordinate approvals",
    "Publish milestone tracking"
  ]
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_feedback_loops`

---

## 13. Get Intervention Analysis
### Endpoint name
`GetPolicyInterventionAnalysis`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/interventions/analysis`

### Purpose
Return a stronger intervention-analysis layer built from the saved policy text, stakeholders, feedback loops, nodes, boundary, and notes. This endpoint explains why each intervention is recommended, what evidence supports it, which loops and nodes it targets, what tradeoffs to watch, and what system shift is expected.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
```json
{
  "policy_id": 4,
  "generated_at": "2026-06-07T10:00:00Z",
  "analysis_mode": "grounded-policy-analysis",
  "summary": "Prioritize ...",
  "recommendations": [
    {
      "rank": 1,
      "intervention_key": "coordinate-approvals",
      "title": "Coordinate approvals",
      "recommended_action": "Use coordinate approvals ...",
      "reason": "We are recommending ...",
      "supporting_evidence": [],
      "targeted_feedback_loop_ids": [],
      "targeted_node_ids": [],
      "affected_stakeholder_ids": [],
      "stakeholder_focus": [],
      "implementation_notes": [],
      "tradeoffs": [],
      "expected_system_shift": "Expected shift ...",
      "confidence": 0.82
    }
  ]
}
```

### Example request
```bash
curl http://localhost:8000/policy/4/interventions/analysis
```

### Example response
```json
{
  "policy_id": 4,
  "generated_at": "2026-06-07T09:12:10.123456+00:00",
  "analysis_mode": "grounded-policy-analysis",
  "summary": "Prioritize public reporting and coordinated delivery first. It has the strongest grounding in the current system map because it addresses 1 feedback loop, focuses on 3 stakeholder groups, and aligns with the system purpose of improving housing affordability through coordinated delivery.",
  "recommendations": [
    {
      "rank": 1,
      "intervention_key": "public-reporting-and-coordinated-delivery",
      "title": "Public reporting and coordinated delivery",
      "recommended_action": "Use public reporting and coordinated delivery to directly change pressure on Public Trust, Delivery Coordination.",
      "reason": "We are recommending public reporting and coordinated delivery because it directly addresses the trust-to-delivery loop, which is pushing pressure through Public Trust and Delivery Coordination.",
      "supporting_evidence": [
        "System purpose: Improve housing affordability through coordinated delivery.",
        "Loop signal: When delivery stalls, public trust falls and approval friction rises.",
        "Stakeholder pressure: Housing Department is motivated by delivery credibility and is pursuing visible execution progress."
      ],
      "targeted_feedback_loop_ids": [2],
      "targeted_node_ids": [15, 18],
      "affected_stakeholder_ids": [8, 12, 14],
      "stakeholder_focus": [
        "Government Agencies",
        "Tenants",
        "Private Developers"
      ],
      "implementation_notes": [
        "Coordinate with Government Agencies around funding and approvals."
      ],
      "tradeoffs": [
        "Government Agencies: regulatory exposure remains tied to rental regulation and subsidy policy."
      ],
      "expected_system_shift": "Expected shift: reduce reinforcing pressure across Public Trust and Delivery Coordination while keeping the system aligned with improving housing affordability through coordinated delivery.",
      "confidence": 0.84
    }
  ]
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_documents`
- Reads `policy_stakeholder_analyses`
- Reads `stakeholder_entities`
- Reads `policy_system_nodes`
- Reads `policy_system_connections`
- Reads `policy_feedback_loops`
- Reads `policy_system_boundaries`
- Reads `policy_notes`

---

## 14. Get Policy Enhancements
### Endpoint name
`GetPolicyEnhancementAnalysis`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/policy-enhancements`

### Purpose
Return drafting guidance for how to incorporate the recommended interventions directly into the policy text. This endpoint focuses on:
- what to add to the policy
- where to add it
- why it should be added
- which stakeholders it affects
- what risk remains if it is omitted

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
```json
{
  "policy_id": 8,
  "generated_at": "2026-06-07T10:30:00Z",
  "analysis_mode": "grounded-policy-enhancement",
  "summary": "Start by strengthening the implementation and delivery section...",
  "suggestions": [
    {
      "rank": 1,
      "enhancement_key": "policy-addition-stabilize-affordable-housing-supply",
      "title": "Add Stabilize Affordable Housing Supply language",
      "suggested_policy_section": "Implementation and Delivery",
      "what_to_add": "Add a clause that requires ...",
      "draft_clause": "The policy shall require ...",
      "reason": "Add this because ...",
      "affected_stakeholder_ids": [12, 22],
      "affected_stakeholders": ["Tenants", "Landlords"],
      "based_on_intervention_keys": ["stabilize-affordable-housing-supply"],
      "based_on_feedback_loop_ids": [],
      "based_on_node_ids": [35],
      "expected_policy_effect": "Expected effect: ...",
      "risks_if_omitted": []
    }
  ]
}
```

### Example request
```bash
curl http://localhost:8000/policy/8/policy-enhancements
```

### Example response
```json
{
  "policy_id": 8,
  "generated_at": "2026-06-07T10:31:44.112233+00:00",
  "analysis_mode": "grounded-policy-enhancement",
  "summary": "Start by strengthening the implementation and delivery section. The highest-ranked intervention is most useful when translated into explicit policy text instead of remaining only as an external recommendation.",
  "suggestions": [
    {
      "rank": 1,
      "enhancement_key": "policy-addition-stabilize-affordable-housing-supply",
      "title": "Add Stabilize Affordable Housing Supply language",
      "suggested_policy_section": "Implementation and Delivery",
      "what_to_add": "Add a clause that requires Tenants, Landlords to take explicit action on Affordable Housing Supply, with named responsibilities, clear timelines, and a review trigger if delivery or safeguards fall behind.",
      "draft_clause": "The policy shall require Tenants, Landlords to coordinate actions affecting Affordable Housing Supply, publish progress milestones, and initiate corrective review where targets, safeguards, or service readiness are not being met.",
      "reason": "Add this because the intervention analysis shows that Tenants, Landlords are materially affected through Affordable Housing Supply. Writing the intervention into the policy turns it into an enforceable operating instruction rather than a separate advisory idea.",
      "affected_stakeholder_ids": [12, 22],
      "affected_stakeholders": ["Tenants", "Landlords"],
      "based_on_intervention_keys": ["stabilize-affordable-housing-supply"],
      "based_on_feedback_loop_ids": [],
      "based_on_node_ids": [35],
      "expected_policy_effect": "Expected effect: shift Affordable Housing Supply from informal implementation risk into explicit policy execution that can be monitored and enforced.",
      "risks_if_omitted": [
        "The intervention may remain advisory, with no explicit policy obligation to act on it."
      ]
    }
  ]
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads `policy_documents`
- Reads `policy_stakeholder_analyses`
- Reads `stakeholder_entities`
- Reads `policy_system_nodes`
- Reads `policy_feedback_loops`
- Reads `policy_system_boundaries`
- Reads `policy_notes`

---

## 15. Get Full Graph Payload
### Endpoint name
`GetPolicyGraph`

### HTTP method
`GET`

### URL path
`/policy/{policyId}/graph`

### Purpose
Return one graph payload directly usable by a frontend visualization layer.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
```json
{
  "policy": {},
  "nodes": [],
  "edges": [],
  "feedback_loops": [],
  "stakeholders": [],
  "boundary": {},
  "intervention_points": []
}
```

### Example request
```bash
curl http://localhost:8000/policy/4/graph
```

### Example response
```json
{
  "policy": {
    "policy_id": 4,
    "text_preview": "This housing policy expands subsidized rental supply...",
    "policy_domain": "Housing",
    "llm_model": "gpt-4o-mini",
    "created_at": "2026-06-06T21:44:52.760645",
    "stakeholder_count": 3,
    "node_count": 7,
    "connection_count": 5,
    "feedback_loop_count": 0,
    "note_count": 1
  },
  "nodes": [],
  "edges": [],
  "feedback_loops": [],
  "stakeholders": [],
  "boundary": {},
  "intervention_points": []
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Reads all policy-analysis tables

---

## 16. Delete Policy
### Endpoint name
`DeletePolicy`

### HTTP method
`DELETE`

### URL path
`/policy/{policyId}`

### Purpose
Delete the policy root record and all related policy-scoped mapped data through cascading relationships.

### Request body expected
None.

### Query parameters
None.

### Path variables
- `policyId`: integer

### Response body format
```json
{
  "policy_id": 4,
  "deleted": true,
  "message": "Policy 4 deleted successfully."
}
```

### Example request
```bash
curl -X DELETE http://localhost:8000/policy/4
```

### Example response
```json
{
  "policy_id": 4,
  "deleted": true,
  "message": "Policy 4 deleted successfully."
}
```

### Error cases
- `404` if the policy does not exist.

### Database entities/tables affected
- Deletes from `policy_documents`
- Cascades to all policy-scoped child tables

---

## Testing Options
### Swagger / OpenAPI
- Open [http://localhost:8000/swagger-ui/index.html](http://localhost:8000/swagger-ui/index.html)
- Use the built-in request forms to test `POST`, `GET`, and `DELETE` endpoints directly.
- FastAPI automatically exposes the OpenAPI schema for all policy endpoints.

### Browser Testing
- `GET` endpoints can be tested directly in a browser address bar.
- Examples:
  - `http://localhost:8000/policy`
  - `http://localhost:8000/policy/4`
  - `http://localhost:8000/policy/4/graph`

### cURL
- Best for repeatable CLI testing.
- Use `POST` for policy creation and notes.
- Use `DELETE` for cleanup.

### Postman / Bruno / Insomnia
- Useful for saving request collections.
- Recommended for testing large policy bodies and comparing multiple saved policies.

## Suggested Manual Test Flow
1. Open Swagger UI.
2. Run `POST /policy` with a housing policy text.
3. Copy the returned `policy_id`.
4. Run `GET /policy/{policyId}`.
5. Run `GET /policy/{policyId}/graph`.
6. Run `POST /policy/{policyId}/notes`.
7. Run `GET /policy/{policyId}/notes`.
8. Run `GET /policy/{policyId}/intervention-points`.
9. Run `GET /policy/{policyId}/interventions/analysis`.
10. Run `GET /policy/{policyId}/policy-enhancements`.
11. Run `DELETE /policy/{policyId}`.
12. Confirm `GET /policy/{policyId}` now returns `404`.
