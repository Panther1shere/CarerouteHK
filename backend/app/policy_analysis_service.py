import json
from collections import defaultdict
from datetime import UTC, datetime
import re

from fastapi import HTTPException
from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.policy_analysis_repository import PolicyAnalysisRepository
from app.schemas import (
    PolicyAnalysisLLMEnvelope,
    PolicyAnalysisOnlyResponse,
    PolicyAnalysisResponse,
    PolicyDeleteResponse,
    PolicyEnhancementAnalysisResponse,
    PolicyEnhancementSuggestion,
    PolicyGraphResponse,
    PolicyInterventionAnalysisResponse,
    PolicyInterventionRecommendation,
    PolicyInterventionPointsResponse,
    PolicyNoteCreateRequest,
    PolicyNoteResponse,
    PolicyStakeholderAnalysis,
    PolicySummaryResponse,
    PolicySystemBoundary,
    PolicySystemConnection,
    PolicySystemNode,
    PolicyFeedbackLoop,
)


POLICY_ANALYSIS_SYSTEM_PROMPT = """
You are an expert public-policy analysis assistant and systems-mapping analyst.

Analyze the submitted policy text, which will usually be about housing, and generate a
structured stakeholder analysis plus a system map.

Return JSON that matches the provided schema exactly.

Rules:
- Do not hardcode any fixed stakeholder list or system map. Infer them dynamically from the policy text.
- Focus on realistic stakeholders affected, involved, constrained, or empowered by the policy.
- Build nodes that represent actors, resources, stocks, institutions, policy factors, and public outcomes.
- Build connections that describe influence, dependency, conflict, cooperation, information flow,
  money flow, resource flow, or policy impact.
- Connections must use polarity "+" or "-" only, never numeric strength values.
- Detect feedback loops only when they are meaningfully grounded in the policy and generated nodes.
- Write short but meaningful fields, usually one to three sentences each.
- If a stakeholder does not have a corporate structure, explain the closest equivalent plainly.
- The system boundary should explain what is inside the system, what is outside it, and why.
- The policy domain should be treated as housing unless the policy text clearly broadens scope.
"""


class PolicyAnalysisService:
    def __init__(self, repository: PolicyAnalysisRepository, settings: Settings):
        self.repository = repository
        self.settings = settings
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=float(settings.openai_timeout_seconds),
        )

    async def analyze_policy(self, policy_text: str) -> PolicyAnalysisResponse:
        if not self.settings.openai_api_key:
            raise HTTPException(
                status_code=503,
                detail="OPENAI_API_KEY is not configured for policy analysis.",
            )

        llm_result = await self._generate_system_map(policy_text)
        return await self.repository.create_policy_analysis(
            policy_text=policy_text,
            llm_model=self.settings.openai_model,
            analysis=llm_result,
        )

    async def add_note(
        self, policy_id: int, payload: PolicyNoteCreateRequest
    ) -> PolicyNoteResponse:
        return await self.repository.add_note(
            policy_id=policy_id,
            related_object_type=payload.related_object_type,
            related_object_id=payload.related_object_id,
            note_text=payload.note_text,
        )

    async def list_policies(self) -> list[PolicySummaryResponse]:
        return await self.repository.list_policies()

    async def get_policy(self, policy_id: int) -> PolicyAnalysisResponse:
        return await self.repository.get_policy_analysis(policy_id)

    async def get_policy_stakeholders(
        self, policy_id: int
    ) -> list[PolicyStakeholderAnalysis]:
        return await self.repository.get_policy_stakeholders(policy_id)

    async def get_policy_analysis_only(
        self, policy_id: int
    ) -> PolicyAnalysisOnlyResponse:
        return await self.repository.get_policy_analysis_only(policy_id)

    async def get_policy_nodes(self, policy_id: int) -> list[PolicySystemNode]:
        return await self.repository.get_policy_nodes(policy_id)

    async def get_policy_connections(
        self, policy_id: int
    ) -> list[PolicySystemConnection]:
        return await self.repository.get_policy_connections(policy_id)

    async def get_policy_feedback_loops(
        self, policy_id: int
    ) -> list[PolicyFeedbackLoop]:
        return await self.repository.get_policy_feedback_loops(policy_id)

    async def get_policy_boundary(
        self, policy_id: int
    ) -> PolicySystemBoundary | None:
        return await self.repository.get_policy_boundary(policy_id)

    async def get_policy_notes(self, policy_id: int) -> list[PolicyNoteResponse]:
        return await self.repository.get_policy_notes(policy_id)

    async def get_policy_intervention_points(
        self, policy_id: int
    ) -> PolicyInterventionPointsResponse:
        return await self.repository.get_policy_intervention_points(policy_id)

    async def get_policy_graph(self, policy_id: int) -> PolicyGraphResponse:
        return await self.repository.get_policy_graph(policy_id)

    async def delete_policy(self, policy_id: int) -> PolicyDeleteResponse:
        return await self.repository.delete_policy(policy_id)

    async def get_policy_intervention_analysis(
        self, policy_id: int
    ) -> PolicyInterventionAnalysisResponse:
        policy = await self.repository.get_policy_analysis(policy_id)
        recommendations = self._build_intervention_recommendations(policy)
        summary = self._build_intervention_summary(policy, recommendations)
        return PolicyInterventionAnalysisResponse(
            policy_id=policy.policy_id,
            generated_at=datetime.now(UTC).isoformat(),
            analysis_mode="grounded-policy-analysis",
            summary=summary,
            recommendations=recommendations,
        )

    async def get_policy_enhancement_analysis(
        self, policy_id: int
    ) -> PolicyEnhancementAnalysisResponse:
        policy = await self.repository.get_policy_analysis(policy_id)
        intervention_analysis = await self.get_policy_intervention_analysis(policy_id)
        stakeholder_map = {
            stakeholder.stakeholder_id: stakeholder
            for stakeholder in policy.stakeholders
            if stakeholder.stakeholder_id is not None
        }
        node_map = {
            node.policy_node_id: node
            for node in policy.nodes
            if node.policy_node_id is not None
        }
        suggestions = [
            self._build_policy_enhancement_suggestion(
                recommendation=recommendation,
                stakeholder_map=stakeholder_map,
                node_map=node_map,
            )
            for recommendation in intervention_analysis.recommendations[:5]
        ]
        summary = self._build_policy_enhancement_summary(suggestions)
        return PolicyEnhancementAnalysisResponse(
            policy_id=policy_id,
            generated_at=datetime.now(UTC).isoformat(),
            analysis_mode="grounded-policy-enhancement",
            summary=summary,
            suggestions=suggestions,
        )

    async def _generate_system_map(
        self, policy_text: str
    ) -> PolicyAnalysisLLMEnvelope:
        schema = self._build_strict_schema(PolicyAnalysisLLMEnvelope.model_json_schema())

        try:
            response = await self.client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": POLICY_ANALYSIS_SYSTEM_PROMPT}],
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": (
                                    "Analyze the following policy text and return a JSON stakeholder analysis "
                                    "plus system map.\n\n"
                                    f"Policy text:\n{policy_text}"
                                ),
                            }
                        ],
                    },
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "policy_system_map_analysis",
                        "schema": schema,
                        "strict": True,
                    }
                },
            )
        except OpenAIError as exc:
            raise HTTPException(
                status_code=502,
                detail="The LLM policy-analysis request failed before a valid response was returned.",
            ) from exc

        if not getattr(response, "output_text", None):
            raise HTTPException(
                status_code=502,
                detail="The LLM returned an empty policy system-map response.",
            )

        try:
            payload = json.loads(response.output_text)
            return PolicyAnalysisLLMEnvelope.model_validate(payload)
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="The LLM returned a policy system-map response in an unexpected format.",
            ) from exc

    def _build_strict_schema(self, schema: dict) -> dict:
        def visit(value: object) -> object:
            if isinstance(value, dict):
                updated = {key: visit(item) for key, item in value.items()}
                if updated.get("type") == "object":
                    updated["additionalProperties"] = False
                    properties = updated.get("properties")
                    if isinstance(properties, dict):
                        updated["required"] = list(properties.keys())
                return updated
            if isinstance(value, list):
                return [visit(item) for item in value]
            return value

        return visit(schema)

    def _build_intervention_recommendations(
        self, policy: PolicyAnalysisResponse
    ) -> list[PolicyInterventionRecommendation]:
        stakeholder_map = {
            stakeholder.stakeholder_id: stakeholder
            for stakeholder in policy.stakeholders
            if stakeholder.stakeholder_id is not None
        }
        node_map = {
            node.policy_node_id: node
            for node in policy.nodes
            if node.policy_node_id is not None
        }
        notes_by_type = defaultdict(list)
        for note in policy.notes:
            notes_by_type[note.related_object_type].append(note)

        grouped_points: dict[str, dict] = {}
        for loop in policy.feedback_loops:
            points = loop.possible_intervention_points or []
            if not points:
                points = [self._fallback_point_from_loop(loop, node_map)]
            for raw_point in points:
                point = raw_point.strip()
                if not point:
                    continue
                key = self._slugify(point)
                bucket = grouped_points.setdefault(
                    key,
                    {
                        "title": point,
                        "loops": [],
                        "node_ids": set(),
                        "stakeholder_ids": set(),
                    },
                )
                bucket["loops"].append(loop)
                bucket["node_ids"].update(loop.involved_node_ids)
                bucket["stakeholder_ids"].update(loop.affected_stakeholder_ids)

        if not grouped_points:
            for node in self._select_fallback_nodes(policy.nodes, policy.connections):
                title = f"Stabilize {node.label}"
                key = self._slugify(title)
                grouped_points[key] = {
                    "title": title,
                    "loops": [],
                    "node_ids": {node.policy_node_id} if node.policy_node_id is not None else set(),
                    "stakeholder_ids": set(node.related_stakeholder_ids),
                }

        recommendations: list[PolicyInterventionRecommendation] = []
        for key, bucket in grouped_points.items():
            loop_ids = [
                loop.feedback_loop_id
                for loop in bucket["loops"]
                if loop.feedback_loop_id is not None
            ]
            node_ids = sorted(
                node_id for node_id in bucket["node_ids"] if node_id is not None
            )
            stakeholder_ids = sorted(
                stakeholder_id
                for stakeholder_id in bucket["stakeholder_ids"]
                if stakeholder_id is not None
            )
            affected_nodes = [node_map[node_id] for node_id in node_ids if node_id in node_map]
            affected_stakeholders = [
                stakeholder_map[stakeholder_id]
                for stakeholder_id in stakeholder_ids
                if stakeholder_id in stakeholder_map
            ]

            supporting_evidence = self._build_supporting_evidence(
                policy=policy,
                loops=bucket["loops"],
                nodes=affected_nodes,
                stakeholders=affected_stakeholders,
                notes_by_type=notes_by_type,
                intervention_title=bucket["title"],
            )
            implementation_notes = self._build_implementation_notes(
                policy=policy,
                stakeholders=affected_stakeholders,
                nodes=affected_nodes,
            )
            tradeoffs = self._build_tradeoffs(
                policy=policy,
                stakeholders=affected_stakeholders,
            )
            confidence = self._score_confidence(
                loops=bucket["loops"],
                stakeholder_count=len(affected_stakeholders),
                evidence_count=len(supporting_evidence),
                note_count=len(notes_by_type.get("policy", [])),
            )
            score = self._rank_intervention(
                loops=bucket["loops"],
                stakeholder_count=len(affected_stakeholders),
                node_count=len(affected_nodes),
                note_count=len(notes_by_type.get("policy", [])),
            )
            recommendations.append(
                PolicyInterventionRecommendation(
                    rank=0,
                    intervention_key=key,
                    title=self._title_case_intervention(bucket["title"]),
                    recommended_action=self._build_recommended_action(
                        bucket["title"], affected_nodes
                    ),
                    reason=self._build_intervention_reason(
                        policy=policy,
                        title=bucket["title"],
                        loops=bucket["loops"],
                        nodes=affected_nodes,
                        stakeholders=affected_stakeholders,
                    ),
                    supporting_evidence=supporting_evidence,
                    targeted_feedback_loop_ids=loop_ids,
                    targeted_node_ids=node_ids,
                    affected_stakeholder_ids=stakeholder_ids,
                    stakeholder_focus=[
                        stakeholder.stakeholder_name for stakeholder in affected_stakeholders
                    ],
                    implementation_notes=implementation_notes,
                    tradeoffs=tradeoffs,
                    expected_system_shift=self._build_expected_shift(
                        policy=policy,
                        loops=bucket["loops"],
                        nodes=affected_nodes,
                    ),
                    confidence=confidence,
                )
            )

        recommendations.sort(
            key=lambda item: (
                len(item.targeted_feedback_loop_ids),
                len(item.affected_stakeholder_ids),
                item.confidence,
            ),
            reverse=True,
        )
        for index, recommendation in enumerate(recommendations, start=1):
            recommendation.rank = index
        return recommendations[:5]

    def _build_intervention_summary(
        self,
        policy: PolicyAnalysisResponse,
        recommendations: list[PolicyInterventionRecommendation],
    ) -> str:
        if not recommendations:
            return (
                f"No strong intervention recommendation could be derived for policy {policy.policy_id}. "
                f"Manual review is still required against the system purpose: "
                f"{policy.system_boundary.system_purpose}."
            )
        top = recommendations[0]
        loop_count = len(policy.feedback_loops)
        boundary_purpose = self._clean_phrase(policy.system_boundary.system_purpose)
        if loop_count == 0:
            return (
                f"Prioritize {top.title} first. No explicit feedback loops were captured in the saved map, "
                f"so this ranking is grounded in node centrality, stakeholder exposure, and alignment with "
                f"the system purpose: {boundary_purpose}."
            )
        return (
            f"Prioritize {top.title} first. It has the strongest grounding in the current system map "
            f"because it addresses {len(top.targeted_feedback_loop_ids)} feedback loop(s), focuses on "
            f"{len(top.affected_stakeholder_ids)} stakeholder group(s), and aligns with the system purpose: "
            f"{boundary_purpose}. The current policy map contains "
            f"{loop_count} feedback loop(s), so intervention design should stay tightly tied to the saved evidence."
        )

    def _fallback_point_from_loop(
        self, loop: PolicyFeedbackLoop, node_map: dict[int, PolicySystemNode]
    ) -> str:
        labels = [
            node_map[node_id].label
            for node_id in loop.involved_node_ids
            if node_id in node_map
        ]
        if labels:
            return f"Coordinate pressure around {' and '.join(labels[:2])}"
        return f"Stabilize {loop.loop_name}"

    def _select_fallback_nodes(
        self,
        nodes: list[PolicySystemNode],
        connections: list[PolicySystemConnection],
    ) -> list[PolicySystemNode]:
        degree = defaultdict(int)
        for connection in connections:
            degree[connection.source_node_id] += 1
            degree[connection.target_node_id] += 1
        ranked = sorted(
            [node for node in nodes if node.policy_node_id is not None],
            key=lambda node: degree.get(node.policy_node_id, 0),
            reverse=True,
        )
        return ranked[:3]

    def _build_supporting_evidence(
        self,
        policy: PolicyAnalysisResponse,
        loops: list[PolicyFeedbackLoop],
        nodes: list[PolicySystemNode],
        stakeholders: list[PolicyStakeholderAnalysis],
        notes_by_type: dict[str, list[PolicyNoteResponse]],
        intervention_title: str,
    ) -> list[str]:
        evidence = [
            f"System purpose: {self._clean_phrase(policy.system_boundary.system_purpose)}.",
        ]
        for loop in loops[:2]:
            evidence.append(f"Loop signal: {self._clean_phrase(loop.explanation)}.")
        for node in nodes[:2]:
            evidence.append(
                f"Node pressure: {node.label} matters because {self._clean_phrase(node.description)}."
            )
        for stakeholder in stakeholders[:2]:
            evidence.append(
                f"Stakeholder pressure: {stakeholder.stakeholder_name} is motivated by "
                f"{self._clean_phrase(stakeholder.micro_level.main_motivation).lower()} and is pursuing "
                f"{self._clean_phrase(stakeholder.micro_level.goals).lower()}."
            )
        for note in notes_by_type.get("policy", [])[:2]:
            evidence.append(f"Existing note signal: {self._clean_phrase(note.note_text)}.")
        if not evidence:
            evidence.append(f"The intervention '{intervention_title}' is grounded in the saved policy graph.")
        return evidence[:6]

    def _build_implementation_notes(
        self,
        policy: PolicyAnalysisResponse,
        stakeholders: list[PolicyStakeholderAnalysis],
        nodes: list[PolicySystemNode],
    ) -> list[str]:
        notes: list[str] = []
        for stakeholder in stakeholders[:2]:
            notes.append(
                f"Coordinate with {stakeholder.stakeholder_name} around "
                f"{self._clean_phrase(stakeholder.meso_level.required_resources_dependencies).lower()}."
            )
            cooperation_partners = self._clean_phrase(
                stakeholder.meso_level.cooperation_partners
            )
            if cooperation_partners:
                notes.append(
                    f"Use existing cooperation channels with {cooperation_partners.lower()}."
                )
        if nodes:
            notes.append(
                f"Track delivery on {', '.join(node.label for node in nodes[:2])} so the intervention can be adjusted quickly."
            )
        if not notes:
            notes.append(
                f"Implement against the system boundary goal: {policy.system_boundary.system_purpose}."
            )
        return notes[:5]

    def _build_tradeoffs(
        self,
        policy: PolicyAnalysisResponse,
        stakeholders: list[PolicyStakeholderAnalysis],
    ) -> list[str]:
        tradeoffs: list[str] = []
        for stakeholder in stakeholders[:2]:
            competitors = self._clean_phrase(stakeholder.meso_level.competitors_antagonists)
            if competitors and competitors.lower() not in {"none", "none directly", "n/a", "na"}:
                tradeoffs.append(
                    f"{stakeholder.stakeholder_name}: watch resistance from "
                    f"{competitors.lower()}."
                )
            economic_regulation = self._clean_phrase(
                stakeholder.macro_level.economic_policy_regulation
            )
            if economic_regulation:
                tradeoffs.append(
                    f"{stakeholder.stakeholder_name}: regulatory exposure remains tied to "
                    f"{economic_regulation.lower()}."
                )
        if not tradeoffs:
            tradeoffs.append(
                f"Any intervention still has to stay inside the system boundary defined for policy {policy.policy_id}."
            )
        return tradeoffs[:5]

    def _build_recommended_action(
        self, title: str, nodes: list[PolicySystemNode]
    ) -> str:
        if nodes:
            return (
                f"Use {title.lower()} to directly change pressure on "
                f"{', '.join(node.label for node in nodes[:2])}."
            )
        return f"Use {title.lower()} as a targeted intervention rather than a broad policy change."

    def _build_intervention_reason(
        self,
        policy: PolicyAnalysisResponse,
        title: str,
        loops: list[PolicyFeedbackLoop],
        nodes: list[PolicySystemNode],
        stakeholders: list[PolicyStakeholderAnalysis],
    ) -> str:
        loop_phrase = (
            ", ".join(loop.loop_name for loop in loops[:2])
            if loops
            else "the current mapped system pressures"
        )
        node_phrase = (
            ", ".join(node.label for node in nodes[:2])
            if nodes
            else "the most central system elements"
        )
        stakeholder_phrase = (
            ", ".join(stakeholder.stakeholder_name for stakeholder in stakeholders[:3])
            if stakeholders
            else "the currently mapped stakeholders"
        )
        boundary_purpose = self._clean_phrase(policy.system_boundary.system_purpose)
        return (
            f"We are recommending {title.lower()} because it directly addresses {loop_phrase}, "
            f"which is pushing pressure through {node_phrase}. That matters for {stakeholder_phrase}, "
            f"and it is consistent with the system purpose: {boundary_purpose}."
        )

    def _build_expected_shift(
        self,
        policy: PolicyAnalysisResponse,
        loops: list[PolicyFeedbackLoop],
        nodes: list[PolicySystemNode],
    ) -> str:
        reinforcing_count = sum(1 for loop in loops if loop.loop_type == "reinforcing")
        if reinforcing_count:
            return (
                f"Expected shift: reduce reinforcing pressure across "
                f"{', '.join(node.label for node in nodes[:2]) if nodes else 'the highest-pressure nodes'} "
                f"while keeping the system aligned with {self._clean_phrase(policy.system_boundary.system_purpose).lower()}."
            )
        return (
            f"Expected shift: stabilize execution around "
            f"{', '.join(node.label for node in nodes[:2]) if nodes else 'the mapped nodes'} "
            f"and protect the system boundary objective."
        )

    def _rank_intervention(
        self,
        loops: list[PolicyFeedbackLoop],
        stakeholder_count: int,
        node_count: int,
        note_count: int,
    ) -> float:
        reinforcing_bonus = sum(4 for loop in loops if loop.loop_type == "reinforcing")
        balancing_bonus = sum(2 for loop in loops if loop.loop_type == "balancing")
        return (
            len(loops) * 10
            + reinforcing_bonus
            + balancing_bonus
            + stakeholder_count * 3
            + node_count * 2
            + min(note_count, 3)
        )

    def _score_confidence(
        self,
        loops: list[PolicyFeedbackLoop],
        stakeholder_count: int,
        evidence_count: int,
        note_count: int,
    ) -> float:
        raw = 0.52 + min(len(loops), 3) * 0.08 + min(stakeholder_count, 3) * 0.04
        raw += min(evidence_count, 6) * 0.02 + min(note_count, 2) * 0.03
        return round(min(raw, 0.94), 2)

    def _title_case_intervention(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            return "Intervention Recommendation"
        if re.search(r"[A-Z]", stripped):
            return stripped
        return stripped[:1].upper() + stripped[1:]

    def _slugify(self, value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return slug or "intervention"

    def _clean_phrase(self, value: str) -> str:
        return re.sub(r"\s+", " ", value.strip().rstrip(".")).strip()

    def _build_policy_enhancement_suggestion(
        self,
        recommendation: PolicyInterventionRecommendation,
        stakeholder_map: dict[int, PolicyStakeholderAnalysis],
        node_map: dict[int, PolicySystemNode],
    ) -> PolicyEnhancementSuggestion:
        stakeholders = [
            stakeholder_map[stakeholder_id]
            for stakeholder_id in recommendation.affected_stakeholder_ids
            if stakeholder_id in stakeholder_map
        ]
        nodes = [
            node_map[node_id]
            for node_id in recommendation.targeted_node_ids
            if node_id in node_map
        ]
        return PolicyEnhancementSuggestion(
            rank=recommendation.rank,
            enhancement_key=f"policy-addition-{recommendation.intervention_key}",
            title=f"Add {recommendation.title} language",
            suggested_policy_section=self._suggest_policy_section(recommendation, nodes),
            what_to_add=self._build_policy_addition_text(stakeholders, nodes),
            draft_clause=self._build_draft_clause(stakeholders, nodes),
            reason=self._build_policy_addition_reason(
                recommendation, stakeholders, nodes
            ),
            affected_stakeholder_ids=recommendation.affected_stakeholder_ids,
            affected_stakeholders=[
                stakeholder.stakeholder_name for stakeholder in stakeholders
            ],
            based_on_intervention_keys=[recommendation.intervention_key],
            based_on_feedback_loop_ids=recommendation.targeted_feedback_loop_ids,
            based_on_node_ids=recommendation.targeted_node_ids,
            expected_policy_effect=self._build_policy_effect(nodes),
            risks_if_omitted=self._build_policy_omission_risks(stakeholders),
        )

    def _build_policy_enhancement_summary(
        self, suggestions: list[PolicyEnhancementSuggestion]
    ) -> str:
        if not suggestions:
            return (
                "No policy-incorporation suggestions could be derived from the current "
                "intervention analysis."
            )
        top = suggestions[0]
        return (
            f"Start by strengthening the {top.suggested_policy_section.lower()} section. "
            f"The highest-ranked intervention is most useful when translated into explicit policy text "
            f"instead of remaining only as an external recommendation."
        )

    def _suggest_policy_section(
        self,
        recommendation: PolicyInterventionRecommendation,
        nodes: list[PolicySystemNode],
    ) -> str:
        text = " ".join(
            [
                recommendation.title,
                recommendation.recommended_action,
                recommendation.reason,
                " ".join(node.label for node in nodes),
            ]
        ).lower()
        if any(keyword in text for keyword in ["tenant", "landlord", "protection", "safeguard"]):
            return "Safeguards and Compliance"
        if any(keyword in text for keyword in ["coordination", "agency", "approval", "governance"]):
            return "Governance and Coordination"
        if any(keyword in text for keyword in ["report", "monitor", "trust", "accountability"]):
            return "Monitoring and Accountability"
        return "Implementation and Delivery"

    def _build_policy_addition_text(
        self,
        stakeholders: list[PolicyStakeholderAnalysis],
        nodes: list[PolicySystemNode],
    ) -> str:
        stakeholder_text = (
            ", ".join(stakeholder.stakeholder_name for stakeholder in stakeholders[:3])
            if stakeholders
            else "the responsible public and delivery actors"
        )
        node_text = (
            ", ".join(node.label for node in nodes[:3])
            if nodes
            else "the highest-pressure system elements"
        )
        return (
            f"Add a clause that requires {stakeholder_text} to take explicit action on {node_text}, "
            f"with named responsibilities, clear timelines, and a review trigger if delivery or safeguards fall behind."
        )

    def _build_draft_clause(
        self,
        stakeholders: list[PolicyStakeholderAnalysis],
        nodes: list[PolicySystemNode],
    ) -> str:
        stakeholder_text = (
            ", ".join(stakeholder.stakeholder_name for stakeholder in stakeholders[:2])
            if stakeholders
            else "responsible agencies and implementation partners"
        )
        node_text = (
            ", ".join(node.label for node in nodes[:2])
            if nodes
            else "the mapped system risks"
        )
        return (
            f"The policy shall require {stakeholder_text} to coordinate actions affecting {node_text}, "
            f"publish progress milestones, and initiate corrective review where targets, safeguards, or service readiness are not being met."
        )

    def _build_policy_addition_reason(
        self,
        recommendation: PolicyInterventionRecommendation,
        stakeholders: list[PolicyStakeholderAnalysis],
        nodes: list[PolicySystemNode],
    ) -> str:
        stakeholder_text = (
            ", ".join(stakeholder.stakeholder_name for stakeholder in stakeholders[:3])
            if stakeholders
            else "the mapped stakeholders"
        )
        node_text = (
            ", ".join(node.label for node in nodes[:2])
            if nodes
            else "the mapped pressure points"
        )
        return (
            f"Add this because the intervention analysis shows that {stakeholder_text} are materially affected "
            f"through {node_text}. Writing the intervention into the policy turns it into an enforceable operating instruction rather than a separate advisory idea."
        )

    def _build_policy_effect(self, nodes: list[PolicySystemNode]) -> str:
        node_text = (
            ", ".join(node.label for node in nodes[:2])
            if nodes
            else "the mapped system nodes"
        )
        return (
            f"Expected effect: shift {node_text} from informal implementation risk into explicit policy execution that can be monitored and enforced."
        )

    def _build_policy_omission_risks(
        self, stakeholders: list[PolicyStakeholderAnalysis]
    ) -> list[str]:
        risks = [
            "The intervention may remain advisory, with no explicit policy obligation to act on it.",
            "Different delivery actors may interpret responsibilities inconsistently.",
        ]
        for stakeholder in stakeholders[:2]:
            risks.append(
                f"{stakeholder.stakeholder_name} may continue to act on existing incentives unless the policy text explicitly redirects behavior."
            )
        return risks[:4]
