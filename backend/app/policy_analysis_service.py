import json

from fastapi import HTTPException
from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.policy_analysis_repository import PolicyAnalysisRepository
from app.schemas import (
    PolicyAnalysisLLMEnvelope,
    PolicyAnalysisOnlyResponse,
    PolicyAnalysisResponse,
    PolicyDeleteResponse,
    PolicyGraphResponse,
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
