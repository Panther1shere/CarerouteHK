export type StakeholderId =
  | "tenants"
  | "landlords"
  | "developers"
  | "construction"
  | "investors"
  | "publicHousing"
  | "transport"
  | "lowIncome"
  | "elderly"
  | "localBiz"
  | "govFinance";

export interface Stakeholder {
  id: StakeholderId;
  label: string;
  short: string;
  group: "people" | "market" | "government";
}

export const STAKEHOLDERS: Stakeholder[] = [
  { id: "tenants", label: "Tenants", short: "TEN", group: "people" },
  { id: "landlords", label: "Landlords", short: "LND", group: "market" },
  { id: "developers", label: "Developers", short: "DEV", group: "market" },
  { id: "construction", label: "Construction", short: "CON", group: "market" },
  { id: "investors", label: "Investors", short: "INV", group: "market" },
  { id: "publicHousing", label: "Public Housing Authority", short: "PHA", group: "government" },
  { id: "transport", label: "Transport Department", short: "TRA", group: "government" },
  { id: "lowIncome", label: "Low-income Residents", short: "LOW", group: "people" },
  { id: "elderly", label: "Elderly Residents", short: "ELD", group: "people" },
  { id: "localBiz", label: "Local Businesses", short: "BIZ", group: "market" },
  { id: "govFinance", label: "Government Finance", short: "FIN", group: "government" },
];

// Precomputed positions on a circle (svg viewBox 0..1000 x 0..600)
export function nodePosition(index: number, total: number) {
  const cx = 500;
  const cy = 300;
  const rx = 420;
  const ry = 230;
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
}
