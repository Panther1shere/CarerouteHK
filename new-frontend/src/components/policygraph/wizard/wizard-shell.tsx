import { WizardProvider, useWizard } from "./wizard-context";
import { Step1PolicyInput } from "./step1-policy-input";
import { Step2Stakeholders } from "./step2-stakeholders";
import { Step3SystemMap } from "./step3-system-map";
import { Step4Bundle } from "./step4-bundle";
import { Step5Comparison } from "./step5-comparison";
import { Chatbot } from "./chatbot";
import { Check } from "lucide-react";

const STEPS = [
  { n: 1, label: "Policy" },
  { n: 2, label: "Stakeholders" },
  { n: 3, label: "System map" },
  { n: 4, label: "Bundle" },
  { n: 5, label: "Comparison" },
];

function StepIndicator() {
  const w = useWizard();
  return (
    <div className="border-b hairline bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-6 py-4">
        {STEPS.map((s, i) => {
          const done = w.step > s.n;
          const active = w.step === s.n;
          const reachable =
            s.n === 1 ||
            (s.n <= 2 && !!w.analysis) ||
            (s.n <= 3 && !!w.analysis) ||
            (s.n <= 4 && !!w.analysis) ||
            (s.n === 5 && !!w.bundleAnalysis);
          return (
            <div key={s.n} className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => reachable && w.setStep(s.n)}
                disabled={!reachable}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                    ? "border border-primary/40 text-primary"
                    : reachable
                    ? "border hairline text-muted-foreground hover:text-foreground"
                    : "border hairline text-muted-foreground/50 cursor-not-allowed"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-mono ${
                    active
                      ? "bg-primary-foreground/20"
                      : done
                      ? "bg-primary/15"
                      : "border hairline"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : s.n}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <span className={`h-px w-6 ${done ? "bg-primary/50" : "bg-hairline"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepContent() {
  const w = useWizard();
  return (
    <div className="px-6 py-10">
      {w.step === 1 && <Step1PolicyInput />}
      {w.step === 2 && <Step2Stakeholders />}
      {w.step === 3 && <Step3SystemMap />}
      {w.step === 4 && <Step4Bundle />}
      {w.step === 5 && <Step5Comparison />}
    </div>
  );
}

export function WizardShell() {
  return (
    <WizardProvider>
      <StepIndicator />
      <StepContent />
      <Chatbot />
    </WizardProvider>
  );
}
