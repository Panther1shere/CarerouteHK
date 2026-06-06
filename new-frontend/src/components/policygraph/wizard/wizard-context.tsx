import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Dataset, PolicyAnalysis } from "@/lib/policygraph/analyze.functions";

export type Horizon = "short" | "long";
export interface ChatMsg { role: "user" | "assistant"; content: string }
export interface CustomStakeholder {
  label: string;
  level: "micro" | "meso" | "macro";
  note?: string;
}

interface WizardState {
  step: number;
  setStep: (n: number) => void;
  query: string;
  setQuery: (q: string) => void;
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  draftText: string;
  setDraftText: (s: string) => void;
  analysis: PolicyAnalysis | null;
  setAnalysis: (a: PolicyAnalysis | null) => void;
  bundleAnalysis: PolicyAnalysis | null;
  setBundleAnalysis: (a: PolicyAnalysis | null) => void;
  selectedDatasets: Dataset[];
  setSelectedDatasets: (d: Dataset[]) => void;
  customStakeholders: CustomStakeholder[];
  setCustomStakeholders: (s: CustomStakeholder[]) => void;
  chatMessages: ChatMsg[];
  setChatMessages: (m: ChatMsg[] | ((p: ChatMsg[]) => ChatMsg[])) => void;
  reset: () => void;
}

const Ctx = createContext<WizardState | null>(null);
const KEY = "policygraph_wizard_v1";

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<Horizon>("short");
  const [draftText, setDraftText] = useState("");
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(null);
  const [bundleAnalysis, setBundleAnalysis] = useState<PolicyAnalysis | null>(null);
  const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);
  const [customStakeholders, setCustomStakeholders] = useState<CustomStakeholder[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.step) setStep(v.step);
        if (v.query) setQuery(v.query);
        if (v.horizon) setHorizon(v.horizon);
        if (v.draftText) setDraftText(v.draftText);
        if (v.analysis) setAnalysis(v.analysis);
        if (v.bundleAnalysis) setBundleAnalysis(v.bundleAnalysis);
        if (v.selectedDatasets) setSelectedDatasets(v.selectedDatasets);
        if (v.customStakeholders) setCustomStakeholders(v.customStakeholders);
        if (v.chatMessages) setChatMessages(v.chatMessages);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          step, query, horizon, draftText, analysis, bundleAnalysis,
          selectedDatasets, customStakeholders, chatMessages,
        })
      );
    } catch {}
  }, [hydrated, step, query, horizon, draftText, analysis, bundleAnalysis, selectedDatasets, customStakeholders, chatMessages]);

  const reset = () => {
    setStep(1); setQuery(""); setDraftText(""); setAnalysis(null);
    setBundleAnalysis(null); setSelectedDatasets([]); setCustomStakeholders([]);
    setChatMessages([]);
    try { sessionStorage.removeItem(KEY); } catch {}
  };

  return (
    <Ctx.Provider
      value={{
        step, setStep, query, setQuery, horizon, setHorizon, draftText, setDraftText,
        analysis, setAnalysis, bundleAnalysis, setBundleAnalysis,
        selectedDatasets, setSelectedDatasets, customStakeholders, setCustomStakeholders,
        chatMessages, setChatMessages, reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWizard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWizard outside WizardProvider");
  return v;
}
