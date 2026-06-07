import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface AnalysisRow {
  key: string;
  label: string;
  value: string;
  source?: string;
}

export interface Stakeholder {
  id: string;
  label: string;
  short: string;
  group: "people" | "market" | "government";
  level: "micro" | "meso" | "macro";
  impact: number;
  note: string;
  analysis: AnalysisRow[];
}

export interface FeedbackLoop {
  id: string;
  title: string;
  type: "R" | "B";
  chain: Array<{ node: string; effect: string }>;
  summary: string;
  evidence?: string[];
}

export interface Warning {
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
}

export interface Dataset {
  id: string;
  title: string;
  organization: string;
  notes: string;
  url: string;
  query: string;
}

export interface GraphNode {
  policy_node_id: number;
  node_id?: number | null;
  node_key?: string | null;
  label: string;
  description: string;
  level: "Micro" | "Meso" | "Macro";
  category: string;
  related_stakeholder_ids: number[];
  x?: number | null;
  y?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GraphEdge {
  connection_id: number;
  connection_key?: string | null;
  policy_id?: number | null;
  source_node_id: number;
  target_node_id: number;
  relationship_type: string;
  explanation: string;
  polarity: "+" | "-";
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GraphFeedbackLoop {
  feedback_loop_id: number;
  loop_key?: string | null;
  policy_id?: number | null;
  loop_name: string;
  involved_node_ids: number[];
  involved_connection_ids: number[];
  loop_type: "reinforcing" | "balancing";
  explanation: string;
  affected_stakeholder_ids: number[];
  possible_intervention_points: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GraphBoundary {
  boundary_id?: number | null;
  policy_id?: number | null;
  system_purpose: string;
  included_node_ids: number[];
  excluded_or_external_factors: string[];
  explanation: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GraphNote {
  note_id: number;
  related_object_type: string;
  related_object_id?: number | null;
  policy_id: number;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyGraphPayload {
  policy: {
    policy_id: number;
    text_preview: string;
    policy_domain: string;
    llm_model: string;
    created_at: string;
    stakeholder_count: number;
    node_count: number;
    connection_count: number;
    feedback_loop_count: number;
    note_count: number;
  };
  stakeholders: Array<Record<string, unknown>>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  feedbackLoops: GraphFeedbackLoop[];
  systemBoundary?: GraphBoundary | null;
  interventionPoints: string[];
  notes: GraphNote[];
}

export interface PolicyAnalysis {
  policyId?: number;
  interpretation: string;
  policy: { label: string; summary: string };
  stakeholders: Stakeholder[];
  loops: FeedbackLoop[];
  impactShort: {
    affordability: number;
    supply: number;
    publicBudget: number;
    developerIncentives: number;
    tenantProtection: number;
    constructionSpeed: number;
    transportPressure: number;
    inequality: number;
    publicSatisfaction: number;
  };
  impactLong: {
    affordability: number;
    supply: number;
    publicBudget: number;
    developerIncentives: number;
    tenantProtection: number;
    constructionSpeed: number;
    transportPressure: number;
    inequality: number;
    publicSatisfaction: number;
  };
  warnings: Warning[];
  bundle: Array<{
    label: string;
    short: string;
    description?: string;
    rationale?: string;
    interventionKey?: string;
    rank?: number;
    targetedFeedbackLoopIds?: number[];
    targetedNodeIds?: number[];
    affectedStakeholderIds?: number[];
    stakeholderFocus?: string[];
    interventionPoints?: string[];
    implementationNotes?: string[];
    tradeoffs?: string[];
    expectedSystemShift?: string;
    confidence?: number;
  }>;
  bundleRationale: string;
  sources: Array<{ label: string; url: string }>;
  datasetUsage: string;
  datasets: Dataset[];
  graph?: PolicyGraphPayload;
}

function backendBaseUrl() {
  return (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function requestBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : `Backend request failed with status ${response.status}.`;
    throw new Error(detail);
  }

  return payload as T;
}

export const analyzePolicy = createServerFn({ method: "POST" })
  .validator(
    z.object({
      query: z.string().min(2).max(2000),
      horizon: z.enum(["short", "long"]).optional(),
      draftText: z.string().max(50_000).optional(),
      extraStakeholders: z
        .array(
          z.object({
            label: z.string(),
            level: z.enum(["micro", "meso", "macro"]),
            note: z.string().optional(),
          }),
        )
        .optional(),
      selectedDatasets: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            organization: z.string(),
            notes: z.string(),
            url: z.string(),
            query: z.string(),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    return requestBackend<PolicyAnalysis>("/api/frontend/policygraph/analyze", {
      method: "POST",
      body: JSON.stringify({
        query: data.query,
        horizon: data.horizon,
        draft_text: data.draftText,
        extra_stakeholders: data.extraStakeholders ?? [],
        selected_datasets: data.selectedDatasets ?? [],
      }),
    });
  });

export const parseDraft = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: z.string().min(1).max(255),
      mimeType: z.string().max(100),
      contentBase64: z.string().min(1).max(8_000_000),
    }),
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
        "Only text, markdown, or JSON drafts are supported for now. Please paste the text or upload a .txt / .md file.",
      );
    }
    try {
      const bin = atob(data.contentBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const text = new TextDecoder("utf-8").decode(bytes).slice(0, 40_000);
      return { text, filename: data.filename, length: text.length };
    } catch {
      throw new Error("Failed to decode the uploaded file.");
    }
  });

export const searchDatasets = createServerFn({ method: "POST" })
  .validator(
    z.object({
      query: z.string().min(1).max(100),
      rows: z.number().min(1).max(10).optional(),
    }),
  )
  .handler(async ({ data }) => {
    return requestBackend<{ results: Dataset[] }>("/api/frontend/policygraph/datasets/search", {
      method: "POST",
      body: JSON.stringify({
        query: data.query,
        rows: data.rows ?? 6,
      }),
    });
  });

const ChatMsg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const chatWithContext = createServerFn({ method: "POST" })
  .validator(
    z.object({
      messages: z.array(ChatMsg).min(1).max(40),
      context: z.object({
        step: z.number().min(1).max(5),
        query: z.string().max(2000),
        horizon: z.enum(["short", "long"]).optional(),
        analysisSummary: z.string().max(20_000).optional(),
        datasets: z
          .array(z.object({ title: z.string(), url: z.string() }))
          .max(20)
          .optional(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    return requestBackend<{ reply: string }>("/api/frontend/policygraph/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: data.messages,
        context: {
          step: data.context.step,
          query: data.context.query,
          horizon: data.context.horizon,
          analysis_summary: data.context.analysisSummary,
          datasets: data.context.datasets ?? [],
        },
      }),
    });
  });

export const addPolicyNote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      policyId: z.number().int().positive(),
      relatedObjectType: z.string().min(1),
      relatedObjectId: z.number().int().positive().optional(),
      noteText: z.string().min(3),
    }),
  )
  .handler(async ({ data }) => {
    return requestBackend<GraphNote>(`/policy/${data.policyId}/notes`, {
      method: "POST",
      body: JSON.stringify({
        related_object_type: data.relatedObjectType,
        related_object_id: data.relatedObjectId ?? null,
        note_text: data.noteText,
      }),
    });
  });

export const updatePolicyNote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      policyId: z.number().int().positive(),
      noteId: z.number().int().positive(),
      noteText: z.string().min(3),
    }),
  )
  .handler(async ({ data }) => {
    return requestBackend<GraphNote>(`/policy/${data.policyId}/notes/${data.noteId}`, {
      method: "PUT",
      body: JSON.stringify({
        note_text: data.noteText,
      }),
    });
  });

export const updatePolicyNode = createServerFn({ method: "POST" })
  .validator(
    z.object({
      policyId: z.number().int().positive(),
      nodeId: z.number().int().positive(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return requestBackend<GraphNode>(`/policy/${data.policyId}/nodes/${data.nodeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        x: data.x,
        y: data.y,
      }),
    });
  });
