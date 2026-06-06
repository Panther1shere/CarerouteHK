import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============== Schemas ==============

const AnalysisRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  source: z.string().optional(), // citation id or url, optional
});

const StakeholderSchema = z.object({
  id: z.string(),
  label: z.string(),
  short: z.string().max(8),
  group: z.enum(["people", "market", "government"]),
  level: z.enum(["micro", "meso", "macro"]),
  impact: z.number().min(-1).max(1),
  note: z.string(),
  analysis: z.array(AnalysisRowSchema).min(3).max(14),
});

const LoopSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["R", "B"]),
  chain: z.array(z.object({ node: z.string(), effect: z.string() })).min(2),
  summary: z.string(),
  evidence: z.array(z.string()).max(5).optional(),
});

const WarningSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  title: z.string(),
  detail: z.string(),
});

const ImpactSchema = z.object({
  affordability: z.number().min(-10).max(10),
  supply: z.number().min(-10).max(10),
  publicBudget: z.number().min(-10).max(10),
  developerIncentives: z.number().min(-10).max(10),
  tenantProtection: z.number().min(-10).max(10),
  constructionSpeed: z.number().min(-10).max(10),
  transportPressure: z.number().min(-10).max(10),
  inequality: z.number().min(-10).max(10),
  publicSatisfaction: z.number().min(-10).max(10),
});

const DatasetSchema = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  notes: z.string(),
  url: z.string(),
  query: z.string(),
});

const AnalysisCoreSchema = z.object({
  interpretation: z.string(),
  policy: z.object({ label: z.string(), summary: z.string() }),
  stakeholders: z.array(StakeholderSchema).min(5).max(16),
  loops: z.array(LoopSchema).min(2).max(5),
  impactShort: ImpactSchema,
  impactLong: ImpactSchema,
  warnings: z.array(WarningSchema).min(2).max(6),
  bundle: z
    .array(z.object({ label: z.string(), short: z.string(), description: z.string().optional(), rationale: z.string().optional() }))
    .min(2)
    .max(4),
  bundleRationale: z.string(),
  sources: z.array(z.object({ label: z.string(), url: z.string() })).max(10),
  datasetUsage: z.string(),
});

export type Dataset = z.infer<typeof DatasetSchema>;
export type Stakeholder = z.infer<typeof StakeholderSchema>;
export type AnalysisRow = z.infer<typeof AnalysisRowSchema>;
export type PolicyAnalysis = z.infer<typeof AnalysisCoreSchema> & { datasets: Dataset[] };

const QueriesSchema = z.object({
  queries: z.array(z.string().min(2).max(60)).min(2).max(6),
});

// ============== Prompts ==============

const PLANNER_PROMPT = `You are a Hong Kong open-data research planner. Given a proposed HK housing policy, return 3-5 short search queries (each 1-4 words, in English) that will retrieve the most relevant datasets from data.gov.hk's CKAN catalogue.

Focus on indicators directly relevant to the policy: rents, supply pipeline, vacancy, household income, subdivided units, public housing waiting list, land sales, demographics, transport load, etc.

Return ONLY JSON: { "queries": ["...", "..."] }. No prose. No code fences.`;

const ANALYSIS_PROMPT = `You are PolicyGraph HK, a system-dynamics analyst for the Hong Kong SAR Government's housing policy domain.

You will be given (a) a proposed policy and (b) a list of REAL datasets retrieved from data.gov.hk that you MUST ground your analysis in.

Return ONLY a JSON object matching this schema:

{
  "interpretation": string,
  "policy": { "label": string, "summary": string },
  "stakeholders": Array<{
    "id": string, "label": string, "short": string (2-4 chars),
    "group": "people"|"market"|"government",
    "level": "micro"|"meso"|"macro",
    "impact": number (-1..1),
    "note": string,
    "analysis": Array<{ "key": string, "label": string, "value": string, "source"?: string }>
  }>,  // 6-12 entries

  "loops": Array<{ "id": string, "title": string, "type": "R"|"B",
    "chain": Array<{"node": string, "effect": string}>,
    "summary": string, "evidence"?: string[] }>,  // 2-4

  "impactShort": { affordability, supply, publicBudget, developerIncentives,
    tenantProtection, constructionSpeed, transportPressure, inequality,
    publicSatisfaction } each -10..10,
  "impactLong": same 9 keys,

  "warnings": Array<{ "severity": "low"|"medium"|"high", "title": string, "detail": string }>,  // 2-5
  "bundle": Array<{ "label": string, "short": string, "description": string, "rationale"?: string }>,  // 2-4. "description" = 2-3 sentences explaining what the intervention is and WHY it is needed given the policy context.
  "bundleRationale": string,
  "sources": Array<{ "label": string, "url": string }>,
  "datasetUsage": string
}

For each stakeholder, the "level" field follows this taxonomy:
- "micro": the stakeholder as an organisation/individual. analysis rows MUST include keys: mainMotivation, goals, orgStructure, culture.
- "meso": the stakeholder's environment. analysis rows MUST include keys: requiredResources, availableResources, involvedParties, cooperationPartners, competitors.
- "macro": broader system forces. analysis rows MUST include keys: legislators, economicPolicy, globalMarkets, societyNgos, media, technology, environment, culturalNorms.

Each analysis row's "label" is the human-readable name; "value" is 1-3 sentences specific to Hong Kong; "source" cites a dataset id from below OR an HKSAR URL when applicable (omit if pure inference).

Rules:
- Be specific to Hong Kong (SDU, PRH, HOS, Northern Metropolis, LTHS, etc.).
- impactShort vs impactLong should diverge where second-order effects warrant it.
- Cite at least 2 of the supplied datasets verbatim by title in datasetUsage.
- Output ONLY the JSON object, no prose, no code fences.`;

// ============== Gateway helper ==============

async function callGateway(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  opts: { json?: boolean; model?: string } = {}
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o",
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Model rate-limited. Please retry in a moment.");
    if (res.status === 402) throw new Error("OpenAI quota exceeded. Please check your billing.");
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  const content: string = body?.choices?.[0]?.message?.content ?? "";
  return content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

// ============== CKAN / data.gov.hk ==============

interface CkanResult {
  id?: string;
  name?: string;
  title?: string;
  notes?: string;
  organization?: { title?: string } | null;
}

async function searchDataGovHk(query: string, rows = 3): Promise<Dataset[]> {
  try {
    const url = `https://data.gov.hk/en-data/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=${rows}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const body = (await res.json()) as { result?: { results?: CkanResult[] } };
    const results = body?.result?.results ?? [];
    return results.slice(0, rows).map((r) => ({
      id: r.id ?? r.name ?? Math.random().toString(36).slice(2),
      title: r.title ?? r.name ?? "Untitled dataset",
      organization: r.organization?.title ?? "data.gov.hk",
      notes: (r.notes ?? "").slice(0, 400),
      url: `https://data.gov.hk/en-data/dataset/${r.name ?? r.id ?? ""}`,
      query,
    }));
  } catch {
    return [];
  }
}

// ============== Public server functions ==============

export const analyzePolicy = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      query: z.string().min(2).max(2000),
      horizon: z.enum(["short", "long"]).optional(),
      draftText: z.string().max(50_000).optional(),
      extraStakeholders: z
        .array(z.object({ label: z.string(), level: z.enum(["micro", "meso", "macro"]), note: z.string().optional() }))
        .optional(),
      selectedDatasets: z.array(DatasetSchema).optional(),
    })
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY missing");

    let datasets: Dataset[] = data.selectedDatasets ?? [];

    if (datasets.length === 0) {
      const plannerOut = await callGateway(
        apiKey,
        [
          { role: "system", content: PLANNER_PROMPT },
          { role: "user", content: `Proposed policy: ${data.query}` },
        ],
        { json: true }
      );
      let queries: string[] = [];
      try {
        queries = QueriesSchema.parse(JSON.parse(plannerOut)).queries;
      } catch {
        queries = ["housing", "rental", "public housing"];
      }
      const groups = await Promise.all(queries.map((q) => searchDataGovHk(q)));
      const seen = new Set<string>();
      for (const g of groups) {
        for (const d of g) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          datasets.push(d);
          if (datasets.length >= 10) break;
        }
        if (datasets.length >= 10) break;
      }
    }

    const datasetBlock = datasets.length
      ? datasets
          .map(
            (d, i) =>
              `[${i + 1}] id:${d.id}  ${d.title} — ${d.organization}\n   URL: ${d.url}\n   Notes: ${d.notes || "—"}`
          )
          .join("\n\n")
      : "(no datasets retrieved — analyse from general HK knowledge but flag the gap in datasetUsage)";

    const extras = (data.extraStakeholders ?? [])
      .map((s) => `- ${s.label} (${s.level}): ${s.note ?? ""}`)
      .join("\n");

    const userMsg =
      `Proposed policy: ${data.query}\n` +
      (data.horizon ? `Horizon emphasis: ${data.horizon}\n` : "") +
      (data.draftText ? `\nPolicy draft text (excerpt):\n${data.draftText.slice(0, 10_000)}\n` : "") +
      (extras ? `\nUser-added stakeholders to include and analyse:\n${extras}\n` : "") +
      `\nRetrieved datasets from data.gov.hk:\n${datasetBlock}`;

    const analysisOut = await callGateway(
      apiKey,
      [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: userMsg },
      ],
      { json: true }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(analysisOut);
    } catch {
      throw new Error("Model returned non-JSON output.");
    }
    const result = AnalysisCoreSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Schema validation failed: ${result.error.issues[0]?.message ?? "unknown"}`);
    }
    return { ...result.data, datasets };
  });

// ===== Parse uploaded draft (text/markdown/json only on Worker) =====

export const parseDraft = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      filename: z.string().min(1).max(255),
      mimeType: z.string().max(100),
      contentBase64: z.string().min(1).max(8_000_000), // ~6MB decoded cap
    })
  )
  .handler(async ({ data }) => {
    const lower = data.filename.toLowerCase();
    const isTexty =
      data.mimeType.startsWith("text/") ||
      data.mimeType === "application/json" ||
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      lower.endsWith(".markdown") ||
      lower.endsWith(".json");

    if (!isTexty) {
      throw new Error(
        "Only text, markdown, or JSON drafts are supported for now. Please paste the text or upload a .txt / .md file."
      );
    }
    try {
      const bin = atob(data.contentBase64);
      // Treat as UTF-8
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const text = new TextDecoder("utf-8").decode(bytes).slice(0, 40_000);
      return { text, filename: data.filename, length: text.length };
    } catch {
      throw new Error("Failed to decode the uploaded file.");
    }
  });

// ===== Dataset search (live) =====

export const searchDatasets = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(1).max(100), rows: z.number().min(1).max(10).optional() }))
  .handler(async ({ data }) => {
    return { results: await searchDataGovHk(data.query, data.rows ?? 6) };
  });

// ===== Grounded chat =====

const ChatMsg = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) });

export const chatWithContext = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(ChatMsg).min(1).max(40),
      context: z.object({
        step: z.number().min(1).max(5),
        query: z.string().max(2000),
        horizon: z.enum(["short", "long"]).optional(),
        analysisSummary: z.string().max(20_000).optional(),
        datasets: z.array(z.object({ title: z.string(), url: z.string() })).max(20).optional(),
      }),
    })
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY missing");

    const ctx = data.context;
    const sys = `You are the PolicyGraph HK assistant: a grounded, concise policy analyst.

Active session context:
- Current step: ${ctx.step} of 5
- Policy under analysis: ${ctx.query || "(not yet entered)"}
- Horizon: ${ctx.horizon ?? "n/a"}
- Selected datasets (data.gov.hk):
${(ctx.datasets ?? []).map((d, i) => `  [${i + 1}] ${d.title} — ${d.url}`).join("\n") || "  (none yet)"}

Latest model analysis JSON (truncated):
${ctx.analysisSummary?.slice(0, 12_000) ?? "(no analysis yet — user is still in early steps)"}

Rules:
- Stay grounded in the provided datasets and analysis. If the user asks about something not covered, say "no data in current sources" and suggest a dataset to add.
- Be specific to Hong Kong housing policy.
- Keep answers under ~200 words unless the user explicitly asks for more.
- When suggesting concrete actions the UI can take (e.g. "add stakeholder X"), phrase them as a clear suggestion the user can accept.`;

    const out = await callGateway(
      apiKey,
      [{ role: "system", content: sys }, ...data.messages],
      { model: "gpt-4o" }
    );
    return { reply: out };
  });
