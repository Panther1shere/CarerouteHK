from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.policy_analysis_repository import PolicyAnalysisRepository
from app.policy_analysis_service import PolicyAnalysisService
from app.schemas import (
    FrontendChatRequest,
    FrontendChatResponse,
    FrontendDatasetSearchRequest,
    FrontendDatasetSearchResponse,
    FrontendPolicyAnalysisRequest,
    FrontendPolicyAnalysisResponse,
    PolicyAnalysisOnlyResponse,
    PolicyAnalysisRequest,
    PolicyAnalysisResponse,
    PolicyBoundaryUpdateRequest,
    PolicyConnectionUpdateRequest,
    PolicyDeleteResponse,
    PolicyEnhancementAnalysisResponse,
    PolicyFeedbackLoopUpdateRequest,
    PolicyFeedbackLoop,
    PolicyGraphResponse,
    PolicyInterventionAnalysisResponse,
    PolicyInterventionPointsResponse,
    PolicyNoteCreateRequest,
    PolicyNoteResponse,
    PolicyNoteUpdateRequest,
    PolicyNodeUpdateRequest,
    PolicyStakeholderAnalysis,
    PolicySummaryResponse,
    PolicySystemBoundary,
    PolicySystemConnection,
    PolicySystemNode,
)

router = APIRouter(tags=["policy-analysis"])


def get_policy_analysis_service(
    session: AsyncSession = Depends(get_session),
) -> PolicyAnalysisService:
    repository = PolicyAnalysisRepository(session)
    return PolicyAnalysisService(repository=repository, settings=get_settings())


@router.post("/policy", response_model=PolicyAnalysisResponse)
async def create_policy_analysis(
    payload: PolicyAnalysisRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyAnalysisResponse:
    return await service.analyze_policy(payload.text)


@router.post(
    "/api/frontend/policygraph/analyze",
    response_model=FrontendPolicyAnalysisResponse,
)
async def create_frontend_policy_analysis(
    payload: FrontendPolicyAnalysisRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> FrontendPolicyAnalysisResponse:
    return await service.analyze_policy_for_frontend(payload)


@router.get(
    "/api/frontend/policygraph/policies/{policy_id}",
    response_model=FrontendPolicyAnalysisResponse,
)
async def get_frontend_policy_analysis(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> FrontendPolicyAnalysisResponse:
    return await service.get_policy_for_frontend(policy_id)


@router.post(
    "/api/frontend/policygraph/datasets/search",
    response_model=FrontendDatasetSearchResponse,
)
async def search_frontend_policy_datasets(
    payload: FrontendDatasetSearchRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> FrontendDatasetSearchResponse:
    return await service.search_frontend_datasets(
        query=payload.query, rows=payload.rows
    )


@router.post(
    "/api/frontend/policygraph/chat",
    response_model=FrontendChatResponse,
)
async def chat_with_frontend_policy_context(
    payload: FrontendChatRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> FrontendChatResponse:
    return await service.chat_with_frontend_context(payload)


@router.get("/policy", response_model=list[PolicySummaryResponse])
async def list_policies(
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> list[PolicySummaryResponse]:
    return await service.list_policies()


@router.get("/policy/{policy_id}", response_model=PolicyAnalysisResponse)
async def get_policy(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyAnalysisResponse:
    return await service.get_policy(policy_id)


@router.get("/policy/{policy_id}/stakeholders", response_model=list[PolicyStakeholderAnalysis])
async def get_policy_stakeholders(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> list[PolicyStakeholderAnalysis]:
    return await service.get_policy_stakeholders(policy_id)


@router.get("/policy/{policy_id}/analysis", response_model=PolicyAnalysisOnlyResponse)
async def get_policy_analysis_only(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyAnalysisOnlyResponse:
    return await service.get_policy_analysis_only(policy_id)


@router.get("/policy/{policy_id}/nodes", response_model=list[PolicySystemNode])
async def get_policy_nodes(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> list[PolicySystemNode]:
    return await service.get_policy_nodes(policy_id)


@router.get("/policy/{policy_id}/connections", response_model=list[PolicySystemConnection])
async def get_policy_connections(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> list[PolicySystemConnection]:
    return await service.get_policy_connections(policy_id)


@router.get("/policy/{policy_id}/feedback-loops", response_model=list[PolicyFeedbackLoop])
async def get_policy_feedback_loops(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> list[PolicyFeedbackLoop]:
    return await service.get_policy_feedback_loops(policy_id)


@router.get("/policy/{policy_id}/boundary", response_model=PolicySystemBoundary | None)
async def get_policy_boundary(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicySystemBoundary | None:
    return await service.get_policy_boundary(policy_id)


@router.post("/policy/{policy_id}/notes", response_model=PolicyNoteResponse)
async def create_policy_note(
    policy_id: int,
    payload: PolicyNoteCreateRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyNoteResponse:
    return await service.add_note(policy_id=policy_id, payload=payload)


@router.put("/policy/{policy_id}/notes/{note_id}", response_model=PolicyNoteResponse)
async def update_policy_note(
    policy_id: int,
    note_id: int,
    payload: PolicyNoteUpdateRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyNoteResponse:
    return await service.update_note(
        policy_id=policy_id, note_id=note_id, note_text=payload.note_text
    )


@router.get("/policy/{policy_id}/notes", response_model=list[PolicyNoteResponse])
async def get_policy_notes(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> list[PolicyNoteResponse]:
    return await service.get_policy_notes(policy_id)


@router.get(
    "/policy/{policy_id}/intervention-points",
    response_model=PolicyInterventionPointsResponse,
)
async def get_policy_intervention_points(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyInterventionPointsResponse:
    return await service.get_policy_intervention_points(policy_id)


@router.get(
    "/policy/{policy_id}/interventions/analysis",
    response_model=PolicyInterventionAnalysisResponse,
)
async def get_policy_intervention_analysis(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyInterventionAnalysisResponse:
    return await service.get_policy_intervention_analysis(policy_id)


@router.get(
    "/policy/{policy_id}/policy-enhancements",
    response_model=PolicyEnhancementAnalysisResponse,
)
async def get_policy_enhancement_analysis(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyEnhancementAnalysisResponse:
    return await service.get_policy_enhancement_analysis(policy_id)


@router.get("/policy/{policy_id}/graph", response_model=PolicyGraphResponse)
async def get_policy_graph(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyGraphResponse:
    return await service.get_policy_graph(policy_id)


@router.patch("/policy/{policy_id}/nodes/{node_id}", response_model=PolicySystemNode)
async def update_policy_node(
    policy_id: int,
    node_id: int,
    payload: PolicyNodeUpdateRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicySystemNode:
    return await service.update_policy_node(
        policy_id, node_id, payload.model_dump(exclude_none=True)
    )


@router.patch(
    "/policy/{policy_id}/connections/{connection_id}",
    response_model=PolicySystemConnection,
)
async def update_policy_connection(
    policy_id: int,
    connection_id: int,
    payload: PolicyConnectionUpdateRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicySystemConnection:
    return await service.update_policy_connection(
        policy_id, connection_id, payload.model_dump(exclude_none=True)
    )


@router.patch(
    "/policy/{policy_id}/feedback-loops/{feedback_loop_id}",
    response_model=PolicyFeedbackLoop,
)
async def update_policy_feedback_loop(
    policy_id: int,
    feedback_loop_id: int,
    payload: PolicyFeedbackLoopUpdateRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyFeedbackLoop:
    return await service.update_policy_feedback_loop(
        policy_id, feedback_loop_id, payload.model_dump(exclude_none=True)
    )


@router.patch("/policy/{policy_id}/boundary", response_model=PolicySystemBoundary)
async def update_policy_boundary(
    policy_id: int,
    payload: PolicyBoundaryUpdateRequest,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicySystemBoundary:
    return await service.update_policy_boundary(
        policy_id, payload.model_dump(exclude_none=True)
    )


@router.delete("/policy/{policy_id}", response_model=PolicyDeleteResponse)
async def delete_policy(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyDeleteResponse:
    return await service.delete_policy(policy_id)
