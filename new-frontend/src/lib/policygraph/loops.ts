import type { StakeholderId } from "./stakeholders";

export type LoopType = "R" | "B"; // Reinforcing / Balancing

export interface FeedbackLoop {
  id: string;
  title: string;
  type: LoopType;
  chain: { node: StakeholderId | string; effect: string }[];
  summary: string;
}

export const LOOPS: Record<string, FeedbackLoop> = {
  rentControlSupply: {
    id: "rentControlSupply",
    title: "Rent control → supply collapse",
    type: "R",
    chain: [
      { node: "Rent control", effect: "caps revenue" },
      { node: "landlords", effect: "lower profit" },
      { node: "Rental supply", effect: "fewer listed units" },
      { node: "tenants", effect: "more competition" },
      { node: "Informal market", effect: "hidden rent pressure" },
    ],
    summary:
      "Capped rents reduce landlord incentive to list units, shrinking formal supply and pushing pressure into informal markets.",
  },
  subsidyDemand: {
    id: "subsidyDemand",
    title: "Subsidy → demand → rent spiral",
    type: "R",
    chain: [
      { node: "Subsidy", effect: "raises purchasing power" },
      { node: "tenants", effect: "higher willingness to pay" },
      { node: "landlords", effect: "raise asking rents" },
      { node: "govFinance", effect: "subsidy bill grows" },
    ],
    summary:
      "Demand-side subsidies without supply expansion get captured by landlords, eroding the subsidy's value.",
  },
  supplyAffordability: {
    id: "supplyAffordability",
    title: "Supply expansion → affordability",
    type: "B",
    chain: [
      { node: "publicHousing", effect: "faster approvals" },
      { node: "developers", effect: "build more units" },
      { node: "Housing stock", effect: "grows" },
      { node: "tenants", effect: "more options" },
      { node: "Rents", effect: "stabilize" },
    ],
    summary:
      "Faster approvals and unlocked land let supply catch up with demand, the strongest balancing loop for affordability.",
  },
  vacancyFormalisation: {
    id: "vacancyFormalisation",
    title: "Vacancy tax → unit activation",
    type: "B",
    chain: [
      { node: "Vacancy tax", effect: "carrying cost rises" },
      { node: "landlords", effect: "list idle units" },
      { node: "Rental supply", effect: "expands" },
      { node: "tenants", effect: "more available stock" },
    ],
    summary:
      "Taxing empty units shifts landlord economics toward renting, releasing latent supply into the market.",
  },
  developerIncentive: {
    id: "developerIncentive",
    title: "Incentive → construction → jobs",
    type: "R",
    chain: [
      { node: "Tax incentive", effect: "raises project ROI" },
      { node: "developers", effect: "start more projects" },
      { node: "construction", effect: "hiring, activity up" },
      { node: "localBiz", effect: "demand uplift" },
      { node: "investors", effect: "redeploy capital" },
    ],
    summary:
      "Targeted incentives kick a virtuous loop between construction, jobs, and local business spend.",
  },
  transportLoad: {
    id: "transportLoad",
    title: "New supply → transport pressure",
    type: "R",
    chain: [
      { node: "Housing stock", effect: "grows in new districts" },
      { node: "transport", effect: "load increases" },
      { node: "govFinance", effect: "infrastructure spend" },
    ],
    summary:
      "Geographic supply expansion shifts pressure onto transport networks, requiring coordinated investment.",
  },
  inequalityRelief: {
    id: "inequalityRelief",
    title: "Targeted relief → inequality",
    type: "B",
    chain: [
      { node: "Targeted subsidy", effect: "directed to lowIncome" },
      { node: "lowIncome", effect: "housing burden eases" },
      { node: "elderly", effect: "stability rises" },
      { node: "Inequality", effect: "narrows" },
    ],
    summary:
      "Means-tested support, when paired with supply, meaningfully reduces the housing-cost burden on vulnerable groups.",
  },
};
