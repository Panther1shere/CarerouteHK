import json
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.seed_data import DEFAULT_SCENARIO

settings = get_settings()

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def initialize_database() -> None:
    async with engine.begin() as connection:
        create_statements = [
            """
            CREATE TABLE IF NOT EXISTS policy_scenarios (
                id SERIAL PRIMARY KEY,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                city_name TEXT NOT NULL,
                summary TEXT NOT NULL,
                analyst_prompt TEXT NOT NULL,
                baseline_metrics_json TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS stakeholders (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                motivation TEXT NOT NULL,
                influence_level INTEGER NOT NULL,
                role_description TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS system_nodes (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                node_type TEXT NOT NULL,
                description TEXT NOT NULL,
                influence_score INTEGER NOT NULL,
                x_pos REAL NOT NULL,
                y_pos REAL NOT NULL,
                stakeholder_slug TEXT
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS system_edges (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                source_slug TEXT NOT NULL,
                target_slug TEXT NOT NULL,
                relationship_label TEXT NOT NULL,
                effect_polarity INTEGER NOT NULL,
                effect_strength INTEGER NOT NULL,
                explanation TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS system_loops (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                loop_type TEXT NOT NULL,
                base_risk INTEGER NOT NULL,
                explanation TEXT NOT NULL,
                intervention_signal TEXT NOT NULL,
                involved_nodes_json TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS neighborhoods (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                focus TEXT NOT NULL,
                risk_level INTEGER NOT NULL,
                x_pos REAL NOT NULL,
                y_pos REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                accent TEXT NOT NULL,
                explanation TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS policies (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                summary TEXT NOT NULL,
                description TEXT NOT NULL,
                default_intensity INTEGER NOT NULL,
                policy_type TEXT NOT NULL,
                priority_hint TEXT NOT NULL,
                neighborhood_ids_json TEXT NOT NULL,
                effect_profile_json TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS interventions (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                slug TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                target_policy_slugs_json TEXT NOT NULL,
                targeted_loop_slugs_json TEXT NOT NULL,
                base_effectiveness INTEGER NOT NULL,
                explanation TEXT NOT NULL,
                tradeoffs_json TEXT NOT NULL,
                metric_shifts_json TEXT NOT NULL,
                affected_nodes_json TEXT NOT NULL,
                neighborhood_ids_json TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id SERIAL PRIMARY KEY,
                scenario_id INTEGER NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
                policy_slug TEXT NOT NULL,
                intensity INTEGER NOT NULL,
                priority TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
        ]

        for statement in create_statements:
            await connection.execute(text(statement))

        await connection.execute(text("DELETE FROM simulation_runs;"))
        await connection.execute(text("DELETE FROM interventions;"))
        await connection.execute(text("DELETE FROM policies;"))
        await connection.execute(text("DELETE FROM neighborhoods;"))
        await connection.execute(text("DELETE FROM system_loops;"))
        await connection.execute(text("DELETE FROM system_edges;"))
        await connection.execute(text("DELETE FROM system_nodes;"))
        await connection.execute(text("DELETE FROM stakeholders;"))
        await connection.execute(text("DELETE FROM policy_scenarios;"))

        scenario_result = await connection.execute(
            text(
                """
                INSERT INTO policy_scenarios (
                    slug, name, city_name, summary, analyst_prompt, baseline_metrics_json
                )
                VALUES (
                    :slug, :name, :city_name, :summary, :analyst_prompt, :baseline_metrics_json
                )
                RETURNING id;
                """
            ),
            {
                "slug": DEFAULT_SCENARIO["slug"],
                "name": DEFAULT_SCENARIO["name"],
                "city_name": DEFAULT_SCENARIO["city_name"],
                "summary": DEFAULT_SCENARIO["summary"],
                "analyst_prompt": DEFAULT_SCENARIO["analyst_prompt"],
                "baseline_metrics_json": json.dumps(DEFAULT_SCENARIO["baseline_metrics"]),
            },
        )
        scenario_id = int(scenario_result.scalar_one())

        for stakeholder in DEFAULT_SCENARIO["stakeholders"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO stakeholders (
                        scenario_id, slug, name, motivation, influence_level, role_description
                    )
                    VALUES (
                        :scenario_id, :slug, :name, :motivation, :influence_level, :role_description
                    );
                    """
                ),
                {"scenario_id": scenario_id, **stakeholder},
            )

        for node in DEFAULT_SCENARIO["system_nodes"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO system_nodes (
                        scenario_id, slug, name, node_type, description,
                        influence_score, x_pos, y_pos, stakeholder_slug
                    )
                    VALUES (
                        :scenario_id, :slug, :name, :node_type, :description,
                        :influence_score, :x, :y, :stakeholder_slug
                    );
                    """
                ),
                {"scenario_id": scenario_id, **node},
            )

        for edge in DEFAULT_SCENARIO["system_edges"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO system_edges (
                        scenario_id, source_slug, target_slug, relationship_label,
                        effect_polarity, effect_strength, explanation
                    )
                    VALUES (
                        :scenario_id, :source, :target, :label,
                        :polarity, :strength, :explanation
                    );
                    """
                ),
                {"scenario_id": scenario_id, **edge},
            )

        for loop in DEFAULT_SCENARIO["loops"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO system_loops (
                        scenario_id, slug, name, loop_type, base_risk, explanation,
                        intervention_signal, involved_nodes_json
                    )
                    VALUES (
                        :scenario_id, :slug, :name, :loop_type, :base_risk, :explanation,
                        :intervention_signal, :involved_nodes_json
                    );
                    """
                ),
                {
                    "scenario_id": scenario_id,
                    "slug": loop["slug"],
                    "name": loop["name"],
                    "loop_type": loop["loop_type"],
                    "base_risk": loop["base_risk"],
                    "explanation": loop["explanation"],
                    "intervention_signal": loop["intervention_signal"],
                    "involved_nodes_json": json.dumps(loop["involved_nodes"]),
                },
            )

        for neighborhood in DEFAULT_SCENARIO["neighborhoods"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO neighborhoods (
                        scenario_id, slug, name, focus, risk_level, x_pos, y_pos,
                        width, height, accent, explanation
                    )
                    VALUES (
                        :scenario_id, :slug, :name, :focus, :risk_level, :x, :y,
                        :width, :height, :accent, :explanation
                    );
                    """
                ),
                {"scenario_id": scenario_id, **neighborhood},
            )

        for policy in DEFAULT_SCENARIO["policies"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO policies (
                        scenario_id, slug, name, summary, description, default_intensity,
                        policy_type, priority_hint, neighborhood_ids_json, effect_profile_json
                    )
                    VALUES (
                        :scenario_id, :slug, :name, :summary, :description, :default_intensity,
                        :policy_type, :priority_hint, :neighborhood_ids_json, :effect_profile_json
                    );
                    """
                ),
                {
                    "scenario_id": scenario_id,
                    "slug": policy["slug"],
                    "name": policy["name"],
                    "summary": policy["summary"],
                    "description": policy["description"],
                    "default_intensity": policy["default_intensity"],
                    "policy_type": policy["policy_type"],
                    "priority_hint": policy["priority_hint"],
                    "neighborhood_ids_json": json.dumps(policy["neighborhood_ids"]),
                    "effect_profile_json": json.dumps(policy["effect_profile"]),
                },
            )

        for intervention in DEFAULT_SCENARIO["interventions"]:
            await connection.execute(
                text(
                    """
                    INSERT INTO interventions (
                        scenario_id, slug, title, summary, target_policy_slugs_json,
                        targeted_loop_slugs_json, base_effectiveness, explanation,
                        tradeoffs_json, metric_shifts_json, affected_nodes_json,
                        neighborhood_ids_json
                    )
                    VALUES (
                        :scenario_id, :slug, :title, :summary, :target_policy_slugs_json,
                        :targeted_loop_slugs_json, :base_effectiveness, :explanation,
                        :tradeoffs_json, :metric_shifts_json, :affected_nodes_json,
                        :neighborhood_ids_json
                    );
                    """
                ),
                {
                    "scenario_id": scenario_id,
                    "slug": intervention["slug"],
                    "title": intervention["title"],
                    "summary": intervention["summary"],
                    "target_policy_slugs_json": json.dumps(intervention["target_policy_slugs"]),
                    "targeted_loop_slugs_json": json.dumps(intervention["targeted_loop_slugs"]),
                    "base_effectiveness": intervention["base_effectiveness"],
                    "explanation": intervention["explanation"],
                    "tradeoffs_json": json.dumps(intervention["tradeoffs"]),
                    "metric_shifts_json": json.dumps(intervention["metric_shifts"]),
                    "affected_nodes_json": json.dumps(intervention["affected_nodes"]),
                    "neighborhood_ids_json": json.dumps(intervention["neighborhood_ids"]),
                },
            )


async def dispose_database() -> None:
    await engine.dispose()
