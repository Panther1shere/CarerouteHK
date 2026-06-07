from collections import defaultdict
import json
import math
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import (
    PolicyAnalysisLLMEnvelope,
    PolicyAnalysisOnlyResponse,
    PolicyAnalysisResponse,
    PolicyDeleteResponse,
    PolicyFeedbackLoop,
    PolicyGraphResponse,
    PolicyInterventionPointsResponse,
    PolicyNoteResponse,
    PolicyStakeholderAnalysis,
    PolicySummaryResponse,
    PolicySystemBoundary,
    PolicySystemConnection,
    PolicySystemNode,
)


class PolicyAnalysisRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_policy_analysis(
        self,
        policy_text: str,
        llm_model: str,
        analysis: PolicyAnalysisLLMEnvelope,
    ) -> PolicyAnalysisResponse:
        raw_analysis_json = json.dumps(analysis.model_dump())
        policy_result = await self.session.execute(
            text(
                """
                INSERT INTO policy_documents (
                    policy_text, policy_domain, llm_model, raw_analysis_json
                )
                VALUES (
                    :policy_text, :policy_domain, :llm_model, :raw_analysis_json
                )
                RETURNING id, created_at;
                """
            ),
            {
                "policy_text": policy_text,
                "policy_domain": analysis.policy_domain,
                "llm_model": llm_model,
                "raw_analysis_json": raw_analysis_json,
            },
        )
        policy_row = policy_result.mappings().one()
        policy_id = int(policy_row["id"])
        created_at = policy_row["created_at"].isoformat()

        stakeholder_key_map: dict[str, dict[str, int]] = {}
        stakeholders: list[PolicyStakeholderAnalysis] = []
        for stakeholder in analysis.stakeholders:
            stakeholder_id = await self._upsert_stakeholder_entity(
                stakeholder_name=stakeholder.stakeholder_name,
                stakeholder_type=stakeholder.stakeholder_type,
            )
            analysis_row = await self.session.execute(
                text(
                    """
                    INSERT INTO policy_stakeholder_analyses (
                        policy_document_id,
                        stakeholder_entity_id,
                        stakeholder_name,
                        stakeholder_summary,
                        main_motivation,
                        goals,
                        organizational_structure_shareholders,
                        corporate_culture_communication_processes,
                        required_resources_dependencies,
                        available_resources,
                        stakeholders_text,
                        cooperation_partners,
                        competitors_antagonists,
                        legislators_national_international,
                        economic_policy_regulation,
                        global_markets_trends,
                        society_public_ngos,
                        media_social_media,
                        technological_developments,
                        environment_climate_change,
                        cultural_norms_values
                    )
                    VALUES (
                        :policy_document_id,
                        :stakeholder_entity_id,
                        :stakeholder_name,
                        :stakeholder_summary,
                        :main_motivation,
                        :goals,
                        :organizational_structure_shareholders,
                        :corporate_culture_communication_processes,
                        :required_resources_dependencies,
                        :available_resources,
                        :stakeholders_text,
                        :cooperation_partners,
                        :competitors_antagonists,
                        :legislators_national_international,
                        :economic_policy_regulation,
                        :global_markets_trends,
                        :society_public_ngos,
                        :media_social_media,
                        :technological_developments,
                        :environment_climate_change,
                        :cultural_norms_values
                    )
                    RETURNING id;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "stakeholder_entity_id": stakeholder_id,
                    "stakeholder_name": stakeholder.stakeholder_name,
                    "stakeholder_summary": stakeholder.stakeholder_summary,
                    "main_motivation": stakeholder.micro_level.main_motivation,
                    "goals": stakeholder.micro_level.goals,
                    "organizational_structure_shareholders": stakeholder.micro_level.organizational_structure_shareholders,
                    "corporate_culture_communication_processes": stakeholder.micro_level.corporate_culture_communication_processes,
                    "required_resources_dependencies": stakeholder.meso_level.required_resources_dependencies,
                    "available_resources": stakeholder.meso_level.available_resources,
                    "stakeholders_text": stakeholder.meso_level.stakeholders,
                    "cooperation_partners": stakeholder.meso_level.cooperation_partners,
                    "competitors_antagonists": stakeholder.meso_level.competitors_antagonists,
                    "legislators_national_international": stakeholder.macro_level.legislators_national_international,
                    "economic_policy_regulation": stakeholder.macro_level.economic_policy_regulation,
                    "global_markets_trends": stakeholder.macro_level.global_markets_trends,
                    "society_public_ngos": stakeholder.macro_level.society_public_ngos,
                    "media_social_media": stakeholder.macro_level.media_social_media,
                    "technological_developments": stakeholder.macro_level.technological_developments,
                    "environment_climate_change": stakeholder.macro_level.environment_climate_change,
                    "cultural_norms_values": stakeholder.macro_level.cultural_norms_values,
                },
            )
            analysis_id = int(analysis_row.scalar_one())
            stakeholder_entry = {
                "stakeholder_id": stakeholder_id,
                "analysis_id": analysis_id,
            }
            self._register_aliases(
                stakeholder_key_map,
                stakeholder_entry,
                stakeholder.stakeholder_key,
                stakeholder.stakeholder_name,
            )
            stakeholders.append(
                PolicyStakeholderAnalysis(
                    analysis_id=analysis_id,
                    stakeholder_id=stakeholder_id,
                    stakeholder_key=stakeholder.stakeholder_key,
                    stakeholder_name=stakeholder.stakeholder_name,
                    stakeholder_type=stakeholder.stakeholder_type,
                    stakeholder_summary=stakeholder.stakeholder_summary,
                    micro_level=stakeholder.micro_level,
                    meso_level=stakeholder.meso_level,
                    macro_level=stakeholder.macro_level,
                )
            )

        node_key_map: dict[str, dict[str, int]] = {}
        level_totals = {
            level: sum(1 for node in analysis.nodes if node.level == level)
            for level in ("Micro", "Meso", "Macro")
        }
        level_seen = {"Micro": 0, "Meso": 0, "Macro": 0}
        nodes: list[PolicySystemNode] = []
        for node in analysis.nodes:
            node_id = await self._upsert_node_catalog(label=node.label, category=node.category)
            related_stakeholder_ids = [
                stakeholder_entry["stakeholder_id"]
                for key in node.stakeholder_keys
                if (stakeholder_entry := self._resolve_alias(stakeholder_key_map, key)) is not None
            ]
            x_pos, y_pos = self._default_node_position(
                index=level_seen.get(node.level, 0),
                total=level_totals.get(node.level, len(analysis.nodes)),
                level=node.level,
            )
            level_seen[node.level] = level_seen.get(node.level, 0) + 1
            policy_node_result = await self.session.execute(
                text(
                    """
                    INSERT INTO policy_system_nodes (
                        policy_document_id,
                        node_catalog_id,
                        label,
                        description,
                        level,
                        category,
                        related_stakeholder_ids_json,
                        x_pos,
                        y_pos
                    )
                    VALUES (
                        :policy_document_id,
                        :node_catalog_id,
                        :label,
                        :description,
                        :level,
                        :category,
                        :related_stakeholder_ids_json,
                        :x_pos,
                        :y_pos
                    )
                    ON CONFLICT (policy_document_id, node_catalog_id)
                    DO UPDATE SET
                        label = EXCLUDED.label,
                        description = EXCLUDED.description,
                        level = EXCLUDED.level,
                        category = EXCLUDED.category,
                        related_stakeholder_ids_json = EXCLUDED.related_stakeholder_ids_json,
                        x_pos = COALESCE(policy_system_nodes.x_pos, EXCLUDED.x_pos),
                        y_pos = COALESCE(policy_system_nodes.y_pos, EXCLUDED.y_pos),
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id, created_at, updated_at, x_pos, y_pos;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "node_catalog_id": node_id,
                    "label": node.label,
                    "description": node.description,
                    "level": node.level,
                    "category": node.category,
                    "related_stakeholder_ids_json": json.dumps(related_stakeholder_ids),
                    "x_pos": x_pos,
                    "y_pos": y_pos,
                },
            )
            policy_node_row = policy_node_result.mappings().one()
            policy_node_id = int(policy_node_row["id"])
            node_entry = {
                "policy_node_id": policy_node_id,
                "node_id": node_id,
            }
            self._register_aliases(node_key_map, node_entry, node.node_key, node.label)
            nodes.append(
                PolicySystemNode(
                    policy_node_id=policy_node_id,
                    node_id=node_id,
                    node_key=node.node_key,
                    label=node.label,
                    description=node.description,
                    level=node.level,
                    category=node.category,
                    related_stakeholder_ids=related_stakeholder_ids,
                    x=float(policy_node_row["x_pos"]) if policy_node_row["x_pos"] is not None else None,
                    y=float(policy_node_row["y_pos"]) if policy_node_row["y_pos"] is not None else None,
                    created_at=policy_node_row["created_at"].isoformat(),
                    updated_at=policy_node_row["updated_at"].isoformat(),
                )
            )

        connections: list[PolicySystemConnection] = []
        connection_key_map: dict[str, int] = {}
        for connection in analysis.connections:
            source = self._resolve_alias(node_key_map, connection.source_node_key)
            if source is None:
                source = await self._create_inferred_policy_node(
                    policy_id=policy_id,
                    reference_key=connection.source_node_key,
                    node_key_map=node_key_map,
                    nodes=nodes,
                )
            target = self._resolve_alias(node_key_map, connection.target_node_key)
            if target is None:
                target = await self._create_inferred_policy_node(
                    policy_id=policy_id,
                    reference_key=connection.target_node_key,
                    node_key_map=node_key_map,
                    nodes=nodes,
                )
            connection_result = await self.session.execute(
                text(
                    """
                    INSERT INTO policy_system_connections (
                        policy_document_id,
                        source_policy_node_id,
                        target_policy_node_id,
                        relationship_type,
                        explanation,
                        polarity
                    )
                    VALUES (
                        :policy_document_id,
                        :source_policy_node_id,
                        :target_policy_node_id,
                        :relationship_type,
                        :explanation,
                        :polarity
                    )
                    RETURNING id, created_at, updated_at;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "source_policy_node_id": source["policy_node_id"],
                    "target_policy_node_id": target["policy_node_id"],
                    "relationship_type": connection.relationship_type,
                    "explanation": connection.explanation,
                    "polarity": connection.polarity,
                },
            )
            connection_row = connection_result.mappings().one()
            connection_id = int(connection_row["id"])
            self._register_aliases(
                connection_key_map,
                connection_id,
                connection.connection_key,
                connection.relationship_type,
            )
            connections.append(
                PolicySystemConnection(
                    connection_id=connection_id,
                    connection_key=connection.connection_key,
                    policy_id=policy_id,
                    source_node_id=source["policy_node_id"],
                    target_node_id=target["policy_node_id"],
                    relationship_type=connection.relationship_type,
                    explanation=connection.explanation,
                    polarity=connection.polarity,
                    created_at=connection_row["created_at"].isoformat(),
                    updated_at=connection_row["updated_at"].isoformat(),
                )
            )

        feedback_loops: list[PolicyFeedbackLoop] = []
        loops_to_save = list(analysis.feedback_loops)
        if not loops_to_save:
            loops_to_save = self._derive_feedback_loops(nodes, connections)

        for loop in loops_to_save:
            if isinstance(loop, PolicyFeedbackLoop):
                affected_stakeholder_ids = loop.affected_stakeholder_ids
                loop_name = loop.loop_name
                loop_type = loop.loop_type
                loop_explanation = loop.explanation
                intervention_points = loop.possible_intervention_points
                loop_key = loop.loop_key
                involved_node_ids = loop.involved_node_ids
                involved_connection_ids = loop.involved_connection_ids
            else:
                affected_stakeholder_ids = [
                    stakeholder_entry["stakeholder_id"]
                    for key in loop.affected_stakeholder_keys
                    if (stakeholder_entry := self._resolve_alias(stakeholder_key_map, key)) is not None
                ]
                loop_name = loop.loop_name
                loop_type = loop.loop_type
                loop_explanation = loop.explanation
                intervention_points = loop.possible_intervention_points
                loop_key = loop.loop_key
                involved_node_ids = []
                involved_connection_ids = []
            loop_result = await self.session.execute(
                text(
                    """
                    INSERT INTO policy_feedback_loops (
                        policy_document_id,
                        loop_name,
                        loop_type,
                        explanation,
                        affected_stakeholder_ids_json,
                        possible_intervention_points_json
                    )
                    VALUES (
                        :policy_document_id,
                        :loop_name,
                        :loop_type,
                        :explanation,
                        :affected_stakeholder_ids_json,
                        :possible_intervention_points_json
                    )
                    RETURNING id, created_at, updated_at;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "loop_name": loop_name,
                    "loop_type": loop_type,
                    "explanation": loop_explanation,
                    "affected_stakeholder_ids_json": json.dumps(affected_stakeholder_ids),
                    "possible_intervention_points_json": json.dumps(intervention_points),
                },
            )
            loop_row = loop_result.mappings().one()
            feedback_loop_id = int(loop_row["id"])

            if not involved_node_ids and not isinstance(loop, PolicyFeedbackLoop):
                for node_key in loop.involved_node_keys:
                    node_entry = self._resolve_alias(node_key_map, node_key)
                    if node_entry is None:
                        node_entry = await self._create_inferred_policy_node(
                            policy_id=policy_id,
                            reference_key=node_key,
                            node_key_map=node_key_map,
                            nodes=nodes,
                        )
                    involved_node_ids.append(node_entry["policy_node_id"])

            if not involved_connection_ids and not isinstance(loop, PolicyFeedbackLoop):
                for connection_key in loop.involved_connection_keys:
                    connection_id = self._resolve_alias(connection_key_map, connection_key)
                    if connection_id is None:
                        continue
                    involved_connection_ids.append(connection_id)

            for policy_node_id in involved_node_ids:
                await self.session.execute(
                    text(
                        """
                        INSERT INTO policy_feedback_loop_nodes (feedback_loop_id, policy_node_id)
                        VALUES (:feedback_loop_id, :policy_node_id);
                        """
                    ),
                    {
                        "feedback_loop_id": feedback_loop_id,
                        "policy_node_id": policy_node_id,
                    },
                )

            for connection_id in involved_connection_ids:
                await self.session.execute(
                    text(
                        """
                        INSERT INTO policy_feedback_loop_connections (feedback_loop_id, connection_id)
                        VALUES (:feedback_loop_id, :connection_id);
                        """
                    ),
                    {
                        "feedback_loop_id": feedback_loop_id,
                        "connection_id": connection_id,
                    },
                )

            feedback_loops.append(
                PolicyFeedbackLoop(
                    feedback_loop_id=feedback_loop_id,
                    loop_key=loop_key,
                    policy_id=policy_id,
                    loop_name=loop_name,
                    involved_node_ids=involved_node_ids,
                    involved_connection_ids=involved_connection_ids,
                    loop_type=loop_type,
                    explanation=loop_explanation,
                    affected_stakeholder_ids=affected_stakeholder_ids,
                    possible_intervention_points=intervention_points,
                    created_at=loop_row["created_at"].isoformat(),
                    updated_at=loop_row["updated_at"].isoformat(),
                )
            )

        boundary: PolicySystemBoundary | None = None
        if analysis.system_boundary is not None:
            included_node_ids: list[int] = []
            for node_key in analysis.system_boundary.included_node_keys:
                node_entry = self._resolve_alias(node_key_map, node_key)
                if node_entry is None:
                    node_entry = await self._create_inferred_policy_node(
                        policy_id=policy_id,
                        reference_key=node_key,
                        node_key_map=node_key_map,
                        nodes=nodes,
                    )
                included_node_ids.append(node_entry["policy_node_id"])

            boundary_result = await self.session.execute(
                text(
                    """
                    INSERT INTO policy_system_boundaries (
                        policy_document_id,
                        system_purpose,
                        included_node_ids_json,
                        excluded_or_external_factors_json,
                        explanation
                    )
                    VALUES (
                        :policy_document_id,
                        :system_purpose,
                        :included_node_ids_json,
                        :excluded_or_external_factors_json,
                        :explanation
                    )
                    RETURNING id, created_at, updated_at;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "system_purpose": analysis.system_boundary.system_purpose,
                    "included_node_ids_json": json.dumps(included_node_ids),
                    "excluded_or_external_factors_json": json.dumps(
                        analysis.system_boundary.excluded_or_external_factors
                    ),
                    "explanation": analysis.system_boundary.explanation,
                },
            )
            boundary_row = boundary_result.mappings().one()
            boundary_id = int(boundary_row["id"])
            for policy_node_id in included_node_ids:
                await self.session.execute(
                    text(
                        """
                        INSERT INTO policy_boundary_nodes (
                            boundary_id, policy_node_id, inclusion_type
                        )
                        VALUES (
                            :boundary_id, :policy_node_id, 'included'
                        );
                        """
                    ),
                    {"boundary_id": boundary_id, "policy_node_id": policy_node_id},
                )
            boundary = PolicySystemBoundary(
                boundary_id=boundary_id,
                policy_id=policy_id,
                system_purpose=analysis.system_boundary.system_purpose,
                included_node_ids=included_node_ids,
                excluded_or_external_factors=analysis.system_boundary.excluded_or_external_factors,
                explanation=analysis.system_boundary.explanation,
                created_at=boundary_row["created_at"].isoformat(),
                updated_at=boundary_row["updated_at"].isoformat(),
            )

        await self.session.commit()

        possible_intervention_points = sorted(
            {
                intervention_point
                for loop in feedback_loops
                for intervention_point in loop.possible_intervention_points
            }
        )

        return PolicyAnalysisResponse(
            policy_id=policy_id,
            text=policy_text,
            policy_domain=analysis.policy_domain,
            llm_model=llm_model,
            created_at=created_at,
            stakeholders=stakeholders,
            nodes=nodes,
            connections=connections,
            feedback_loops=feedback_loops,
            system_boundary=boundary,
            notes=[],
            possible_intervention_points=possible_intervention_points,
        )

    async def list_policies(self) -> list[PolicySummaryResponse]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    p.id,
                    p.policy_text,
                    p.policy_domain,
                    p.llm_model,
                    p.created_at,
                    (SELECT COUNT(*) FROM policy_stakeholder_analyses psa WHERE psa.policy_document_id = p.id) AS stakeholder_count,
                    (SELECT COUNT(*) FROM policy_system_nodes psn WHERE psn.policy_document_id = p.id) AS node_count,
                    (SELECT COUNT(*) FROM policy_system_connections psc WHERE psc.policy_document_id = p.id) AS connection_count,
                    (SELECT COUNT(*) FROM policy_feedback_loops pfl WHERE pfl.policy_document_id = p.id) AS feedback_loop_count,
                    (SELECT COUNT(*) FROM policy_notes pn WHERE pn.policy_document_id = p.id) AS note_count
                FROM policy_documents p
                ORDER BY p.created_at DESC, p.id DESC;
                """
            )
        )
        return [self._build_policy_summary(row) for row in result.mappings().all()]

    async def get_policy_analysis(self, policy_id: int) -> PolicyAnalysisResponse:
        policy_row = await self._get_policy_row(policy_id)
        stakeholders = await self.get_policy_stakeholders(policy_id)
        nodes = await self.get_policy_nodes(policy_id)
        connections = await self.get_policy_connections(policy_id)
        feedback_loops = await self.get_policy_feedback_loops(policy_id)
        boundary = await self.get_policy_boundary(policy_id)
        notes = await self.get_policy_notes(policy_id)
        intervention_points = self._collect_intervention_points(feedback_loops)

        return PolicyAnalysisResponse(
            policy_id=int(policy_row["id"]),
            text=policy_row["policy_text"],
            policy_domain=policy_row["policy_domain"],
            llm_model=policy_row["llm_model"],
            created_at=policy_row["created_at"].isoformat(),
            stakeholders=stakeholders,
            nodes=nodes,
            connections=connections,
            feedback_loops=feedback_loops,
            system_boundary=boundary,
            notes=notes,
            possible_intervention_points=intervention_points,
        )

    async def get_policy_analysis_only(self, policy_id: int) -> PolicyAnalysisOnlyResponse:
        policy_row = await self._get_policy_row(policy_id)
        return PolicyAnalysisOnlyResponse(
            policy_id=int(policy_row["id"]),
            text=policy_row["policy_text"],
            policy_domain=policy_row["policy_domain"],
            llm_model=policy_row["llm_model"],
            created_at=policy_row["created_at"].isoformat(),
            stakeholders=await self.get_policy_stakeholders(policy_id),
        )

    async def get_policy_stakeholders(self, policy_id: int) -> list[PolicyStakeholderAnalysis]:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                SELECT
                    psa.id AS analysis_id,
                    psa.stakeholder_entity_id,
                    se.slug AS stakeholder_key,
                    COALESCE(se.name, psa.stakeholder_name) AS stakeholder_name,
                    COALESCE(se.stakeholder_type, 'Unknown') AS stakeholder_type,
                    psa.stakeholder_summary,
                    psa.main_motivation,
                    psa.goals,
                    psa.organizational_structure_shareholders,
                    psa.corporate_culture_communication_processes,
                    psa.required_resources_dependencies,
                    psa.available_resources,
                    psa.stakeholders_text,
                    psa.cooperation_partners,
                    psa.competitors_antagonists,
                    psa.legislators_national_international,
                    psa.economic_policy_regulation,
                    psa.global_markets_trends,
                    psa.society_public_ngos,
                    psa.media_social_media,
                    psa.technological_developments,
                    psa.environment_climate_change,
                    psa.cultural_norms_values
                FROM policy_stakeholder_analyses psa
                LEFT JOIN stakeholder_entities se ON se.id = psa.stakeholder_entity_id
                WHERE psa.policy_document_id = :policy_id
                ORDER BY psa.id;
                """
            ),
            {"policy_id": policy_id},
        )
        rows = result.mappings().all()
        return [self._build_stakeholder(row) for row in rows]

    async def get_policy_nodes(self, policy_id: int) -> list[PolicySystemNode]:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                SELECT
                    psn.id AS policy_node_id,
                    psn.node_catalog_id,
                    pnc.slug AS node_key,
                    COALESCE(psn.label, pnc.label) AS label,
                    psn.description,
                    psn.level,
                    psn.category,
                    psn.related_stakeholder_ids_json,
                    psn.x_pos,
                    psn.y_pos,
                    psn.created_at,
                    psn.updated_at
                FROM policy_system_nodes psn
                JOIN policy_system_node_catalog pnc ON pnc.id = psn.node_catalog_id
                WHERE psn.policy_document_id = :policy_id
                ORDER BY psn.id;
                """
            ),
            {"policy_id": policy_id},
        )
        rows = result.mappings().all()
        return [self._build_node(row) for row in rows]

    async def get_policy_connections(self, policy_id: int) -> list[PolicySystemConnection]:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    source_policy_node_id,
                    target_policy_node_id,
                    relationship_type,
                    explanation,
                    polarity,
                    created_at,
                    updated_at
                FROM policy_system_connections
                WHERE policy_document_id = :policy_id
                ORDER BY id;
                """
            ),
            {"policy_id": policy_id},
        )
        rows = result.mappings().all()
        return [self._build_connection(policy_id, row) for row in rows]

    async def get_policy_feedback_loops(self, policy_id: int) -> list[PolicyFeedbackLoop]:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    loop_name,
                    loop_type,
                    explanation,
                    affected_stakeholder_ids_json,
                    possible_intervention_points_json,
                    created_at,
                    updated_at
                FROM policy_feedback_loops
                WHERE policy_document_id = :policy_id
                ORDER BY id;
                """
            ),
            {"policy_id": policy_id},
        )
        rows = result.mappings().all()
        loops: list[PolicyFeedbackLoop] = []
        for row in rows:
            node_result = await self.session.execute(
                text(
                    """
                    SELECT policy_node_id
                    FROM policy_feedback_loop_nodes
                    WHERE feedback_loop_id = :feedback_loop_id
                    ORDER BY id;
                    """
                ),
                {"feedback_loop_id": row["id"]},
            )
            connection_result = await self.session.execute(
                text(
                    """
                    SELECT connection_id
                    FROM policy_feedback_loop_connections
                    WHERE feedback_loop_id = :feedback_loop_id
                    ORDER BY id;
                    """
                ),
                {"feedback_loop_id": row["id"]},
            )
            loops.append(
                PolicyFeedbackLoop(
                    feedback_loop_id=int(row["id"]),
                    loop_key=f"feedback-loop-{row['id']}",
                    policy_id=policy_id,
                    loop_name=row["loop_name"],
                    involved_node_ids=[int(item[0]) for item in node_result.all()],
                    involved_connection_ids=[int(item[0]) for item in connection_result.all()],
                    loop_type=row["loop_type"],
                    explanation=row["explanation"],
                    affected_stakeholder_ids=self._decode_json(
                        row["affected_stakeholder_ids_json"], default=[]
                    ),
                    possible_intervention_points=self._decode_json(
                        row["possible_intervention_points_json"], default=[]
                    ),
                    created_at=row["created_at"].isoformat(),
                    updated_at=row["updated_at"].isoformat(),
                )
            )
        return loops

    async def get_policy_boundary(self, policy_id: int) -> PolicySystemBoundary | None:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    system_purpose,
                    included_node_ids_json,
                    excluded_or_external_factors_json,
                    explanation,
                    created_at,
                    updated_at
                FROM policy_system_boundaries
                WHERE policy_document_id = :policy_id
                ORDER BY id DESC
                LIMIT 1;
                """
            ),
            {"policy_id": policy_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            return None
        return PolicySystemBoundary(
            boundary_id=int(row["id"]),
            policy_id=policy_id,
            system_purpose=row["system_purpose"],
            included_node_ids=self._decode_json(row["included_node_ids_json"], default=[]),
            excluded_or_external_factors=self._decode_json(
                row["excluded_or_external_factors_json"], default=[]
            ),
            explanation=row["explanation"],
            created_at=row["created_at"].isoformat(),
            updated_at=row["updated_at"].isoformat(),
        )

    async def get_policy_notes(self, policy_id: int) -> list[PolicyNoteResponse]:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                SELECT id, related_object_type, related_object_id, note_text, created_at, updated_at
                FROM policy_notes
                WHERE policy_document_id = :policy_id
                ORDER BY created_at ASC, id ASC;
                """
            ),
            {"policy_id": policy_id},
        )
        rows = result.mappings().all()
        return [self._build_note(policy_id, row) for row in rows]

    async def get_policy_intervention_points(
        self, policy_id: int
    ) -> PolicyInterventionPointsResponse:
        feedback_loops = await self.get_policy_feedback_loops(policy_id)
        return PolicyInterventionPointsResponse(
            policy_id=policy_id,
            intervention_points=self._collect_intervention_points(feedback_loops),
        )

    async def get_policy_graph(self, policy_id: int) -> PolicyGraphResponse:
        summary = await self.get_policy_summary(policy_id)
        stakeholders = await self.get_policy_stakeholders(policy_id)
        nodes = await self.get_policy_nodes(policy_id)
        connections = await self.get_policy_connections(policy_id)
        feedback_loops = await self.get_policy_feedback_loops(policy_id)
        boundary = await self.get_policy_boundary(policy_id)
        notes = await self.get_policy_notes(policy_id)
        intervention_points = self._collect_intervention_points(feedback_loops)
        return PolicyGraphResponse(
            policy=summary,
            nodes=nodes,
            edges=connections,
            feedback_loops=feedback_loops,
            stakeholders=stakeholders,
            system_boundary=boundary,
            intervention_points=intervention_points,
            notes=notes,
        )

    async def get_policy_summary(self, policy_id: int) -> PolicySummaryResponse:
        row = await self._get_policy_summary_row(policy_id)
        return self._build_policy_summary(row)

    async def delete_policy(self, policy_id: int) -> PolicyDeleteResponse:
        policy_row = await self._get_policy_row(policy_id)
        await self.session.execute(
            text("DELETE FROM policy_documents WHERE id = :policy_id;"),
            {"policy_id": policy_id},
        )
        await self.session.commit()
        return PolicyDeleteResponse(
            policy_id=policy_id,
            deleted=True,
            message=f"Policy {policy_id} deleted successfully.",
        )

    async def add_note(
        self,
        policy_id: int,
        related_object_type: str,
        related_object_id: int | None,
        note_text: str,
    ) -> PolicyNoteResponse:
        await self._get_policy_row(policy_id)
        note_result = await self.session.execute(
            text(
                """
                INSERT INTO policy_notes (
                    related_object_type,
                    related_object_id,
                    policy_document_id,
                    note_text
                )
                VALUES (
                    :related_object_type,
                    :related_object_id,
                    :policy_document_id,
                    :note_text
                )
                RETURNING id, created_at, updated_at;
                """
            ),
            {
                "related_object_type": related_object_type,
                "related_object_id": related_object_id,
                "policy_document_id": policy_id,
                "note_text": note_text,
            },
        )
        note_row = note_result.mappings().one()
        await self.session.commit()
        return PolicyNoteResponse(
            note_id=int(note_row["id"]),
            related_object_type=related_object_type,
            related_object_id=related_object_id,
            policy_id=policy_id,
            note_text=note_text,
            created_at=note_row["created_at"].isoformat(),
            updated_at=note_row["updated_at"].isoformat(),
        )

    async def update_note(
        self, policy_id: int, note_id: int, note_text: str
    ) -> PolicyNoteResponse:
        await self._get_policy_row(policy_id)
        result = await self.session.execute(
            text(
                """
                UPDATE policy_notes
                SET note_text = :note_text,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :note_id
                  AND policy_document_id = :policy_id
                RETURNING id, related_object_type, related_object_id, note_text, created_at, updated_at;
                """
            ),
            {"note_id": note_id, "policy_id": policy_id, "note_text": note_text},
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Policy note not found.")
        await self.session.commit()
        return self._build_note(policy_id, row)

    async def update_policy_node(
        self,
        policy_id: int,
        node_id: int,
        payload: dict[str, Any],
    ) -> PolicySystemNode:
        await self._get_policy_row(policy_id)
        current = await self.session.execute(
            text(
                """
                SELECT node_catalog_id
                FROM policy_system_nodes
                WHERE id = :node_id AND policy_document_id = :policy_id;
                """
            ),
            {"node_id": node_id, "policy_id": policy_id},
        )
        current_row = current.mappings().one_or_none()
        if current_row is None:
            raise HTTPException(status_code=404, detail="Policy node not found.")

        updates: list[str] = []
        params: dict[str, Any] = {"node_id": node_id, "policy_id": policy_id}
        if "label" in payload:
            updates.append("label = :label")
            params["label"] = payload["label"]
        if "description" in payload:
            updates.append("description = :description")
            params["description"] = payload["description"]
        if "level" in payload:
            updates.append("level = :level")
            params["level"] = payload["level"]
        if "category" in payload:
            updates.append("category = :category")
            params["category"] = payload["category"]
        if "related_stakeholder_ids" in payload:
            updates.append("related_stakeholder_ids_json = :related_stakeholder_ids_json")
            params["related_stakeholder_ids_json"] = json.dumps(
                payload["related_stakeholder_ids"]
            )
        if "x" in payload:
            updates.append("x_pos = :x_pos")
            params["x_pos"] = payload["x"]
        if "y" in payload:
            updates.append("y_pos = :y_pos")
            params["y_pos"] = payload["y"]
        if not updates:
            return await self._get_policy_node_by_id(policy_id, node_id)

        updates.append("updated_at = CURRENT_TIMESTAMP")
        await self.session.execute(
            text(
                f"""
                UPDATE policy_system_nodes
                SET {", ".join(updates)}
                WHERE id = :node_id AND policy_document_id = :policy_id;
                """
            ),
            params,
        )
        await self.session.commit()
        return await self._get_policy_node_by_id(policy_id, node_id)

    async def update_policy_connection(
        self, policy_id: int, connection_id: int, payload: dict[str, Any]
    ) -> PolicySystemConnection:
        await self._get_policy_row(policy_id)
        updates: list[str] = []
        params: dict[str, Any] = {"connection_id": connection_id, "policy_id": policy_id}
        if "relationship_type" in payload:
            updates.append("relationship_type = :relationship_type")
            params["relationship_type"] = payload["relationship_type"]
        if "explanation" in payload:
            updates.append("explanation = :explanation")
            params["explanation"] = payload["explanation"]
        if "polarity" in payload:
            updates.append("polarity = :polarity")
            params["polarity"] = payload["polarity"]
        if not updates:
            return await self._get_policy_connection_by_id(policy_id, connection_id)

        updates.append("updated_at = CURRENT_TIMESTAMP")
        result = await self.session.execute(
            text(
                f"""
                UPDATE policy_system_connections
                SET {", ".join(updates)}
                WHERE id = :connection_id
                  AND policy_document_id = :policy_id
                RETURNING id;
                """
            ),
            params,
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Policy connection not found.")
        await self.session.commit()
        return await self._get_policy_connection_by_id(policy_id, connection_id)

    async def update_policy_feedback_loop(
        self, policy_id: int, feedback_loop_id: int, payload: dict[str, Any]
    ) -> PolicyFeedbackLoop:
        await self._get_policy_row(policy_id)
        updates: list[str] = []
        params: dict[str, Any] = {
            "feedback_loop_id": feedback_loop_id,
            "policy_id": policy_id,
        }
        if "loop_name" in payload:
            updates.append("loop_name = :loop_name")
            params["loop_name"] = payload["loop_name"]
        if "loop_type" in payload:
            updates.append("loop_type = :loop_type")
            params["loop_type"] = payload["loop_type"]
        if "explanation" in payload:
            updates.append("explanation = :explanation")
            params["explanation"] = payload["explanation"]
        if "affected_stakeholder_ids" in payload:
            updates.append("affected_stakeholder_ids_json = :affected_stakeholder_ids_json")
            params["affected_stakeholder_ids_json"] = json.dumps(
                payload["affected_stakeholder_ids"]
            )
        if "possible_intervention_points" in payload:
            updates.append(
                "possible_intervention_points_json = :possible_intervention_points_json"
            )
            params["possible_intervention_points_json"] = json.dumps(
                payload["possible_intervention_points"]
            )
        if not updates:
            return await self._get_policy_feedback_loop_by_id(policy_id, feedback_loop_id)

        updates.append("updated_at = CURRENT_TIMESTAMP")
        result = await self.session.execute(
            text(
                f"""
                UPDATE policy_feedback_loops
                SET {", ".join(updates)}
                WHERE id = :feedback_loop_id
                  AND policy_document_id = :policy_id
                RETURNING id;
                """
            ),
            params,
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Policy feedback loop not found.")
        await self.session.commit()
        return await self._get_policy_feedback_loop_by_id(policy_id, feedback_loop_id)

    async def update_policy_boundary(
        self, policy_id: int, payload: dict[str, Any]
    ) -> PolicySystemBoundary:
        await self._get_policy_row(policy_id)
        updates: list[str] = []
        params: dict[str, Any] = {"policy_id": policy_id}
        if "system_purpose" in payload:
            updates.append("system_purpose = :system_purpose")
            params["system_purpose"] = payload["system_purpose"]
        if "included_node_ids" in payload:
            updates.append("included_node_ids_json = :included_node_ids_json")
            params["included_node_ids_json"] = json.dumps(payload["included_node_ids"])
        if "excluded_or_external_factors" in payload:
            updates.append(
                "excluded_or_external_factors_json = :excluded_or_external_factors_json"
            )
            params["excluded_or_external_factors_json"] = json.dumps(
                payload["excluded_or_external_factors"]
            )
        if "explanation" in payload:
            updates.append("explanation = :explanation")
            params["explanation"] = payload["explanation"]
        if not updates:
            boundary = await self.get_policy_boundary(policy_id)
            if boundary is None:
                raise HTTPException(status_code=404, detail="System boundary not found.")
            return boundary

        updates.append("updated_at = CURRENT_TIMESTAMP")
        result = await self.session.execute(
            text(
                f"""
                UPDATE policy_system_boundaries
                SET {", ".join(updates)}
                WHERE policy_document_id = :policy_id
                RETURNING id;
                """
            ),
            params,
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="System boundary not found.")
        await self.session.commit()
        boundary = await self.get_policy_boundary(policy_id)
        if boundary is None:
            raise HTTPException(status_code=404, detail="System boundary not found.")
        return boundary

    async def _get_policy_row(self, policy_id: int) -> Any:
        result = await self.session.execute(
            text(
                """
                SELECT id, policy_text, policy_domain, llm_model, created_at
                FROM policy_documents
                WHERE id = :policy_id;
                """
            ),
            {"policy_id": policy_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Policy analysis record not found.")
        return row

    async def _get_policy_summary_row(self, policy_id: int) -> Any:
        result = await self.session.execute(
            text(
                """
                SELECT
                    p.id,
                    p.policy_text,
                    p.policy_domain,
                    p.llm_model,
                    p.created_at,
                    (SELECT COUNT(*) FROM policy_stakeholder_analyses psa WHERE psa.policy_document_id = p.id) AS stakeholder_count,
                    (SELECT COUNT(*) FROM policy_system_nodes psn WHERE psn.policy_document_id = p.id) AS node_count,
                    (SELECT COUNT(*) FROM policy_system_connections psc WHERE psc.policy_document_id = p.id) AS connection_count,
                    (SELECT COUNT(*) FROM policy_feedback_loops pfl WHERE pfl.policy_document_id = p.id) AS feedback_loop_count,
                    (SELECT COUNT(*) FROM policy_notes pn WHERE pn.policy_document_id = p.id) AS note_count
                FROM policy_documents p
                WHERE p.id = :policy_id;
                """
            ),
            {"policy_id": policy_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Policy analysis record not found.")
        return row

    async def _get_policy_node_by_id(
        self, policy_id: int, node_id: int
    ) -> PolicySystemNode:
        result = await self.session.execute(
            text(
                """
                SELECT
                    psn.id AS policy_node_id,
                    psn.node_catalog_id,
                    pnc.slug AS node_key,
                    COALESCE(psn.label, pnc.label) AS label,
                    psn.description,
                    psn.level,
                    psn.category,
                    psn.related_stakeholder_ids_json,
                    psn.x_pos,
                    psn.y_pos,
                    psn.created_at,
                    psn.updated_at
                FROM policy_system_nodes psn
                JOIN policy_system_node_catalog pnc ON pnc.id = psn.node_catalog_id
                WHERE psn.id = :node_id AND psn.policy_document_id = :policy_id;
                """
            ),
            {"node_id": node_id, "policy_id": policy_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Policy node not found.")
        return self._build_node(row)

    async def _get_policy_connection_by_id(
        self, policy_id: int, connection_id: int
    ) -> PolicySystemConnection:
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    source_policy_node_id,
                    target_policy_node_id,
                    relationship_type,
                    explanation,
                    polarity,
                    created_at,
                    updated_at
                FROM policy_system_connections
                WHERE id = :connection_id AND policy_document_id = :policy_id;
                """
            ),
            {"connection_id": connection_id, "policy_id": policy_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Policy connection not found.")
        return self._build_connection(policy_id, row)

    async def _get_policy_feedback_loop_by_id(
        self, policy_id: int, feedback_loop_id: int
    ) -> PolicyFeedbackLoop:
        loops = await self.get_policy_feedback_loops(policy_id)
        for loop in loops:
            if loop.feedback_loop_id == feedback_loop_id:
                return loop
        raise HTTPException(status_code=404, detail="Policy feedback loop not found.")

    async def _upsert_stakeholder_entity(
        self, stakeholder_name: str, stakeholder_type: str
    ) -> int:
        result = await self.session.execute(
            text(
                """
                INSERT INTO stakeholder_entities (slug, name, stakeholder_type)
                VALUES (:slug, :name, :stakeholder_type)
                ON CONFLICT (slug)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    stakeholder_type = EXCLUDED.stakeholder_type
                RETURNING id;
                """
            ),
            {
                "slug": self._slugify(stakeholder_name),
                "name": stakeholder_name,
                "stakeholder_type": stakeholder_type,
            },
        )
        return int(result.scalar_one())

    async def _upsert_node_catalog(self, label: str, category: str) -> int:
        result = await self.session.execute(
            text(
                """
                INSERT INTO policy_system_node_catalog (slug, label, default_category)
                VALUES (:slug, :label, :default_category)
                ON CONFLICT (slug)
                DO UPDATE SET
                    label = EXCLUDED.label,
                    default_category = EXCLUDED.default_category
                RETURNING id;
                """
            ),
            {
                "slug": self._slugify(label),
                "label": label,
                "default_category": category,
            },
        )
        return int(result.scalar_one())

    async def _create_inferred_policy_node(
        self,
        policy_id: int,
        reference_key: str,
        node_key_map: dict[str, dict[str, int]],
        nodes: list[PolicySystemNode],
    ) -> dict[str, int]:
        label = self._humanize_key(reference_key)
        node_id = await self._upsert_node_catalog(label=label, category="inferred-factor")
        x_pos, y_pos = self._default_node_position(
            index=len(nodes), total=max(len(nodes) + 1, 1), level="Meso"
        )
        policy_node_result = await self.session.execute(
            text(
                """
                INSERT INTO policy_system_nodes (
                    policy_document_id,
                    node_catalog_id,
                    label,
                    description,
                    level,
                    category,
                    related_stakeholder_ids_json,
                    x_pos,
                    y_pos
                )
                VALUES (
                    :policy_document_id,
                    :node_catalog_id,
                    :label,
                    :description,
                    :level,
                    :category,
                    :related_stakeholder_ids_json,
                    :x_pos,
                    :y_pos
                )
                ON CONFLICT (policy_document_id, node_catalog_id)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    x_pos = COALESCE(policy_system_nodes.x_pos, EXCLUDED.x_pos),
                    y_pos = COALESCE(policy_system_nodes.y_pos, EXCLUDED.y_pos),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, created_at, updated_at, x_pos, y_pos;
                """
            ),
            {
                "policy_document_id": policy_id,
                "node_catalog_id": node_id,
                "label": label,
                "description": (
                    "Inferred placeholder created because the policy analysis referenced this "
                    "system element indirectly."
                ),
                "level": "Meso",
                "category": "inferred-factor",
                "related_stakeholder_ids_json": "[]",
                "x_pos": x_pos,
                "y_pos": y_pos,
            },
        )
        row = policy_node_result.mappings().one()
        policy_node_id = int(row["id"])
        node_entry = {"policy_node_id": policy_node_id, "node_id": node_id}
        self._register_aliases(node_key_map, node_entry, reference_key, label)
        nodes.append(
            PolicySystemNode(
                policy_node_id=policy_node_id,
                node_id=node_id,
                node_key=reference_key,
                label=label,
                description=(
                    "Inferred placeholder created because the policy analysis referenced this "
                    "system element indirectly."
                ),
                level="Meso",
                category="inferred-factor",
                related_stakeholder_ids=[],
                x=float(row["x_pos"]) if row["x_pos"] is not None else None,
                y=float(row["y_pos"]) if row["y_pos"] is not None else None,
                created_at=row["created_at"].isoformat(),
                updated_at=row["updated_at"].isoformat(),
            )
        )
        return node_entry

    def _build_policy_summary(self, row: Any) -> PolicySummaryResponse:
        return PolicySummaryResponse(
            policy_id=int(row["id"]),
            text_preview=self._preview_text(row["policy_text"]),
            policy_domain=row["policy_domain"],
            llm_model=row["llm_model"],
            created_at=row["created_at"].isoformat(),
            stakeholder_count=int(row["stakeholder_count"]),
            node_count=int(row["node_count"]),
            connection_count=int(row["connection_count"]),
            feedback_loop_count=int(row["feedback_loop_count"]),
            note_count=int(row["note_count"]),
        )

    def _build_stakeholder(self, row: Any) -> PolicyStakeholderAnalysis:
        from app.schemas import (
            PolicyAnalysisMacroLevel,
            PolicyAnalysisMesoLevel,
            PolicyAnalysisMicroLevel,
        )

        return PolicyStakeholderAnalysis(
            analysis_id=int(row["analysis_id"]),
            stakeholder_id=int(row["stakeholder_entity_id"]) if row["stakeholder_entity_id"] else None,
            stakeholder_key=row["stakeholder_key"],
            stakeholder_name=row["stakeholder_name"],
            stakeholder_type=row["stakeholder_type"],
            stakeholder_summary=row["stakeholder_summary"],
            micro_level=PolicyAnalysisMicroLevel(
                main_motivation=row["main_motivation"],
                goals=row["goals"],
                organizational_structure_shareholders=row["organizational_structure_shareholders"],
                corporate_culture_communication_processes=row[
                    "corporate_culture_communication_processes"
                ],
            ),
            meso_level=PolicyAnalysisMesoLevel(
                required_resources_dependencies=row["required_resources_dependencies"],
                available_resources=row["available_resources"],
                stakeholders=row["stakeholders_text"],
                cooperation_partners=row["cooperation_partners"],
                competitors_antagonists=row["competitors_antagonists"],
            ),
            macro_level=PolicyAnalysisMacroLevel(
                legislators_national_international=row["legislators_national_international"],
                economic_policy_regulation=row["economic_policy_regulation"],
                global_markets_trends=row["global_markets_trends"],
                society_public_ngos=row["society_public_ngos"],
                media_social_media=row["media_social_media"],
                technological_developments=row["technological_developments"],
                environment_climate_change=row["environment_climate_change"],
                cultural_norms_values=row["cultural_norms_values"],
            ),
        )

    def _build_node(self, row: Any) -> PolicySystemNode:
        return PolicySystemNode(
            policy_node_id=int(row["policy_node_id"]),
            node_id=int(row["node_catalog_id"]),
            node_key=row["node_key"],
            label=row["label"],
            description=row["description"],
            level=row["level"],
            category=row["category"],
            related_stakeholder_ids=self._decode_json(
                row["related_stakeholder_ids_json"], default=[]
            ),
            x=float(row["x_pos"]) if row["x_pos"] is not None else None,
            y=float(row["y_pos"]) if row["y_pos"] is not None else None,
            created_at=row["created_at"].isoformat()
            if row.get("created_at") is not None
            else None,
            updated_at=row["updated_at"].isoformat()
            if row.get("updated_at") is not None
            else None,
        )

    def _build_connection(self, policy_id: int, row: Any) -> PolicySystemConnection:
        return PolicySystemConnection(
            connection_id=int(row["id"]),
            connection_key=f"connection-{row['id']}",
            policy_id=policy_id,
            source_node_id=int(row["source_policy_node_id"]),
            target_node_id=int(row["target_policy_node_id"]),
            relationship_type=row["relationship_type"],
            explanation=row["explanation"],
            polarity=row["polarity"],
            created_at=row["created_at"].isoformat()
            if row.get("created_at") is not None
            else None,
            updated_at=row["updated_at"].isoformat()
            if row.get("updated_at") is not None
            else None,
        )

    def _build_note(self, policy_id: int, row: Any) -> PolicyNoteResponse:
        return PolicyNoteResponse(
            note_id=int(row["id"]),
            related_object_type=row["related_object_type"],
            related_object_id=int(row["related_object_id"])
            if row["related_object_id"] is not None
            else None,
            policy_id=policy_id,
            note_text=row["note_text"],
            created_at=row["created_at"].isoformat(),
            updated_at=row["updated_at"].isoformat(),
        )

    def _collect_intervention_points(
        self, feedback_loops: list[PolicyFeedbackLoop]
    ) -> list[str]:
        return sorted(
            {
                point.strip()
                for loop in feedback_loops
                for point in loop.possible_intervention_points
                if point.strip()
            }
        )

    def _decode_json(self, value: str | None, default: Any) -> Any:
        if value is None:
            return default
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default

    def _preview_text(self, value: str, length: int = 120) -> str:
        compact = " ".join(value.split())
        if len(compact) <= length:
            return compact
        return f"{compact[: length - 1].rstrip()}..."

    def _slugify(self, value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return slug or "item"

    def _humanize_key(self, value: str) -> str:
        return re.sub(r"[-_]+", " ", value).strip().title() or "Inferred Node"

    def _default_node_position(
        self, index: int, total: int, level: str
    ) -> tuple[float, float]:
        total = max(total, 1)
        column_x = {"Micro": 220.0, "Meso": 560.0, "Macro": 900.0}
        x = column_x.get(level, 560.0)
        if total == 1:
            y = 360.0
        else:
            top = 140.0
            bottom = 600.0
            step = (bottom - top) / max(total - 1, 1)
            y = top + index * step
        x += -24.0 if index % 2 == 0 else 24.0
        return round(x, 2), round(y, 2)

    def _derive_feedback_loops(
        self,
        nodes: list[PolicySystemNode],
        connections: list[PolicySystemConnection],
    ) -> list[PolicyFeedbackLoop]:
        adjacency: dict[int, list[PolicySystemConnection]] = defaultdict(list)
        node_map = {
            node.policy_node_id: node
            for node in nodes
            if node.policy_node_id is not None
        }
        for connection in connections:
            adjacency[connection.source_node_id].append(connection)

        cycles: list[tuple[list[int], list[int]]] = []
        seen: set[tuple[int, ...]] = set()

        def dfs(start: int, current: int, path_nodes: list[int], path_edges: list[int]) -> None:
            if len(path_nodes) > 5:
                return
            for edge in adjacency.get(current, []):
                next_node = edge.target_node_id
                if next_node == start and len(path_nodes) >= 2:
                    cycle_nodes = path_nodes + [start]
                    cycle_edges = path_edges + [edge.connection_id or 0]
                    key = tuple(sorted(set(cycle_nodes[:-1])))
                    if key and key not in seen:
                        seen.add(key)
                        cycles.append((cycle_nodes[:-1], cycle_edges))
                    continue
                if next_node in path_nodes:
                    continue
                dfs(
                    start,
                    next_node,
                    path_nodes + [next_node],
                    path_edges + [edge.connection_id or 0],
                )

        for node_id in node_map.keys():
            dfs(node_id, node_id, [node_id], [])

        derived: list[PolicyFeedbackLoop] = []
        for index, (cycle_nodes, cycle_edges) in enumerate(cycles[:4], start=1):
            polarity_product = 1
            for connection_id in cycle_edges:
                connection = next(
                    (item for item in connections if item.connection_id == connection_id),
                    None,
                )
                if connection and connection.polarity == "-":
                    polarity_product *= -1
            loop_type = "reinforcing" if polarity_product > 0 else "balancing"
            node_labels = [
                node_map[node_id].label for node_id in cycle_nodes if node_id in node_map
            ]
            affected_stakeholders = sorted(
                {
                    stakeholder_id
                    for node_id in cycle_nodes
                    for stakeholder_id in (
                        node_map[node_id].related_stakeholder_ids
                        if node_id in node_map
                        else []
                    )
                }
            )
            derived.append(
                PolicyFeedbackLoop(
                    feedback_loop_id=None,
                    loop_key=f"derived-loop-{index}",
                    policy_id=None,
                    loop_name=(
                        f"{'Reinforcing' if loop_type == 'reinforcing' else 'Balancing'} loop: "
                        + " -> ".join(node_labels[:3])
                    ),
                    involved_node_ids=cycle_nodes,
                    involved_connection_ids=[item for item in cycle_edges if item],
                    loop_type=loop_type,
                    explanation=(
                        f"This derived {loop_type} loop closes through "
                        f"{' -> '.join(node_labels)}."
                    ),
                    affected_stakeholder_ids=affected_stakeholders,
                    possible_intervention_points=[
                        f"Adjust pressure on {label}" for label in node_labels[:2]
                    ],
                )
            )
        return derived

    def _register_aliases(
        self,
        mapping: dict[str, Any],
        stored_value: Any,
        *aliases: str | None,
    ) -> None:
        for alias in aliases:
            if not alias:
                continue
            mapping[alias] = stored_value
            mapping[self._slugify(alias)] = stored_value

    def _resolve_alias(self, mapping: dict[str, Any], alias: str) -> Any | None:
        return mapping.get(alias) or mapping.get(self._slugify(alias))
