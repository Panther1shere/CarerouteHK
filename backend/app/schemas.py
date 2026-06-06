from pydantic import BaseModel, Field


class MetricCard(BaseModel):
    slug: str
    label: str
    value: float
    unit: str = "/100"
    explanation: str


class PolicySummary(BaseModel):
    slug: str
    name: str
    summary: str
    description: str
    default_intensity: int
    policy_type: str
    priority_hint: str
    neighborhood_ids: list[str]


class ScenarioResponse(BaseModel):
    scenario_slug: str
    name: str
    city_name: str
    summary: str
    analyst_prompt: str
    baseline_metrics: list[MetricCard]
    policies: list[PolicySummary]


class GraphNode(BaseModel):
    slug: str
    name: str
    node_type: str
    description: str
    influence_score: int
    x: float
    y: float
    stakeholder_slug: str | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str
    polarity: int
    strength: int
    explanation: str


class LoopSummary(BaseModel):
    slug: str
    name: str
    loop_type: str
    base_risk: int
    explanation: str
    intervention_signal: str
    involved_nodes: list[str]


class GraphResponse(BaseModel):
    scenario_slug: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    loops: list[LoopSummary]
    neighborhood_ids: list[str]


class NeighborhoodResponse(BaseModel):
    slug: str
    name: str
    focus: str
    risk_level: int
    x: float
    y: float
    width: float
    height: float
    accent: str
    explanation: str


class PolicySimulationRequest(BaseModel):
    policy_slug: str
    intensity: int = Field(ge=20, le=100)
    priority: str = Field(pattern="^(affordability|speed|stability|trust)$")


class MetricProjection(BaseModel):
    slug: str
    label: str
    baseline: float
    projected: float
    delta: float
    impact_score: float
    explanation: str


class AffectedNode(BaseModel):
    node_slug: str
    name: str
    impact_score: float
    confidence: float
    explanation: str


class LoopAnalysis(BaseModel):
    loop_id: str
    name: str
    baseline_risk: int
    projected_risk: int
    delta: int
    severity: str
    explanation: str
    affected_nodes: list[str]


class NeighborhoodOutlook(BaseModel):
    neighborhood_id: str
    name: str
    impact_score: float
    confidence: float
    explanation: str


class SimulationResponse(BaseModel):
    simulation_id: int
    scenario_slug: str
    policy_slug: str
    policy_name: str
    priority: str
    intensity: int
    impact_score: float
    confidence: float
    explanation: str
    key_takeaway: str
    affected_nodes: list[AffectedNode]
    projected_metrics: list[MetricProjection]
    loop_analyses: list[LoopAnalysis]
    neighborhood_outlook: list[NeighborhoodOutlook]


class InterventionRecommendation(BaseModel):
    slug: str
    title: str
    summary: str
    impact_score: float
    confidence: float
    explanation: str
    tradeoffs: list[str]
    affected_nodes: list[str]
    loop_ids: list[str]
    neighborhood_ids: list[str]


class RecommendationRequest(BaseModel):
    simulation_id: int
    max_results: int = Field(default=3, ge=1, le=5)


class RecommendationResponse(BaseModel):
    simulation_id: int
    advisor_mode: str
    advisor_brief: str
    interventions: list[InterventionRecommendation]


class StatusResponse(BaseModel):
    message: str
