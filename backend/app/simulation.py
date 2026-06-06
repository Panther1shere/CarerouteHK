from math import fabs
from typing import Any


METRIC_PRIORITY_BONUS = {
    "affordability": "housing_affordability",
    "speed": "permitting_speed",
    "stability": "rental_stability",
    "trust": "public_trust",
}


SEVERITY_LABELS = (
    (75, "critical"),
    (60, "elevated"),
    (45, "watch"),
    (0, "contained"),
)


def _clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def _round_metric(value: float) -> float:
    return round(value, 1)


def _severity(score: int) -> str:
    for threshold, label in SEVERITY_LABELS:
        if score >= threshold:
            return label
    return "contained"


def simulate_policy(
    scenario: dict[str, Any],
    policy: dict[str, Any],
    nodes: list[dict[str, Any]],
    loops: list[dict[str, Any]],
    neighborhoods: list[dict[str, Any]],
    intensity: int,
    priority: str,
) -> dict[str, Any]:
    baseline_metrics = {metric["slug"]: metric for metric in scenario["baseline_metrics"]}
    node_index = {node["slug"]: node for node in nodes}
    neighborhood_index = {entry["slug"]: entry for entry in neighborhoods}

    intensity_factor = intensity / 100
    priority_metric = METRIC_PRIORITY_BONUS[priority]
    effect_profile = policy["effect_profile"]

    projected_metrics = []
    metric_deltas: dict[str, float] = {}

    for metric_slug, metric in baseline_metrics.items():
        base_delta = effect_profile["metric_deltas"].get(metric_slug, 0) * intensity_factor
        if metric_slug == priority_metric:
            base_delta *= 1.18
        if priority == "trust" and metric_slug == "permitting_speed":
            base_delta *= 0.92
        if priority == "speed" and metric_slug == "public_trust":
            base_delta *= 0.95

        projected = _clamp(metric["value"] + base_delta)
        delta = projected - metric["value"]
        metric_deltas[metric_slug] = delta
        projected_metrics.append(
            {
                "slug": metric_slug,
                "label": metric["label"],
                "baseline": metric["value"],
                "projected": _round_metric(projected),
                "delta": _round_metric(delta),
                "impact_score": _round_metric(fabs(delta) * 4.2),
                "explanation": (
                    f"{metric['label']} changes because {policy['name']} directly shifts "
                    f"{policy['effect_profile']['metric_deltas'].get(metric_slug, 0):+d} points at full intensity."
                ),
            }
        )

    loop_analyses = []
    high_risk_loop_ids: list[str] = []
    for loop in loops:
        delta = int(round(effect_profile["loop_effects"].get(loop["slug"], 0) * intensity_factor))
        if policy["slug"] == "inclusionary-rezoning" and intensity >= 80 and loop["slug"] == "infrastructure-mismatch":
            delta += 4
        if priority == "speed" and loop["slug"] == "approval-bottleneck":
            delta -= 3
        if priority == "trust" and loop["slug"] == "displacement-anxiety":
            delta -= 2

        projected_risk = int(_clamp(loop["base_risk"] + delta))
        if projected_risk >= 60:
            high_risk_loop_ids.append(loop["slug"])

        loop_analyses.append(
            {
                "loop_id": loop["slug"],
                "name": loop["name"],
                "baseline_risk": loop["base_risk"],
                "projected_risk": projected_risk,
                "delta": projected_risk - loop["base_risk"],
                "severity": _severity(projected_risk),
                "explanation": (
                    f"{loop['name']} moves to {projected_risk}/100 because {effect_profile['loop_effects'].get(loop['slug'], 0):+d} "
                    f"is the policy's base loop effect and the chosen intensity amplifies it."
                ),
                "affected_nodes": loop["involved_nodes"],
            }
        )

    affected_nodes = []
    for impact in effect_profile["node_impacts"]:
        score = fabs(impact["impact"]) * intensity_factor * 4.4
        affected_nodes.append(
            {
                "node_slug": impact["node_slug"],
                "name": node_index[impact["node_slug"]]["name"],
                "impact_score": _round_metric(score),
                "confidence": _round_metric(0.69 + min(score / 100, 0.22)),
                "explanation": impact["rationale"],
            }
        )
    affected_nodes.sort(key=lambda item: item["impact_score"], reverse=True)

    neighborhood_outlook = []
    for neighborhood_slug, base_impact in effect_profile["neighborhood_effects"].items():
        value = base_impact * intensity_factor
        if neighborhood_slug == "riverside" and "displacement-anxiety" in high_risk_loop_ids:
            value += 3
        if neighborhood_slug == "central-core" and "infrastructure-mismatch" in high_risk_loop_ids:
            value += 4
        neighborhood = neighborhood_index[neighborhood_slug]
        neighborhood_outlook.append(
            {
                "neighborhood_id": neighborhood_slug,
                "name": neighborhood["name"],
                "impact_score": _round_metric(value * 4.6),
                "confidence": _round_metric(0.65 + min(value / 30, 0.25)),
                "explanation": (
                    f"{neighborhood['name']} feels this policy first because {neighborhood['focus'].lower()}"
                ),
            }
        )
    neighborhood_outlook.sort(key=lambda item: item["impact_score"], reverse=True)

    strongest_metric = max(projected_metrics, key=lambda item: fabs(item["delta"]))
    riskiest_loop = max(loop_analyses, key=lambda item: item["projected_risk"])
    overall_impact = _round_metric(
        sum(item["impact_score"] for item in projected_metrics) / max(len(projected_metrics), 1)
    )
    overall_confidence = _round_metric(
        0.7 + min(intensity_factor * 0.12, 0.14) - max(riskiest_loop["projected_risk"] - 70, 0) / 300
    )
    overall_confidence = max(0.51, overall_confidence)

    explanation = (
        f"{policy['name']} improves {strongest_metric['label'].lower()} most, but "
        f"{riskiest_loop['name'].lower()} remains the primary failure path unless the city "
        "pairs the policy with a supporting intervention."
    )
    key_takeaway = (
        f"Best near-term gain: {strongest_metric['label']} ({strongest_metric['delta']:+.1f}). "
        f"Main watchpoint: {riskiest_loop['name']} at {riskiest_loop['projected_risk']}/100."
    )

    return {
        "scenario_slug": scenario["slug"],
        "policy_slug": policy["slug"],
        "policy_name": policy["name"],
        "priority": priority,
        "intensity": intensity,
        "impact_score": overall_impact,
        "confidence": overall_confidence,
        "explanation": explanation,
        "key_takeaway": key_takeaway,
        "affected_nodes": affected_nodes,
        "projected_metrics": projected_metrics,
        "loop_analyses": loop_analyses,
        "neighborhood_outlook": neighborhood_outlook,
    }
