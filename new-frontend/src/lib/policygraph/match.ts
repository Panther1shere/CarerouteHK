import { POLICIES } from "./policies";

export function matchPolicy(input: string): { id: string; confidence: number } {
  const q = input.toLowerCase();
  let best = { id: POLICIES[0].id, confidence: 0 };
  for (const p of POLICIES) {
    let score = 0;
    for (const kw of p.keywords) {
      if (q.includes(kw)) score += kw.split(" ").length;
    }
    if (q.includes(p.label.toLowerCase())) score += 5;
    if (score > best.confidence) best = { id: p.id, confidence: score };
  }
  return best;
}
