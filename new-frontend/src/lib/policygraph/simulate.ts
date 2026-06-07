import { DIMENSIONS, getPolicy, type Dimension, type Policy } from "./policies";
import { LOOPS, type FeedbackLoop } from "./loops";
import type { StakeholderId } from "./stakeholders";

export interface SimulationResult {
  policies: Policy[];
  primary: Policy;
  horizon: "short" | "long";
  impact: Record<Dimension, number>;
  loops: FeedbackLoop[];
  affected: Record<string, number>;
  warnings: Policy["warnings"];
  bundle: Policy[];
  bundleRationale: string;
}

export function simulate(
  policyIds: string[],
  horizon: "short" | "long" = "short",
): SimulationResult {
  const policies = policyIds.map(getPolicy).filter(Boolean) as Policy[];
  const primary = policies[0];

  const impact: Record<Dimension, number> = Object.fromEntries(
    DIMENSIONS.map((d) => [d.id, 0]),
  ) as Record<Dimension, number>;

  const counts: Record<Dimension, number> = Object.fromEntries(
    DIMENSIONS.map((d) => [d.id, 0]),
  ) as Record<Dimension, number>;

  for (const p of policies) {
    const src = horizon === "short" ? p.impactShort : p.impactLong;
    for (const d of DIMENSIONS) {
      const v = src[d.id];
      if (typeof v === "number") {
        impact[d.id] += v;
        counts[d.id] += 1;
      }
    }
  }
  // Diminishing returns when stacking
  for (const d of DIMENSIONS) {
    if (counts[d.id] > 1) {
      impact[d.id] = impact[d.id] * (1 - 0.12 * (counts[d.id] - 1));
    }
    impact[d.id] = Math.max(-10, Math.min(10, Number(impact[d.id].toFixed(2))));
  }

  const affected: Record<string, number> = {};
  for (const p of policies) {
    for (const [k, v] of Object.entries(p.affected)) {
      affected[k] = (affected[k] ?? 0) + (v as number);
    }
  }
  for (const k of Object.keys(affected)) {
    affected[k] = Math.max(-1, Math.min(1, Number(affected[k].toFixed(2))));
  }

  const loopIds = Array.from(new Set(policies.flatMap((p) => p.loops)));
  const loops = loopIds.map((id) => LOOPS[id]).filter(Boolean);

  const warnings = policies.flatMap((p) => p.warnings);

  const bundle = primary.recommendedBundle.map(getPolicy).filter(Boolean) as Policy[];

  return {
    policies,
    primary,
    horizon,
    impact,
    loops,
    affected: affected as Record<StakeholderId, number>,
    warnings,
    bundle,
    bundleRationale: primary.bundleRationale,
  };
}
