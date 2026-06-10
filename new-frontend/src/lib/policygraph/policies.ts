import type { StakeholderId } from "./stakeholders";

export type Dimension =
  | "affordability"
  | "supply"
  | "publicBudget"
  | "developerIncentives"
  | "tenantProtection"
  | "constructionSpeed"
  | "transportPressure"
  | "inequality"
  | "publicSatisfaction";

export const DIMENSIONS: { id: Dimension; label: string; positiveIsGood: boolean }[] = [
  { id: "affordability", label: "Affordability", positiveIsGood: true },
  { id: "supply", label: "Housing Supply", positiveIsGood: true },
  { id: "publicBudget", label: "Fiscal Position", positiveIsGood: true },
  { id: "developerIncentives", label: "Developer Incentives", positiveIsGood: true },
  { id: "tenantProtection", label: "Tenant Protection", positiveIsGood: true },
  { id: "constructionSpeed", label: "Construction Speed", positiveIsGood: true },
  { id: "transportPressure", label: "Transport Pressure", positiveIsGood: false },
  { id: "inequality", label: "Inequality", positiveIsGood: false },
  { id: "publicSatisfaction", label: "Public Satisfaction", positiveIsGood: true },
];

export interface Warning {
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
}

export interface Policy {
  id: string;
  label: string;
  short: string;
  oneLiner: string;
  keywords: string[];
  affected: Partial<Record<StakeholderId, number>>; // -1..1 influence weight
  loops: string[];
  impactShort: Partial<Record<Dimension, number>>; // -10..10
  impactLong: Partial<Record<Dimension, number>>;
  warnings: Warning[];
  recommendedBundle: string[]; // other policy ids
  bundleRationale: string;
}

export const POLICIES: Policy[] = [
  {
    id: "rentControl",
    label: "Stronger rent control",
    short: "Cap annual rent increases in high-density districts.",
    oneLiner:
      "Protects existing tenants by capping landlord pricing power; risks shrinking formal rental supply.",
    keywords: ["rent", "control", "cap", "ceiling", "freeze", "regulate landlord"],
    affected: {
      tenants: 0.9,
      landlords: -0.8,
      lowIncome: 0.6,
      elderly: 0.5,
      investors: -0.5,
      developers: -0.3,
    },
    loops: ["rentControlSupply"],
    impactShort: {
      affordability: 5,
      tenantProtection: 8,
      publicSatisfaction: 4,
      supply: -2,
      developerIncentives: -3,
    },
    impactLong: {
      affordability: -2,
      tenantProtection: 6,
      supply: -6,
      developerIncentives: -5,
      constructionSpeed: -3,
      inequality: 1,
    },
    warnings: [
      {
        severity: "high",
        title: "Formal supply contraction",
        detail:
          "Without supply-side measures, landlords exit the formal market, pushing pressure into informal channels.",
      },
      {
        severity: "medium",
        title: "Quality decline",
        detail: "Capped revenue often reduces maintenance investment over a 3–5 year horizon.",
      },
    ],
    recommendedBundle: ["fastApprovals", "vacancyTax"],
    bundleRationale:
      "Pair tenant protection with faster affordable approvals and vacancy activation to keep supply elastic.",
  },
  {
    id: "rentSubsidy",
    label: "Rent subsidies for low-income",
    short: "Direct cash assistance to qualifying low-income households.",
    oneLiner:
      "Immediate relief for vulnerable households; gets captured by landlords without parallel supply growth.",
    keywords: ["subsidy", "voucher", "cash", "assistance", "support low income"],
    affected: {
      lowIncome: 0.9,
      elderly: 0.7,
      tenants: 0.6,
      landlords: 0.5,
      govFinance: -0.7,
    },
    loops: ["subsidyDemand", "inequalityRelief"],
    impactShort: {
      affordability: 6,
      tenantProtection: 5,
      inequality: -5,
      publicSatisfaction: 5,
      publicBudget: -5,
    },
    impactLong: {
      affordability: -1,
      tenantProtection: 3,
      inequality: -3,
      publicBudget: -7,
      supply: -1,
    },
    warnings: [
      {
        severity: "high",
        title: "Subsidy capture by landlords",
        detail:
          "Subsidies inflate willingness-to-pay; without supply expansion, rents absorb the transfer.",
      },
      {
        severity: "medium",
        title: "Growing fiscal liability",
        detail: "Annual subsidy bills compound as eligibility expands.",
      },
    ],
    recommendedBundle: ["fastApprovals", "landSupply"],
    bundleRationale:
      "Combine demand support with new supply so subsidy value reaches households, not landlords.",
  },
  {
    id: "vacancyTax",
    label: "Vacancy tax on idle units",
    short: "Tax residential units left vacant beyond a threshold.",
    oneLiner: "Activates dormant stock by changing landlord carrying-cost math.",
    keywords: ["vacancy", "empty", "idle", "vacant", "tax empty"],
    affected: {
      landlords: -0.4,
      tenants: 0.5,
      investors: -0.3,
      govFinance: 0.4,
      publicHousing: 0.2,
    },
    loops: ["vacancyFormalisation"],
    impactShort: {
      supply: 4,
      affordability: 2,
      publicBudget: 3,
      tenantProtection: 2,
      developerIncentives: -1,
    },
    impactLong: {
      supply: 5,
      affordability: 3,
      publicBudget: 2,
      inequality: -2,
      publicSatisfaction: 3,
    },
    warnings: [
      {
        severity: "low",
        title: "Enforcement burden",
        detail: "Requires reliable occupancy monitoring to prevent avoidance.",
      },
      {
        severity: "medium",
        title: "Investor signal",
        detail:
          "May modestly cool private investment if combined with other landlord-cost increases.",
      },
    ],
    recommendedBundle: ["fastApprovals"],
    bundleRationale: "Stack with supply expansion to compound the affordability gain.",
  },
  {
    id: "fastApprovals",
    label: "Faster affordable housing approvals",
    short: "Compress public-housing planning and approval cycles.",
    oneLiner: "The strongest balancing lever — moves projects from years to quarters.",
    keywords: ["approval", "planning", "fast", "expedite", "permit", "affordable housing"],
    affected: {
      publicHousing: 0.9,
      developers: 0.6,
      construction: 0.8,
      tenants: 0.5,
      transport: -0.3,
    },
    loops: ["supplyAffordability", "transportLoad"],
    impactShort: {
      supply: 3,
      constructionSpeed: 7,
      developerIncentives: 4,
      publicSatisfaction: 3,
    },
    impactLong: {
      supply: 8,
      affordability: 6,
      constructionSpeed: 6,
      transportPressure: 3,
      inequality: -3,
      publicSatisfaction: 5,
    },
    warnings: [
      {
        severity: "medium",
        title: "Transport spillover",
        detail: "New districts need coordinated transit investment within 3 years.",
      },
    ],
    recommendedBundle: ["landSupply", "vacancyTax"],
    bundleRationale:
      "Couple approval speed with land supply and idle-unit activation for compounding effect.",
  },
  {
    id: "landSupply",
    label: "Increase land supply",
    short: "Release additional land parcels for residential use.",
    oneLiner: "Loosens the deepest constraint in Hong Kong housing — long horizon, high leverage.",
    keywords: ["land", "supply", "release", "reclamation", "zoning"],
    affected: {
      developers: 0.8,
      construction: 0.7,
      publicHousing: 0.6,
      tenants: 0.4,
      investors: 0.5,
      transport: -0.4,
    },
    loops: ["supplyAffordability", "transportLoad"],
    impactShort: {
      supply: 2,
      developerIncentives: 5,
      constructionSpeed: 2,
      publicBudget: -3,
    },
    impactLong: {
      supply: 9,
      affordability: 7,
      constructionSpeed: 5,
      transportPressure: 4,
      inequality: -2,
      publicSatisfaction: 4,
    },
    warnings: [
      {
        severity: "high",
        title: "Long lead time",
        detail: "Benefits land in 5–10 years; pair with shorter-cycle measures for early relief.",
      },
      {
        severity: "medium",
        title: "Transport & infrastructure pressure",
        detail: "Requires coordinated transit and utility expansion.",
      },
    ],
    recommendedBundle: ["fastApprovals", "developerIncentive"],
    bundleRationale: "Pair land with execution capacity so the supply lands sooner.",
  },
  {
    id: "developerIncentive",
    label: "Developer tax incentives",
    short: "Targeted tax relief for affordable-housing developments.",
    oneLiner: "Redirects private capital toward affordable stock without direct public spend.",
    keywords: ["incentive", "tax break", "developer", "private sector"],
    affected: {
      developers: 0.9,
      construction: 0.7,
      investors: 0.7,
      localBiz: 0.4,
      govFinance: -0.4,
      publicHousing: 0.3,
    },
    loops: ["developerIncentive", "supplyAffordability"],
    impactShort: {
      developerIncentives: 8,
      constructionSpeed: 4,
      supply: 3,
      publicBudget: -3,
    },
    impactLong: {
      supply: 6,
      affordability: 4,
      developerIncentives: 6,
      publicBudget: -4,
      inequality: -2,
      publicSatisfaction: 3,
    },
    warnings: [
      {
        severity: "medium",
        title: "Deadweight loss risk",
        detail: "Some incentives subsidize projects that would have happened anyway.",
      },
      {
        severity: "low",
        title: "Targeting requirements",
        detail: "Needs strict eligibility rules to keep affordable-stock focus.",
      },
    ],
    recommendedBundle: ["fastApprovals", "landSupply"],
    bundleRationale:
      "Couple incentive with land and approval speed so capital can actually deploy.",
  },
];

export function getPolicy(id: string): Policy | undefined {
  return POLICIES.find((p) => p.id === id);
}
