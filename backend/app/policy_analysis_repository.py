import json
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
        nodes: list[PolicySystemNode] = []
        for node in analysis.nodes:
            node_id = await self._upsert_node_catalog(label=node.label, category=node.category)
            related_stakeholder_ids = [
                stakeholder_entry["stakeholder_id"]
                for key in node.stakeholder_keys
                if (stakeholder_entry := self._resolve_alias(stakeholder_key_map, key)) is not None
            ]
            policy_node_result = await self.session.execute(
                text(
                    """
                    INSERT INTO policy_system_nodes (
                        policy_document_id,
                        node_catalog_id,
                        description,
                        level,
                        category,
                        related_stakeholder_ids_json
                    )
                    VALUES (
                        :policy_document_id,
                        :node_catalog_id,
                        :description,
                        :level,
                        :category,
                        :related_stakeholder_ids_json
                    )
                    ON CONFLICT (policy_document_id, node_catalog_id)
                    DO UPDATE SET
                        description = EXCLUDED.description,
                        level = EXCLUDED.level,
                        category = EXCLUDED.category,
                        related_stakeholder_ids_json = EXCLUDED.related_stakeholder_ids_json
                    RETURNING id;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "node_catalog_id": node_id,
                    "description": node.description,
                    "level": node.level,
                    "category": node.category,
                    "related_stakeholder_ids_json": json.dumps(related_stakeholder_ids),
                },
            )
            policy_node_id = int(policy_node_result.scalar_one())
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
                    RETURNING id;
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
            connection_id = int(connection_result.scalar_one())
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
                )
            )

        feedback_loops: list[PolicyFeedbackLoop] = []
        for loop in analysis.feedback_loops:
            affected_stakeholder_ids = [
                stakeholder_entry["stakeholder_id"]
                for key in loop.affected_stakeholder_keys
                if (stakeholder_entry := self._resolve_alias(stakeholder_key_map, key)) is not None
            ]
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
                    RETURNING id;
                    """
                ),
                {
                    "policy_document_id": policy_id,
                    "loop_name": loop.loop_name,
                    "loop_type": loop.loop_type,
                    "explanation": loop.explanation,
                    "affected_stakeholder_ids_json": json.dumps(affected_stakeholder_ids),
                    "possible_intervention_points_json": json.dumps(loop.possible_intervention_points),
                },
            )
            feedback_loop_id = int(loop_result.scalar_one())

            involved_node_ids: list[int] = []
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
                await self.session.execute(
                    text(
                        """
                        INSERT INTO policy_feedback_loop_nodes (feedback_loop_id, policy_node_id)
                        VALUES (:feedback_loop_id, :policy_node_id);
                        """
                    ),
                    {
                        "feedback_loop_id": feedback_loop_id,
                        "policy_node_id": node_entry["policy_node_id"],
                    },
                )

            involved_connection_ids: list[int] = []
            for connection_key in loop.involved_connection_keys:
                connection_id = self._resolve_alias(connection_key_map, connection_key)
                if connection_id is None:
                    continue
                involved_connection_ids.append(connection_id)
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
                    loop_key=loop.loop_key,
                    policy_id=policy_id,
                    loop_name=loop.loop_name,
                    involved_node_ids=involved_node_ids,
                    involved_connection_ids=involved_connection_ids,
                    loop_type=loop.loop_type,
                    explanation=loop.explanation,
                    affected_stakeholder_ids=affected_stakeholder_ids,
                    possible_intervention_points=loop.possible_intervention_points,
                )
            )

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
                RETURNING id;
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
        boundary_id = int(boundary_result.scalar_one())
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
            system_boundary=PolicySystemBoundary(
                boundary_id=boundary_id,
                policy_id=policy_id,
                system_purpose=analysis.system_boundary.system_purpose,
                included_node_ids=included_node_ids,
                excluded_or_external_factors=analysis.system_boundary.excluded_or_external_factors,
                explanation=analysis.system_boundary.explanation,
            ),
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
        if boundary is None:
            raise HTTPException(status_code=404, detail="System boundary not found for this policy.")

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
                    pnc.label,
                    psn.description,
                    psn.level,
                    psn.category,
                    psn.related_stakeholder_ids_json
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
                    polarity
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
                    possible_intervention_points_json
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
                    explanation
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
        intervention_points = self._collect_intervention_points(feedback_loops)
        return PolicyGraphResponse(
            policy=summary,
            nodes=nodes,
            edges=connections,
            feedback_loops=feedback_loops,
            stakeholders=stakeholders,
            boundary=boundary,
            intervention_points=intervention_points,
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
        policy_node_result = await self.session.execute(
            text(
                """
                INSERT INTO policy_system_nodes (
                    policy_document_id,
                    node_catalog_id,
                    description,
                    level,
                    category,
                    related_stakeholder_ids_json
                )
                VALUES (
                    :policy_document_id,
                    :node_catalog_id,
                    :description,
                    :level,
                    :category,
                    :related_stakeholder_ids_json
                )
                ON CONFLICT (policy_document_id, node_catalog_id)
                DO UPDATE SET
                    description = EXCLUDED.description
                RETURNING id;
                """
            ),
            {
                "policy_document_id": policy_id,
                "node_catalog_id": node_id,
                "description": (
                    "Inferred placeholder created because the policy analysis referenced this "
                    "system element indirectly."
                ),
                "level": "Meso",
                "category": "inferred-factor",
                "related_stakeholder_ids_json": "[]",
            },
        )
        policy_node_id = int(policy_node_result.scalar_one())
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
