from pydantic import BaseModel, ConfigDict, Field


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
    x: float | None = None
    y: float | None = None
    created_at: str | None = None
    updated_at: str | None = None


class PolicySystemConnection(BaseModel):
    connection_id: int | None = None
    connection_key: str | None = None
    policy_id: int | None = None
    source_node_id: int
    target_node_id: int
    relationship_type: str
    explanation: str
    polarity: str = Field(pattern=r"^(\+|-)$")
    created_at: str | None = None
    updated_at: str | None = None


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
    created_at: str | None = None
    updated_at: str | None = None


class PolicySystemBoundary(BaseModel):
    boundary_id: int | None = None
    policy_id: int | None = None
    system_purpose: str
    included_node_ids: list[int]
    excluded_or_external_factors: list[str]
    explanation: str
    created_at: str | None = None
    updated_at: str | None = None


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


class PolicyNoteUpdateRequest(BaseModel):
    note_text: str = Field(min_length=3)


class PolicyNodeUpdateRequest(BaseModel):
    label: str | None = None
    description: str | None = None
    level: str | None = Field(default=None, pattern="^(Micro|Meso|Macro)$")
    category: str | None = None
    related_stakeholder_ids: list[int] | None = None
    x: float | None = None
    y: float | None = None


class PolicyConnectionUpdateRequest(BaseModel):
    relationship_type: str | None = None
    explanation: str | None = None
    polarity: str | None = Field(default=None, pattern=r"^(\+|-)$")


class PolicyFeedbackLoopUpdateRequest(BaseModel):
    loop_name: str | None = None
    loop_type: str | None = Field(default=None, pattern="^(reinforcing|balancing)$")
    explanation: str | None = None
    affected_stakeholder_ids: list[int] | None = None
    possible_intervention_points: list[str] | None = None


class PolicyBoundaryUpdateRequest(BaseModel):
    system_purpose: str | None = None
    included_node_ids: list[int] | None = None
    excluded_or_external_factors: list[str] | None = None
    explanation: str | None = None


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
    system_boundary: PolicySystemBoundary | None = None
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
    model_config = ConfigDict(populate_by_name=True)

    policy: PolicySummaryResponse
    nodes: list[PolicySystemNode]
    edges: list[PolicySystemConnection]
    feedback_loops: list[PolicyFeedbackLoop] = Field(
        serialization_alias="feedbackLoops"
    )
    stakeholders: list[PolicyStakeholderAnalysis]
    system_boundary: PolicySystemBoundary | None = Field(
        default=None, serialization_alias="systemBoundary"
    )
    intervention_points: list[str] = Field(
        default_factory=list, serialization_alias="interventionPoints"
    )
    notes: list[PolicyNoteResponse] = Field(default_factory=list)


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
    system_boundary: PolicySystemBoundaryInput | None = None


class FrontendDataset(BaseModel):
    id: str
    title: str
    organization: str
    notes: str
    url: str
    query: str


class FrontendPolicyExtraStakeholder(BaseModel):
    label: str
    level: str = Field(pattern="^(micro|meso|macro)$")
    note: str | None = None


class FrontendPolicyAnalysisRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    horizon: str | None = Field(default=None, pattern="^(short|long)$")
    draft_text: str | None = Field(default=None, max_length=50000)
    extra_stakeholders: list[FrontendPolicyExtraStakeholder] = Field(default_factory=list)
    selected_datasets: list[FrontendDataset] = Field(default_factory=list)


class FrontendAnalysisRow(BaseModel):
    key: str
    label: str
    value: str
    source: str | None = None


class FrontendStakeholder(BaseModel):
    id: str
    label: str
    short: str
    group: str = Field(pattern="^(people|market|government)$")
    level: str = Field(pattern="^(micro|meso|macro)$")
    impact: float = Field(ge=-1, le=1)
    note: str
    analysis: list[FrontendAnalysisRow]


class FrontendLoopChainStep(BaseModel):
    node: str
    effect: str


class FrontendLoop(BaseModel):
    id: str
    title: str
    type: str = Field(pattern="^(R|B)$")
    chain: list[FrontendLoopChainStep]
    summary: str
    evidence: list[str] = Field(default_factory=list)


class FrontendWarning(BaseModel):
    severity: str = Field(pattern="^(low|medium|high)$")
    title: str
    detail: str


class FrontendImpact(BaseModel):
    affordability: float
    supply: float
    publicBudget: float
    developerIncentives: float
    tenantProtection: float
    constructionSpeed: float
    transportPressure: float
    inequality: float
    publicSatisfaction: float


class FrontendBundleItem(BaseModel):
    label: str
    short: str
    description: str | None = None
    rationale: str | None = None
    intervention_key: str | None = Field(default=None, serialization_alias="interventionKey")
    rank: int | None = None
    targeted_feedback_loop_ids: list[int] = Field(
        default_factory=list, serialization_alias="targetedFeedbackLoopIds"
    )
    targeted_node_ids: list[int] = Field(
        default_factory=list, serialization_alias="targetedNodeIds"
    )
    affected_stakeholder_ids: list[int] = Field(
        default_factory=list, serialization_alias="affectedStakeholderIds"
    )
    stakeholder_focus: list[str] = Field(
        default_factory=list, serialization_alias="stakeholderFocus"
    )
    intervention_points: list[str] = Field(
        default_factory=list, serialization_alias="interventionPoints"
    )
    implementation_notes: list[str] = Field(
        default_factory=list, serialization_alias="implementationNotes"
    )
    tradeoffs: list[str] = Field(default_factory=list)
    expected_system_shift: str | None = Field(
        default=None, serialization_alias="expectedSystemShift"
    )
    confidence: float | None = None


class FrontendPolicySummary(BaseModel):
    label: str
    summary: str


class FrontendPolicyAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    policy_id: int = Field(serialization_alias="policyId")
    interpretation: str
    policy: FrontendPolicySummary
    stakeholders: list[FrontendStakeholder]
    loops: list[FrontendLoop]
    impactShort: FrontendImpact
    impactLong: FrontendImpact
    warnings: list[FrontendWarning]
    bundle: list[FrontendBundleItem]
    bundleRationale: str
    sources: list[dict[str, str]]
    datasetUsage: str
    datasets: list[FrontendDataset]
    graph: PolicyGraphResponse | None = None


class FrontendDatasetSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=100)
    rows: int = Field(default=6, ge=1, le=10)


class FrontendDatasetSearchResponse(BaseModel):
    results: list[FrontendDataset]


class FrontendChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class FrontendChatContext(BaseModel):
    step: int = Field(ge=1, le=5)
    query: str = Field(max_length=2000)
    horizon: str | None = Field(default=None, pattern="^(short|long)$")
    analysis_summary: str | None = Field(default=None, max_length=20000)
    datasets: list[dict[str, str]] = Field(default_factory=list, max_length=20)


class FrontendChatRequest(BaseModel):
    messages: list[FrontendChatMessage] = Field(min_length=1, max_length=40)
    context: FrontendChatContext


class FrontendChatResponse(BaseModel):
    reply: str
