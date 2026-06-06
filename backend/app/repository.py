import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _decode_json(value: str | None) -> Any:
    if value is None:
        return None
    return json.loads(value)


async def get_default_scenario(session: AsyncSession) -> dict[str, Any]:
    result = await session.execute(
        text(
            """
            SELECT id, slug, name, city_name, summary, analyst_prompt, baseline_metrics_json
            FROM policy_scenarios
            ORDER BY id
            LIMIT 1;
            """
        )
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError("No scenario found.")

    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "city_name": row["city_name"],
        "summary": row["summary"],
        "analyst_prompt": row["analyst_prompt"],
        "baseline_metrics": _decode_json(row["baseline_metrics_json"]),
    }


async def get_policies(session: AsyncSession, scenario_id: int) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            SELECT slug, name, summary, description, default_intensity, policy_type,
                   priority_hint, neighborhood_ids_json, effect_profile_json
            FROM policies
            WHERE scenario_id = :scenario_id
            ORDER BY id;
            """
        ),
        {"scenario_id": scenario_id},
    )
    policies = []
    for row in result.mappings():
        policies.append(
            {
                "slug": row["slug"],
                "name": row["name"],
                "summary": row["summary"],
                "description": row["description"],
                "default_intensity": row["default_intensity"],
                "policy_type": row["policy_type"],
                "priority_hint": row["priority_hint"],
                "neighborhood_ids": _decode_json(row["neighborhood_ids_json"]),
                "effect_profile": _decode_json(row["effect_profile_json"]),
            }
        )
    return policies


async def get_policy(session: AsyncSession, scenario_id: int, policy_slug: str) -> dict[str, Any] | None:
    result = await session.execute(
        text(
            """
            SELECT slug, name, summary, description, default_intensity, policy_type,
                   priority_hint, neighborhood_ids_json, effect_profile_json
            FROM policies
            WHERE scenario_id = :scenario_id AND slug = :policy_slug
            LIMIT 1;
            """
        ),
        {"scenario_id": scenario_id, "policy_slug": policy_slug},
    )
    row = result.mappings().first()
    if row is None:
        return None

    return {
        "slug": row["slug"],
        "name": row["name"],
        "summary": row["summary"],
        "description": row["description"],
        "default_intensity": row["default_intensity"],
        "policy_type": row["policy_type"],
        "priority_hint": row["priority_hint"],
        "neighborhood_ids": _decode_json(row["neighborhood_ids_json"]),
        "effect_profile": _decode_json(row["effect_profile_json"]),
    }


async def get_nodes(session: AsyncSession, scenario_id: int) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            SELECT slug, name, node_type, description, influence_score, x_pos, y_pos, stakeholder_slug
            FROM system_nodes
            WHERE scenario_id = :scenario_id
            ORDER BY id;
            """
        ),
        {"scenario_id": scenario_id},
    )
    return [
        {
            "slug": row["slug"],
            "name": row["name"],
            "node_type": row["node_type"],
            "description": row["description"],
            "influence_score": row["influence_score"],
            "x": float(row["x_pos"]),
            "y": float(row["y_pos"]),
            "stakeholder_slug": row["stakeholder_slug"],
        }
        for row in result.mappings()
    ]


async def get_edges(session: AsyncSession, scenario_id: int) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            SELECT source_slug, target_slug, relationship_label, effect_polarity,
                   effect_strength, explanation
            FROM system_edges
            WHERE scenario_id = :scenario_id
            ORDER BY id;
            """
        ),
        {"scenario_id": scenario_id},
    )
    return [
        {
            "source": row["source_slug"],
            "target": row["target_slug"],
            "label": row["relationship_label"],
            "polarity": row["effect_polarity"],
            "strength": row["effect_strength"],
            "explanation": row["explanation"],
        }
        for row in result.mappings()
    ]


async def get_loops(session: AsyncSession, scenario_id: int) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            SELECT slug, name, loop_type, base_risk, explanation,
                   intervention_signal, involved_nodes_json
            FROM system_loops
            WHERE scenario_id = :scenario_id
            ORDER BY id;
            """
        ),
        {"scenario_id": scenario_id},
    )
    loops = []
    for row in result.mappings():
        loops.append(
            {
                "slug": row["slug"],
                "name": row["name"],
                "loop_type": row["loop_type"],
                "base_risk": row["base_risk"],
                "explanation": row["explanation"],
                "intervention_signal": row["intervention_signal"],
                "involved_nodes": _decode_json(row["involved_nodes_json"]),
            }
        )
    return loops


async def get_neighborhoods(session: AsyncSession, scenario_id: int) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            SELECT slug, name, focus, risk_level, x_pos, y_pos, width, height, accent, explanation
            FROM neighborhoods
            WHERE scenario_id = :scenario_id
            ORDER BY id;
            """
        ),
        {"scenario_id": scenario_id},
    )
    return [
        {
            "slug": row["slug"],
            "name": row["name"],
            "focus": row["focus"],
            "risk_level": row["risk_level"],
            "x": float(row["x_pos"]),
            "y": float(row["y_pos"]),
            "width": float(row["width"]),
            "height": float(row["height"]),
            "accent": row["accent"],
            "explanation": row["explanation"],
        }
        for row in result.mappings()
    ]


async def get_interventions(session: AsyncSession, scenario_id: int) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            SELECT slug, title, summary, target_policy_slugs_json, targeted_loop_slugs_json,
                   base_effectiveness, explanation, tradeoffs_json, metric_shifts_json,
                   affected_nodes_json, neighborhood_ids_json
            FROM interventions
            WHERE scenario_id = :scenario_id
            ORDER BY id;
            """
        ),
        {"scenario_id": scenario_id},
    )
    interventions = []
    for row in result.mappings():
        interventions.append(
            {
                "slug": row["slug"],
                "title": row["title"],
                "summary": row["summary"],
                "target_policy_slugs": _decode_json(row["target_policy_slugs_json"]),
                "targeted_loop_slugs": _decode_json(row["targeted_loop_slugs_json"]),
                "base_effectiveness": row["base_effectiveness"],
                "explanation": row["explanation"],
                "tradeoffs": _decode_json(row["tradeoffs_json"]),
                "metric_shifts": _decode_json(row["metric_shifts_json"]),
                "affected_nodes": _decode_json(row["affected_nodes_json"]),
                "neighborhood_ids": _decode_json(row["neighborhood_ids_json"]),
            }
        )
    return interventions


async def save_simulation_run(
    session: AsyncSession,
    scenario_id: int,
    policy_slug: str,
    intensity: int,
    priority: str,
    result_payload: dict[str, Any],
) -> int:
    result = await session.execute(
        text(
            """
            INSERT INTO simulation_runs (
                scenario_id, policy_slug, intensity, priority, result_json
            )
            VALUES (:scenario_id, :policy_slug, :intensity, :priority, :result_json)
            RETURNING id;
            """
        ),
        {
            "scenario_id": scenario_id,
            "policy_slug": policy_slug,
            "intensity": intensity,
            "priority": priority,
            "result_json": json.dumps(result_payload),
        },
    )
    await session.commit()
    return int(result.scalar_one())


async def get_simulation_run(session: AsyncSession, simulation_id: int) -> dict[str, Any] | None:
    result = await session.execute(
        text(
            """
            SELECT id, scenario_id, policy_slug, intensity, priority, result_json
            FROM simulation_runs
            WHERE id = :simulation_id
            LIMIT 1;
            """
        ),
        {"simulation_id": simulation_id},
    )
    row = result.mappings().first()
    if row is None:
        return None

    return {
        "id": row["id"],
        "scenario_id": row["scenario_id"],
        "policy_slug": row["policy_slug"],
        "intensity": row["intensity"],
        "priority": row["priority"],
        "result": _decode_json(row["result_json"]),
    }
