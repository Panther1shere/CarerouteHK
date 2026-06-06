from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.policy_analysis_repository import PolicyAnalysisRepository
from app.policy_analysis_service import PolicyAnalysisService
from app.schemas import (
    PolicyAnalysisOnlyResponse,
    PolicyAnalysisRequest,
    PolicyAnalysisResponse,
    PolicyDeleteResponse,
    PolicyFeedbackLoop,
    PolicyGraphResponse,
    PolicyInterventionPointsResponse,
    PolicyNoteCreateRequest,
    PolicyNoteResponse,
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


@router.get("/policy/{policy_id}/graph", response_model=PolicyGraphResponse)
async def get_policy_graph(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyGraphResponse:
    return await service.get_policy_graph(policy_id)


@router.delete("/policy/{policy_id}", response_model=PolicyDeleteResponse)
async def delete_policy(
    policy_id: int,
    service: PolicyAnalysisService = Depends(get_policy_analysis_service),
) -> PolicyDeleteResponse:
    return await service.delete_policy(policy_id)
