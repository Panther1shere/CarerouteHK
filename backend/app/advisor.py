from typing import Any


def recommend_interventions(
    simulation: dict[str, Any],
    interventions: list[dict[str, Any]],
    max_results: int,
) -> dict[str, Any]:
    loop_scores = {
        loop["loop_id"]: loop["projected_risk"]
        for loop in simulation["loop_analyses"]
    }
    neighborhood_scores = {
        neighborhood["neighborhood_id"]: neighborhood["impact_score"]
        for neighborhood in simulation["neighborhood_outlook"]
    }

    ranked = []
    for intervention in interventions:
        score = float(intervention["base_effectiveness"])
        if simulation["policy_slug"] in intervention["target_policy_slugs"]:
            score += 9
        score += sum(loop_scores.get(loop_id, 0) for loop_id in intervention["targeted_loop_slugs"]) / 20
        score += sum(neighborhood_scores.get(neighborhood_id, 0) for neighborhood_id in intervention["neighborhood_ids"]) / 40
        if simulation["priority"] == "trust" and "public-trust" in intervention["affected_nodes"]:
            score += 5
        if simulation["priority"] == "speed" and "permitting-speed" in intervention["affected_nodes"]:
            score += 5

        confidence = min(0.93, 0.68 + score / 200)
        ranked.append(
            {
                "slug": intervention["slug"],
                "title": intervention["title"],
                "summary": intervention["summary"],
                "impact_score": round(score, 1),
                "confidence": round(confidence, 2),
                "explanation": (
                    f"{intervention['explanation']} It is ranked highly because it targets "
                    f"{', '.join(intervention['targeted_loop_slugs'])} while supporting the current "
                    f"{simulation['priority']} priority."
                ),
                "tradeoffs": intervention["tradeoffs"],
                "affected_nodes": intervention["affected_nodes"],
                "loop_ids": intervention["targeted_loop_slugs"],
                "neighborhood_ids": intervention["neighborhood_ids"],
            }
        )

    ranked.sort(key=lambda entry: entry["impact_score"], reverse=True)
    selected = ranked[:max_results]
    top_titles = ", ".join(item["title"] for item in selected[:2])
    advisor_brief = (
        f"Use {top_titles} first. They absorb the highest-risk loops created by "
        f"{simulation['policy_name']} without undoing the main {simulation['priority']} gains."
    )

    return {
        "simulation_id": simulation["simulation_id"],
        "advisor_mode": "heuristic-grounded-advisor",
        "advisor_brief": advisor_brief,
        "interventions": selected,
    }
