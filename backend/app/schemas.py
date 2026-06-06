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


class PolicyAnalysisRequest(BaseModel):
    text: str = Field(min_length=20)


class PolicyAnalysisMicroLevel(BaseModel):
    main_motivation: str
    goals: str
    organizational_structure_shareholders: str
    corporate_culture_communication_processes: str


class PolicyAnalysisMesoLevel(BaseModel):
    required_resources_dependencies: str
    available_resources: str
    stakeholders: str
    cooperation_partners: str
    competitors_antagonists: str


class PolicyAnalysisMacroLevel(BaseModel):
    legislators_national_international: str
    economic_policy_regulation: str
    global_markets_trends: str
    society_public_ngos: str
    media_social_media: str
    technological_developments: str
    environment_climate_change: str
    cultural_norms_values: str


class PolicyStakeholderAnalysis(BaseModel):
    analysis_id: int | None = None
    stakeholder_id: int | None = None
    stakeholder_key: str | None = None
    stakeholder_name: str
    stakeholder_type: str
    stakeholder_summary: str
    micro_level: PolicyAnalysisMicroLevel
    meso_level: PolicyAnalysisMesoLevel
    macro_level: PolicyAnalysisMacroLevel


class PolicySystemNode(BaseModel):
    policy_node_id: int | None = None
    node_id: int | None = None
    node_key: str | None = None
    label: str
    description: str
    level: str = Field(pattern="^(Micro|Meso|Macro)$")
    category: str
    related_stakeholder_ids: list[int] = Field(default_factory=list)


class PolicySystemConnection(BaseModel):
    connection_id: int | None = None
    connection_key: str | None = None
    policy_id: int | None = None
    source_node_id: int
    target_node_id: int
    relationship_type: str
    explanation: str
    polarity: str = Field(pattern=r"^(\+|-)$")


class PolicyFeedbackLoop(BaseModel):
    feedback_loop_id: int | None = None
    loop_key: str | None = None
    policy_id: int | None = None
    loop_name: str
    involved_node_ids: list[int]
    involved_connection_ids: list[int]
    loop_type: str = Field(pattern="^(reinforcing|balancing)$")
    explanation: str
    affected_stakeholder_ids: list[int]
    possible_intervention_points: list[str]


class PolicySystemBoundary(BaseModel):
    boundary_id: int | None = None
    policy_id: int | None = None
    system_purpose: str
    included_node_ids: list[int]
    excluded_or_external_factors: list[str]
    explanation: str


class PolicyNoteCreateRequest(BaseModel):
    related_object_type: str = Field(
        pattern="^(policy|stakeholder|node|connection|feedback_loop|system_boundary|intervention_point)$"
    )
    related_object_id: int | None = None
    note_text: str = Field(min_length=3)


class PolicyNoteResponse(BaseModel):
    note_id: int
    related_object_type: str
    related_object_id: int | None = None
    policy_id: int
    note_text: str
    created_at: str
    updated_at: str


class PolicyAnalysisResponse(BaseModel):
    policy_id: int
    text: str
    policy_domain: str
    llm_model: str
    created_at: str
    stakeholders: list[PolicyStakeholderAnalysis]
    nodes: list[PolicySystemNode]
    connections: list[PolicySystemConnection]
    feedback_loops: list[PolicyFeedbackLoop]
    system_boundary: PolicySystemBoundary
    notes: list[PolicyNoteResponse]
    possible_intervention_points: list[str]


class PolicySummaryResponse(BaseModel):
    policy_id: int
    text_preview: str
    policy_domain: str
    llm_model: str
    created_at: str
    stakeholder_count: int
    node_count: int
    connection_count: int
    feedback_loop_count: int
    note_count: int


class PolicyAnalysisOnlyResponse(BaseModel):
    policy_id: int
    text: str
    policy_domain: str
    llm_model: str
    created_at: str
    stakeholders: list[PolicyStakeholderAnalysis]


class PolicyInterventionPointsResponse(BaseModel):
    policy_id: int
    intervention_points: list[str]


class PolicyDeleteResponse(BaseModel):
    policy_id: int
    deleted: bool
    message: str


class PolicyGraphResponse(BaseModel):
    policy: PolicySummaryResponse
    nodes: list[PolicySystemNode]
    edges: list[PolicySystemConnection]
    feedback_loops: list[PolicyFeedbackLoop]
    stakeholders: list[PolicyStakeholderAnalysis]
    boundary: PolicySystemBoundary | None = None
    intervention_points: list[str]


class PolicyInterventionRecommendation(BaseModel):
    rank: int
    intervention_key: str
    title: str
    recommended_action: str
    reason: str
    supporting_evidence: list[str]
    targeted_feedback_loop_ids: list[int]
    targeted_node_ids: list[int]
    affected_stakeholder_ids: list[int]
    stakeholder_focus: list[str]
    implementation_notes: list[str]
    tradeoffs: list[str]
    expected_system_shift: str
    confidence: float


class PolicyInterventionAnalysisResponse(BaseModel):
    policy_id: int
    generated_at: str
    analysis_mode: str
    summary: str
    recommendations: list[PolicyInterventionRecommendation]


class PolicyEnhancementSuggestion(BaseModel):
    rank: int
    enhancement_key: str
    title: str
    suggested_policy_section: str
    what_to_add: str
    draft_clause: str
    reason: str
    affected_stakeholder_ids: list[int]
    affected_stakeholders: list[str]
    based_on_intervention_keys: list[str]
    based_on_feedback_loop_ids: list[int]
    based_on_node_ids: list[int]
    expected_policy_effect: str
    risks_if_omitted: list[str]


class PolicyEnhancementAnalysisResponse(BaseModel):
    policy_id: int
    generated_at: str
    analysis_mode: str
    summary: str
    suggestions: list[PolicyEnhancementSuggestion]


class PolicySystemMapStakeholderInput(BaseModel):
    stakeholder_key: str
    stakeholder_name: str
    stakeholder_type: str
    stakeholder_summary: str
    micro_level: PolicyAnalysisMicroLevel
    meso_level: PolicyAnalysisMesoLevel
    macro_level: PolicyAnalysisMacroLevel


class PolicySystemMapNodeInput(BaseModel):
    node_key: str
    label: str
    description: str
    level: str = Field(pattern="^(Micro|Meso|Macro)$")
    category: str
    stakeholder_keys: list[str] = Field(default_factory=list)


class PolicySystemMapConnectionInput(BaseModel):
    connection_key: str
    source_node_key: str
    target_node_key: str
    relationship_type: str
    explanation: str
    polarity: str = Field(pattern=r"^(\+|-)$")


class PolicySystemMapFeedbackLoopInput(BaseModel):
    loop_key: str
    loop_name: str
    involved_node_keys: list[str]
    involved_connection_keys: list[str]
    loop_type: str = Field(pattern="^(reinforcing|balancing)$")
    explanation: str
    affected_stakeholder_keys: list[str] = Field(default_factory=list)
    possible_intervention_points: list[str] = Field(default_factory=list)


class PolicySystemBoundaryInput(BaseModel):
    system_purpose: str
    included_node_keys: list[str]
    excluded_or_external_factors: list[str]
    explanation: str


class PolicyAnalysisLLMEnvelope(BaseModel):
    policy_domain: str
    stakeholders: list[PolicySystemMapStakeholderInput] = Field(min_length=1)
    nodes: list[PolicySystemMapNodeInput] = Field(min_length=1)
    connections: list[PolicySystemMapConnectionInput] = Field(default_factory=list)
    feedback_loops: list[PolicySystemMapFeedbackLoopInput] = Field(default_factory=list)
    system_boundary: PolicySystemBoundaryInput
