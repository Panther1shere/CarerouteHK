from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisor import recommend_interventions
from app.config import get_settings
from app.database import dispose_database, get_session, initialize_database
from app.policy_analysis_router import router as policy_analysis_router
from app.repository import (
    get_default_scenario,
    get_edges,
    get_interventions,
    get_loops,
    get_neighborhoods,
    get_nodes,
    get_policies,
    get_policy,
    get_simulation_run,
    save_simulation_run,
)
from app.schemas import (
    GraphResponse,
    NeighborhoodResponse,
    RecommendationRequest,
    RecommendationResponse,
    ScenarioResponse,
    SimulationResponse,
    PolicySimulationRequest,
    StatusResponse,
)
from app.simulation import simulate_policy

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await initialize_database()
    try:
        yield
    finally:
        await dispose_database()


app = FastAPI(
    title="Housing Policy Loop Navigator API",
    lifespan=lifespan,
    docs_url="/swagger-ui/index.html",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(policy_analysis_router)


@app.get("/healthz")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status", response_model=StatusResponse)
async def get_status() -> StatusResponse:
    return StatusResponse(message="Housing Policy Loop Navigator backend is ready.")


@app.get("/api/scenarios/default", response_model=ScenarioResponse)
async def get_default_scenario_endpoint(
    session: AsyncSession = Depends(get_session),
) -> ScenarioResponse:
    scenario = await get_default_scenario(session)
    policies = await get_policies(session, scenario["id"])
    return ScenarioResponse(
        scenario_slug=scenario["slug"],
        name=scenario["name"],
        city_name=scenario["city_name"],
        summary=scenario["summary"],
        analyst_prompt=scenario["analyst_prompt"],
        baseline_metrics=scenario["baseline_metrics"],
        policies=policies,
    )


@app.get("/api/graph", response_model=GraphResponse)
async def get_graph(session: AsyncSession = Depends(get_session)) -> GraphResponse:
    scenario = await get_default_scenario(session)
    nodes = await get_nodes(session, scenario["id"])
    edges = await get_edges(session, scenario["id"])
    loops = await get_loops(session, scenario["id"])
    neighborhoods = await get_neighborhoods(session, scenario["id"])
    return GraphResponse(
        scenario_slug=scenario["slug"],
        nodes=nodes,
        edges=edges,
        loops=loops,
        neighborhood_ids=[item["slug"] for item in neighborhoods],
    )


@app.get("/api/neighborhoods", response_model=list[NeighborhoodResponse])
async def get_neighborhoods_endpoint(
    session: AsyncSession = Depends(get_session),
) -> list[NeighborhoodResponse]:
    scenario = await get_default_scenario(session)
    neighborhoods = await get_neighborhoods(session, scenario["id"])
    return [NeighborhoodResponse(**entry) for entry in neighborhoods]


@app.post("/api/simulate-policy", response_model=SimulationResponse)
async def simulate_policy_endpoint(
    payload: PolicySimulationRequest,
    session: AsyncSession = Depends(get_session),
) -> SimulationResponse:
    scenario = await get_default_scenario(session)
    policy = await get_policy(session, scenario["id"], payload.policy_slug)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found.")

    nodes = await get_nodes(session, scenario["id"])
    loops = await get_loops(session, scenario["id"])
    neighborhoods = await get_neighborhoods(session, scenario["id"])

    simulation_payload = simulate_policy(
        scenario=scenario,
        policy=policy,
        nodes=nodes,
        loops=loops,
        neighborhoods=neighborhoods,
        intensity=payload.intensity,
        priority=payload.priority,
    )
    simulation_id = await save_simulation_run(
        session=session,
        scenario_id=scenario["id"],
        policy_slug=policy["slug"],
        intensity=payload.intensity,
        priority=payload.priority,
        result_payload=simulation_payload,
    )
    simulation_payload["simulation_id"] = simulation_id
    return SimulationResponse(**simulation_payload)


@app.post("/api/recommend-interventions", response_model=RecommendationResponse)
async def recommend_interventions_endpoint(
    payload: RecommendationRequest,
    session: AsyncSession = Depends(get_session),
) -> RecommendationResponse:
    simulation_run = await get_simulation_run(session, payload.simulation_id)
    if simulation_run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found.")

    scenario = await get_default_scenario(session)
    interventions = await get_interventions(session, scenario["id"])
    simulation_payload = {"simulation_id": simulation_run["id"], **simulation_run["result"]}
    recommendation_payload = recommend_interventions(
        simulation=simulation_payload,
        interventions=interventions,
        max_results=payload.max_results,
    )
    return RecommendationResponse(**recommendation_payload)
