import { useEffect, useState } from "react";
import { useWizard } from "./wizard-context";
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
  { n: 3, label: "System" },
  { n: 4, label: "Intervention" },
  { n: 5, label: "Comparison" },
];

function StepIndicator() {
  const w = useWizard();
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const updateCompact = () => setCompact(window.scrollY > 120);
    updateCompact();
    window.addEventListener("scroll", updateCompact, { passive: true });
    return () => window.removeEventListener("scroll", updateCompact);
  }, []);

  return (
    <div className="sticky top-[92px] z-20 border-b hairline bg-white/86 backdrop-blur-xl transition-all md:top-[104px]">
      <div className={`mx-auto max-w-7xl px-7 transition-all ${compact ? "py-2.5" : "py-3"}`}>
        <div className="flex items-center gap-2 overflow-x-auto">
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
                  aria-label={`${s.n}. ${s.label}`}
                  title={s.label}
                  className={`flex items-center gap-2 rounded-full border text-xs font-medium uppercase tracking-[0.12em] transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
                      : done
                        ? "border-primary/22 bg-primary/6 text-primary"
                        : reachable
                          ? "hairline bg-white text-muted-foreground hover:border-primary/20 hover:text-foreground"
                          : "hairline bg-white/55 text-muted-foreground/50 cursor-not-allowed"
                  } ${compact ? "px-2.5 py-1.5" : "px-4 py-2"}`}
                >
                  <span
                    className={`grid place-items-center rounded-full text-[10px] font-mono transition-all ${
                      active
                        ? "bg-primary-foreground/18"
                        : done
                          ? "bg-primary/12"
                          : "border hairline bg-white"
                    } ${compact ? "h-6 w-6" : "h-5 w-5"}`}
                  >
                    {done ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  <span className={compact ? "sr-only" : ""}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <span
                    className={`h-px transition-all ${compact ? "w-4" : "w-8"} ${done ? "bg-primary/32" : "bg-hairline"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepContent() {
  const w = useWizard();
  return (
    <div className="px-7 py-9">
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
    <>
      <StepIndicator />
      <StepContent />
      <Chatbot />
    </>
  );
}
