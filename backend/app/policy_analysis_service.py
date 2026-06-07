import asyncio
import json
from collections import defaultdict
from datetime import UTC, datetime
import re
from urllib.parse import quote
from urllib.request import Request, urlopen

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
    FrontendBundleItem,
    FrontendChatRequest,
    FrontendChatResponse,
    FrontendDataset,
    FrontendDatasetSearchResponse,
    FrontendImpact,
    FrontendLoop,
    FrontendLoopChainStep,
    FrontendPolicyAnalysisRequest,
    FrontendPolicyAnalysisResponse,
    FrontendPolicySummary,
    FrontendStakeholder,
    FrontendWarning,
    FrontendAnalysisRow,
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
- Focus on realistic stakeholders and entities affected, involved, constrained, empowered, or made accountable by the policy.
- Search for stakeholders as a real delivery problem: include decision owners, frontline implementers,
  regulated market actors, vulnerable or indirectly affected residents, financing actors, enforcement bodies,
  data owners, and opponents whose incentives could block the policy.
- Exclude generic filler. Every stakeholder must explain a concrete motivation, constraint, resource dependency,
  or accountability relationship that matters for implementation.
- Build a system map that is useful for intervention design, not just a stakeholder inventory.
- Build nodes that represent system stakeholders/entities affected by policy plus the resources, stocks,
  institutions, bottlenecks, pressures, and public outcomes they influence.
- Build 8 to 14 distinct nodes unless the policy is unusually simple.
- Prefer concrete labels such as "Rent Level", "Construction Capacity", "Permit Delay", "Tenant Stress",
  "Public Housing Supply", or "Land Availability" over vague labels such as "market issue".
- Build connections that describe influence, dependency, conflict, cooperation, information flow,
  money flow, resource flow, or policy impact.
- Each connection must show cause and effect: how the source changes the target, which stakeholder/entity is affected,
  and why that matters for the policy outcome.
- Avoid disconnected decorative edges. Every connection must help explain a real ripple effect or implementation risk.
- Connections must use polarity "+" or "-" only, never numeric strength values.
- "+" means the source increases or strengthens the target. "-" means the source reduces or weakens the target.
- Detect feedback loops only when they are meaningfully grounded in the policy and generated nodes.
- If the policy implies a cycle, make that cycle explicit through the nodes, connections, and saved feedback loops.
- Feedback loops should capture the cycles that matter for later intervention design.
- Possible intervention points must be specific policy, regulatory, funding, enforcement, data-sharing,
  sequencing, or delivery levers. Name the exact node or relationship they are meant to change.
- The full map should let a decision-maker trace: policy lever -> affected node/entity -> downstream nodes ->
  feedback loop or public outcome.
- Write short but meaningful fields, usually one to three sentences each.
- If a stakeholder does not have a corporate structure, explain the closest equivalent plainly.
- Do not generate a separate system boundary section.
- The policy domain should be treated as housing unless the policy text clearly broadens scope.
"""

FRONTEND_CHAT_SYSTEM_PROMPT = """
You are the PolicyGraph HK assistant: a grounded, concise policy analyst.

Rules:
- Stay grounded in the supplied policy, datasets, and current analysis summary.
- Be specific to Hong Kong housing policy.
- Keep answers under 200 words unless the user explicitly asks for more.
- If the current sources do not support a claim, say so directly and suggest what dataset or evidence is missing.
- When suggesting actions, phrase them as concrete next steps for the analyst.
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

    async def analyze_policy_for_frontend(
        self, payload: FrontendPolicyAnalysisRequest
    ) -> FrontendPolicyAnalysisResponse:
        datasets = payload.selected_datasets or await self._suggest_frontend_datasets(
            payload.query
        )
        composed_policy_text = self._compose_frontend_policy_text(payload, datasets)
        policy = await self.analyze_policy(composed_policy_text)
        intervention_analysis = await self.get_policy_intervention_analysis(policy.policy_id)
        enhancement_analysis = await self.get_policy_enhancement_analysis(policy.policy_id)
        return self._build_frontend_analysis_response(
            query=payload.query,
            horizon=payload.horizon,
            datasets=datasets,
            policy=policy,
            intervention_analysis=intervention_analysis,
            enhancement_analysis=enhancement_analysis,
        )

    async def search_frontend_datasets(
        self, query: str, rows: int
    ) -> FrontendDatasetSearchResponse:
        results = await self._search_data_gov_hk(query, rows)
        return FrontendDatasetSearchResponse(results=results)

    async def chat_with_frontend_context(
        self, payload: FrontendChatRequest
    ) -> FrontendChatResponse:
        if not self.settings.openai_api_key:
            raise HTTPException(
                status_code=503,
                detail="OPENAI_API_KEY is not configured for policy chat.",
            )

        dataset_lines = "\n".join(
            f"- {item.get('title', 'Untitled source')} — {item.get('url', '')}"
            for item in payload.context.datasets
        )
        context_block = (
            f"Current step: {payload.context.step}\n"
            f"Policy under analysis: {payload.context.query or '(not yet entered)'}\n"
            f"Horizon: {payload.context.horizon or 'n/a'}\n"
            f"Datasets:\n{dataset_lines or '- none selected'}\n\n"
            f"Latest analysis summary:\n{payload.context.analysis_summary or '(no analysis yet)'}"
        )

        try:
            response = await self.client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "input_text",
                                "text": FRONTEND_CHAT_SYSTEM_PROMPT,
                            }
                        ],
                    },
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": context_block}],
                    },
                    *[
                        {
                            "role": message.role,
                            "content": [
                                {"type": "input_text", "text": message.content}
                            ],
                        }
                        for message in payload.messages
                    ],
                ],
            )
        except OpenAIError as exc:
            raise HTTPException(
                status_code=502,
                detail="The policy assistant could not generate a reply.",
            ) from exc

        reply = getattr(response, "output_text", "").strip()
        if not reply:
            raise HTTPException(
                status_code=502,
                detail="The policy assistant returned an empty reply.",
            )
        return FrontendChatResponse(reply=reply)

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

    async def update_note(
        self, policy_id: int, note_id: int, note_text: str
    ) -> PolicyNoteResponse:
        return await self.repository.update_note(
            policy_id=policy_id, note_id=note_id, note_text=note_text
        )

    async def update_policy_node(
        self, policy_id: int, node_id: int, payload: dict
    ) -> PolicySystemNode:
        return await self.repository.update_policy_node(policy_id, node_id, payload)

    async def update_policy_connection(
        self, policy_id: int, connection_id: int, payload: dict
    ) -> PolicySystemConnection:
        return await self.repository.update_policy_connection(
            policy_id, connection_id, payload
        )

    async def update_policy_feedback_loop(
        self, policy_id: int, feedback_loop_id: int, payload: dict
    ) -> PolicyFeedbackLoop:
        return await self.repository.update_policy_feedback_loop(
            policy_id, feedback_loop_id, payload
        )

    async def update_policy_boundary(
        self, policy_id: int, payload: dict
    ) -> PolicySystemBoundary:
        return await self.repository.update_policy_boundary(policy_id, payload)

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

    def _compose_frontend_policy_text(
        self,
        payload: FrontendPolicyAnalysisRequest,
        datasets: list[FrontendDataset],
    ) -> str:
        sections = [f"Policy query: {payload.query.strip()}"]
        sections.append(
            "Stakeholder and causal-map discovery brief:\n"
            "- Identify concrete Hong Kong actors and entities whose incentives, constraints, or decisions shape implementation.\n"
            "- Prioritize real-world bottlenecks, accountability gaps, delivery dependencies, vulnerable groups, market responses, and enforcement risks.\n"
            "- Make each node and connection useful for deciding where to intervene; avoid generic labels and unsupported relationships.\n"
            "- Show the ripple effect from policy lever to affected entities, downstream system behavior, and eventual public outcomes."
        )
        if payload.horizon:
            sections.append(f"Horizon emphasis: {payload.horizon}")
        if payload.draft_text:
            sections.append(
                "Draft policy text:\n"
                + payload.draft_text.strip()[:10000]
            )
        if payload.extra_stakeholders:
            sections.append(
                "Extra stakeholders to include:\n"
                + "\n".join(
                    f"- {item.label} ({item.level}): {item.note or 'No additional note.'}"
                    for item in payload.extra_stakeholders
                )
            )
        if datasets:
            sections.append(
                "Context datasets from data.gov.hk:\n"
                + "\n".join(
                    f"- {item.title} ({item.organization}) [{item.query}]"
                    for item in datasets[:8]
                )
            )
        return "\n\n".join(sections)

    async def _suggest_frontend_datasets(
        self, query: str
    ) -> list[FrontendDataset]:
        collected: list[FrontendDataset] = []
        seen: set[str] = set()
        for suggestion in self._build_dataset_queries(query):
            for dataset in await self._search_data_gov_hk(suggestion, 3):
                if dataset.id in seen:
                    continue
                seen.add(dataset.id)
                collected.append(dataset)
                if len(collected) >= 8:
                    return collected
        return collected

    def _build_dataset_queries(self, query: str) -> list[str]:
        lowered = query.lower()
        queries = ["housing", "public housing", "rental"]
        if any(term in lowered for term in ("tenant", "rent", "landlord")):
            queries.extend(["rent index", "tenancy", "household income"])
        if any(term in lowered for term in ("approval", "permit", "construction", "contractor")):
            queries.extend(["construction", "housing supply", "land supply"])
        if any(term in lowered for term in ("transport", "utility", "district")):
            queries.extend(["transport", "district population"])
        unique: list[str] = []
        seen: set[str] = set()
        for item in queries:
            if item in seen:
                continue
            seen.add(item)
            unique.append(item)
        return unique[:6]

    async def _search_data_gov_hk(
        self, query: str, rows: int
    ) -> list[FrontendDataset]:
        url = (
            "https://data.gov.hk/en-data/api/3/action/package_search"
            f"?q={quote(query)}&rows={rows}"
        )

        def fetch_sync() -> list[FrontendDataset]:
            request = Request(url, headers={"Accept": "application/json"})
            with urlopen(request, timeout=20) as response:
                body = json.loads(response.read().decode("utf-8"))
            results = body.get("result", {}).get("results", [])
            datasets: list[FrontendDataset] = []
            for result in results[:rows]:
                dataset_id = result.get("id") or result.get("name") or self._slugify(
                    result.get("title", "dataset")
                )
                dataset_name = result.get("name") or result.get("id") or dataset_id
                datasets.append(
                    FrontendDataset(
                        id=str(dataset_id),
                        title=result.get("title") or dataset_name,
                        organization=(
                            (result.get("organization") or {}).get("title")
                            or "data.gov.hk"
                        ),
                        notes=(result.get("notes") or "")[:400],
                        url=f"https://data.gov.hk/en-data/dataset/{dataset_name}",
                        query=query,
                    )
                )
            return datasets

        try:
            return await asyncio.to_thread(fetch_sync)
        except Exception:
            return []

    def _build_frontend_analysis_response(
        self,
        query: str,
        horizon: str | None,
        datasets: list[FrontendDataset],
        policy: PolicyAnalysisResponse,
        intervention_analysis: PolicyInterventionAnalysisResponse,
        enhancement_analysis: PolicyEnhancementAnalysisResponse,
    ) -> FrontendPolicyAnalysisResponse:
        stakeholders = self._build_frontend_stakeholders(
            policy.stakeholders, policy.nodes, policy.feedback_loops
        )
        loops = self._build_frontend_loops(policy)
        impact_short, impact_long = self._estimate_frontend_impacts(
            query=query,
            horizon=horizon,
            policy=policy,
            intervention_analysis=intervention_analysis,
        )
        warnings = self._build_frontend_warnings(
            policy=policy,
            intervention_analysis=intervention_analysis,
        )
        bundle = self._build_frontend_bundle(
            intervention_analysis=intervention_analysis,
            enhancement_analysis=enhancement_analysis,
        )
        label = self._derive_policy_label(query)
        summary = self._derive_policy_summary(query, policy)
        return FrontendPolicyAnalysisResponse(
            policy_id=policy.policy_id,
            interpretation=self._build_frontend_interpretation(policy, intervention_analysis),
            policy=FrontendPolicySummary(label=label, summary=summary),
            stakeholders=stakeholders,
            loops=loops,
            impactShort=impact_short,
            impactLong=impact_long,
            warnings=warnings,
            bundle=bundle,
            bundleRationale=intervention_analysis.summary,
            sources=[
                {"label": dataset.title, "url": dataset.url}
                for dataset in datasets[:10]
            ],
            datasetUsage=self._build_dataset_usage(datasets),
            datasets=datasets,
            graph=PolicyGraphResponse(
                policy=PolicySummaryResponse(
                    policy_id=policy.policy_id,
                    text_preview=self._clean_phrase(policy.text)[:120],
                    policy_domain=policy.policy_domain,
                    llm_model=policy.llm_model,
                    created_at=policy.created_at,
                    stakeholder_count=len(policy.stakeholders),
                    node_count=len(policy.nodes),
                    connection_count=len(policy.connections),
                    feedback_loop_count=len(policy.feedback_loops),
                    note_count=len(policy.notes),
                ),
                stakeholders=policy.stakeholders,
                nodes=policy.nodes,
                edges=policy.connections,
                feedback_loops=policy.feedback_loops,
                system_boundary=policy.system_boundary,
                intervention_points=policy.possible_intervention_points,
                notes=policy.notes,
            ),
        )

    def _build_frontend_interpretation(
        self,
        policy: PolicyAnalysisResponse,
        intervention_analysis: PolicyInterventionAnalysisResponse,
    ) -> str:
        top = intervention_analysis.recommendations[0].title if intervention_analysis.recommendations else "targeted intervention review"
        return (
            f"This analysis maps the policy as a housing system, highlights the main actor pressures, "
            f"and points to {top.lower()} as the first leverage area."
        )

    def _derive_policy_label(self, query: str) -> str:
        cleaned = re.sub(r"\s+", " ", query.strip())
        words = cleaned.split()
        label = " ".join(words[:8]).strip()
        label = label.rstrip(".,;:")
        if not label:
            return "Housing policy analysis"
        return label[:1].upper() + label[1:]

    def _derive_policy_summary(
        self, query: str, policy: PolicyAnalysisResponse
    ) -> str:
        excerpt = re.sub(r"\s+", " ", query.strip())
        if len(excerpt) > 180:
            excerpt = excerpt[:177].rstrip() + "..."
        return (
            f"{excerpt} This is interpreted as a causal housing system with stakeholder pressure, "
            "delivery bottlenecks, and feedback loops that shape outcomes."
        )

    def _build_frontend_stakeholders(
        self,
        stakeholders: list[PolicyStakeholderAnalysis],
        nodes: list[PolicySystemNode],
        loops: list[PolicyFeedbackLoop],
    ) -> list[FrontendStakeholder]:
        exposure_by_stakeholder: dict[int, int] = defaultdict(int)
        for node in nodes:
            for stakeholder_id in node.related_stakeholder_ids:
                exposure_by_stakeholder[stakeholder_id] += 1
        for loop in loops:
            for stakeholder_id in loop.affected_stakeholder_ids:
                exposure_by_stakeholder[stakeholder_id] += 2

        results: list[FrontendStakeholder] = []
        for index, stakeholder in enumerate(stakeholders):
            stakeholder_id = stakeholder.stakeholder_id or stakeholder.analysis_id or index + 1
            group = self._infer_frontend_group(stakeholder)
            level = self._infer_frontend_level(stakeholder)
            impact = self._infer_frontend_impact(stakeholder, exposure_by_stakeholder.get(stakeholder_id, 0))
            results.append(
                FrontendStakeholder(
                    id=stakeholder.stakeholder_key
                    or f"stakeholder-{stakeholder_id}",
                    label=stakeholder.stakeholder_name,
                    short=self._build_short_label(stakeholder.stakeholder_name),
                    group=group,
                    level=level,
                    impact=impact,
                    note=stakeholder.stakeholder_summary,
                    analysis=self._build_frontend_analysis_rows(stakeholder),
                )
            )
        return results

    def _build_frontend_analysis_rows(
        self, stakeholder: PolicyStakeholderAnalysis
    ) -> list[FrontendAnalysisRow]:
        return [
            FrontendAnalysisRow(
                key="mainMotivation",
                label="Main Motivation",
                value=stakeholder.micro_level.main_motivation,
            ),
            FrontendAnalysisRow(
                key="goals",
                label="Goals",
                value=stakeholder.micro_level.goals,
            ),
            FrontendAnalysisRow(
                key="orgStructure",
                label="Organisational Structure / Shareholders",
                value=stakeholder.micro_level.organizational_structure_shareholders,
            ),
            FrontendAnalysisRow(
                key="culture",
                label="Corporate Culture / Communication",
                value=stakeholder.micro_level.corporate_culture_communication_processes,
            ),
            FrontendAnalysisRow(
                key="requiredResources",
                label="Required Resources / Dependencies",
                value=stakeholder.meso_level.required_resources_dependencies,
            ),
            FrontendAnalysisRow(
                key="availableResources",
                label="Available Resources",
                value=stakeholder.meso_level.available_resources,
            ),
            FrontendAnalysisRow(
                key="involvedParties",
                label="Stakeholders",
                value=stakeholder.meso_level.stakeholders,
            ),
            FrontendAnalysisRow(
                key="cooperationPartners",
                label="Cooperation Partners",
                value=stakeholder.meso_level.cooperation_partners,
            ),
            FrontendAnalysisRow(
                key="competitors",
                label="Competitors / Antagonists",
                value=stakeholder.meso_level.competitors_antagonists,
            ),
            FrontendAnalysisRow(
                key="legislators",
                label="Legislators",
                value=stakeholder.macro_level.legislators_national_international,
            ),
            FrontendAnalysisRow(
                key="economicPolicy",
                label="Economic Policy / Regulation",
                value=stakeholder.macro_level.economic_policy_regulation,
            ),
            FrontendAnalysisRow(
                key="globalMarkets",
                label="Global Markets & Trends",
                value=stakeholder.macro_level.global_markets_trends,
            ),
            FrontendAnalysisRow(
                key="societyNgos",
                label="Society / Public / NGOs",
                value=stakeholder.macro_level.society_public_ngos,
            ),
            FrontendAnalysisRow(
                key="media",
                label="Media / Social Media",
                value=stakeholder.macro_level.media_social_media,
            ),
            FrontendAnalysisRow(
                key="technology",
                label="Technological Developments",
                value=stakeholder.macro_level.technological_developments,
            ),
            FrontendAnalysisRow(
                key="environment",
                label="Environment / Climate Change",
                value=stakeholder.macro_level.environment_climate_change,
            ),
            FrontendAnalysisRow(
                key="culturalNorms",
                label="Cultural Norms & Values",
                value=stakeholder.macro_level.cultural_norms_values,
            ),
        ]

    def _build_frontend_loops(
        self, policy: PolicyAnalysisResponse
    ) -> list[FrontendLoop]:
        node_map = {
            node.policy_node_id: node.label
            for node in policy.nodes
            if node.policy_node_id is not None
        }
        connection_map = {
            connection.connection_id: connection
            for connection in policy.connections
            if connection.connection_id is not None
        }
        loops: list[FrontendLoop] = []
        for loop in policy.feedback_loops:
            chain = []
            for node_id in loop.involved_node_ids[:4]:
                label = node_map.get(node_id)
                if not label:
                    continue
                effect = "adds pressure"
                for connection_id in loop.involved_connection_ids:
                    connection = connection_map.get(connection_id)
                    if not connection:
                        continue
                    if connection.source_node_id == node_id or connection.target_node_id == node_id:
                        effect = self._clean_phrase(connection.relationship_type or connection.explanation)
                        break
                chain.append(FrontendLoopChainStep(node=label, effect=effect))
            if not chain:
                continue
            loops.append(
                FrontendLoop(
                    id=loop.loop_key or f"loop-{loop.feedback_loop_id}",
                    title=loop.loop_name,
                    type="R" if loop.loop_type == "reinforcing" else "B",
                    chain=chain,
                    summary=loop.explanation,
                    evidence=[
                        point for point in loop.possible_intervention_points[:3] if point
                    ],
                )
            )

        if loops:
            return loops[:4]

        fallback_nodes = [
            node.label for node in policy.nodes[:4]
        ]
        if len(fallback_nodes) >= 3:
            return [
                FrontendLoop(
                    id="derived-delivery-loop",
                    title="Delivery coordination loop",
                    type="B",
                    chain=[
                        FrontendLoopChainStep(node=fallback_nodes[0], effect="sets policy pressure"),
                        FrontendLoopChainStep(node=fallback_nodes[1], effect="shapes delivery capacity"),
                        FrontendLoopChainStep(node=fallback_nodes[2], effect="feeds back into outcomes"),
                    ],
                    summary=(
                        "No explicit feedback loop was saved, so this derived loop shows the main "
                        "delivery path between policy pressure, execution capacity, and public outcome."
                    ),
                    evidence=[],
                )
            ]
        return []

    def _estimate_frontend_impacts(
        self,
        query: str,
        horizon: str | None,
        policy: PolicyAnalysisResponse,
        intervention_analysis: PolicyInterventionAnalysisResponse,
    ) -> tuple[FrontendImpact, FrontendImpact]:
        lowered = query.lower()
        short = {
            "affordability": 1.0,
            "supply": 0.0,
            "publicBudget": 0.0,
            "developerIncentives": 0.0,
            "tenantProtection": 0.0,
            "constructionSpeed": 0.0,
            "transportPressure": 0.0,
            "inequality": 0.0,
            "publicSatisfaction": 0.0,
        }

        def bump(key: str, amount: float):
            short[key] = max(-10.0, min(10.0, short[key] + amount))

        if "affordable" in lowered or "housing" in lowered:
            bump("affordability", 3.0)
            bump("publicSatisfaction", 2.0)
        if any(term in lowered for term in ("approval", "fast-track", "accelerat", "milestone")):
            bump("constructionSpeed", 4.0)
            bump("supply", 3.0)
            bump("developerIncentives", 2.0)
        if any(term in lowered for term in ("tenant", "subsid", "support", "protect")):
            bump("tenantProtection", 4.0)
            bump("inequality", -2.0)
            bump("publicBudget", -2.0)
        if any(term in lowered for term in ("transport", "utility", "infrastructure")):
            bump("transportPressure", 3.0)
            bump("publicBudget", -2.0)
        if any(term in lowered for term in ("tax", "levy")):
            bump("publicBudget", 2.0)
            bump("developerIncentives", -1.0)

        recommendation_count = len(intervention_analysis.recommendations)
        loop_count = len(policy.feedback_loops)
        bump("publicSatisfaction", min(recommendation_count, 3))
        bump("supply", min(loop_count, 2))

        long = dict(short)
        long["affordability"] = max(-10.0, min(10.0, long["affordability"] + 1.5))
        long["supply"] = max(-10.0, min(10.0, long["supply"] + 2.0))
        long["constructionSpeed"] = max(-10.0, min(10.0, long["constructionSpeed"] - 1.0))
        long["transportPressure"] = max(-10.0, min(10.0, long["transportPressure"] + 1.5))
        long["publicBudget"] = max(-10.0, min(10.0, long["publicBudget"] - 1.0))
        if horizon == "long":
            long["publicSatisfaction"] = max(-10.0, min(10.0, long["publicSatisfaction"] + 1.0))

        return (
            FrontendImpact(**{key: round(value, 1) for key, value in short.items()}),
            FrontendImpact(**{key: round(value, 1) for key, value in long.items()}),
        )

    def _build_frontend_warnings(
        self,
        policy: PolicyAnalysisResponse,
        intervention_analysis: PolicyInterventionAnalysisResponse,
    ) -> list[FrontendWarning]:
        warnings: list[FrontendWarning] = []
        for recommendation in intervention_analysis.recommendations[:3]:
            detail = recommendation.tradeoffs[0] if recommendation.tradeoffs else recommendation.reason
            warnings.append(
                FrontendWarning(
                    severity="high" if recommendation.confidence >= 0.8 else "medium",
                    title=recommendation.title,
                    detail=detail,
                )
            )
        if not warnings:
            warnings.append(
                FrontendWarning(
                    severity="medium",
                    title="Policy execution risk",
                    detail=(
                        "The current map still needs analyst review for missing causal links, "
                        "delivery constraints, and stakeholder resistance before implementation."
                    ),
                )
            )
        if len(warnings) == 1:
            warnings.append(
                FrontendWarning(
                    severity="low",
                    title="Stakeholder coordination risk",
                    detail=(
                        "The current map should still be checked against cross-agency delivery dependencies "
                        "before implementation."
                    ),
                )
            )
        return warnings[:5]

    def _build_frontend_bundle(
        self,
        intervention_analysis: PolicyInterventionAnalysisResponse,
        enhancement_analysis: PolicyEnhancementAnalysisResponse,
    ) -> list[FrontendBundleItem]:
        items: list[FrontendBundleItem] = []
        for recommendation in intervention_analysis.recommendations[:3]:
            items.append(
                FrontendBundleItem(
                    label=recommendation.title,
                    short=recommendation.intervention_key[:24],
                    description=recommendation.recommended_action,
                    rationale=recommendation.reason,
                    intervention_key=recommendation.intervention_key,
                    rank=recommendation.rank,
                    targeted_feedback_loop_ids=recommendation.targeted_feedback_loop_ids,
                    targeted_node_ids=recommendation.targeted_node_ids,
                    affected_stakeholder_ids=recommendation.affected_stakeholder_ids,
                    stakeholder_focus=recommendation.stakeholder_focus,
                    intervention_points=[recommendation.title],
                    implementation_notes=recommendation.implementation_notes,
                    tradeoffs=recommendation.tradeoffs,
                    expected_system_shift=recommendation.expected_system_shift,
                    confidence=recommendation.confidence,
                )
            )
        for suggestion in enhancement_analysis.suggestions[:1]:
            items.append(
                FrontendBundleItem(
                    label=suggestion.title,
                    short=suggestion.enhancement_key[:24],
                    description=suggestion.what_to_add,
                    rationale=suggestion.reason,
                    intervention_key=suggestion.enhancement_key,
                    rank=suggestion.rank,
                    targeted_feedback_loop_ids=suggestion.based_on_feedback_loop_ids,
                    targeted_node_ids=suggestion.based_on_node_ids,
                    affected_stakeholder_ids=suggestion.affected_stakeholder_ids,
                    stakeholder_focus=suggestion.affected_stakeholders,
                    intervention_points=[suggestion.suggested_policy_section],
                    implementation_notes=[suggestion.expected_policy_effect],
                    tradeoffs=suggestion.risks_if_omitted,
                    expected_system_shift=suggestion.expected_policy_effect,
                )
            )
        return items[:4]

    def _build_dataset_usage(self, datasets: list[FrontendDataset]) -> str:
        if not datasets:
            return "No data.gov.hk datasets were selected for this run."
        titles = ", ".join(dataset.title for dataset in datasets[:3])
        return (
            f"This analysis is grounded in current data.gov.hk context, including {titles}. "
            f"The selected datasets are used to frame stakeholder pressure, likely loops, and implementation risk."
        )

    def _infer_frontend_group(self, stakeholder: PolicyStakeholderAnalysis) -> str:
        text = f"{stakeholder.stakeholder_name} {stakeholder.stakeholder_type}".lower()
        if any(term in text for term in ("government", "bureau", "department", "authority", "regulator", "public")):
            return "government"
        if any(term in text for term in ("developer", "contractor", "market", "investor", "landlord", "private")):
            return "market"
        return "people"

    def _infer_frontend_level(self, stakeholder: PolicyStakeholderAnalysis) -> str:
        text = f"{stakeholder.stakeholder_type} {stakeholder.stakeholder_summary}".lower()
        if any(term in text for term in ("society", "media", "ngo", "public", "international", "global")):
            return "macro"
        if any(term in text for term in ("authority", "regulator", "developer", "contractor", "service")):
            return "meso"
        return "micro"

    def _infer_frontend_impact(
        self, stakeholder: PolicyStakeholderAnalysis, exposure_score: int
    ) -> float:
        text = f"{stakeholder.stakeholder_type} {stakeholder.stakeholder_summary}".lower()
        base = min(0.25 + exposure_score * 0.12, 0.9)
        if any(term in text for term in ("beneficiar", "tenant", "household", "community")):
            signed = base
        elif any(term in text for term in ("contractor", "developer", "landlord", "investor")):
            signed = -base
        else:
            signed = 0.12 + min(exposure_score * 0.08, 0.5)
        return round(max(-1.0, min(1.0, signed)), 2)

    def _build_short_label(self, value: str) -> str:
        words = [word for word in re.split(r"\s+", value.strip()) if word]
        if not words:
            return "N/A"
        if len(words) == 1:
            return words[0][:4].upper()
        return "".join(word[0] for word in words[:3]).upper()

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
                "Manual review is still required against the saved nodes, loops, and stakeholder pressures."
            )
        top = recommendations[0]
        loop_count = len(policy.feedback_loops)
        if loop_count == 0:
            return (
                f"Prioritize {top.title} first. No explicit feedback loops were captured in the saved map, "
                "so this ranking is grounded in node centrality, stakeholder exposure, and the strongest "
                "causal pressure points in the graph."
            )
        return (
            f"Prioritize {top.title} first. It has the strongest grounding in the current system map "
            f"because it addresses {len(top.targeted_feedback_loop_ids)} feedback loop(s), focuses on "
            f"{len(top.affected_stakeholder_ids)} stakeholder group(s), and acts on the most connected pressure "
            f"nodes. The current policy map contains "
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
        evidence = []
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
                "Implement against the highest-pressure nodes first and review the map after each policy change."
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
                "Any intervention should still be checked for second-order effects on the rest of the saved graph."
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
        return (
            f"We are recommending {title.lower()} because it directly addresses {loop_phrase}, "
            f"which is pushing pressure through {node_phrase}. That matters for {stakeholder_phrase}, "
            "and it changes a leverage point that can shift the wider system rather than a single isolated symptom."
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
                "so the cycle stops amplifying itself."
            )
        return (
            f"Expected shift: stabilize execution around "
            f"{', '.join(node.label for node in nodes[:2]) if nodes else 'the mapped nodes'} "
            "and reduce oscillation in the delivery path."
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
