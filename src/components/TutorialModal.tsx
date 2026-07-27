import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, X, Rocket } from "lucide-react";
import { NovaLogo } from "@/components/NovaLogo";

const slides = [
  {
    title: "Welcome to NovaSAT",
    body: "Your adaptive SAT mission control. This 60-second tour shows you how to get the most out of the platform. You can skip anytime.",
  },
  {
    title: "Dashboard = Mission Control",
    body: "Every day starts here. See your streak, projected SAT range, weak-area count, and the custom routine for the day.",
  },
  {
    title: "Practice & Daily Plan",
    body: "Practice runs adaptive drills and full simulations. Daily Plan turns your weak topics into a checklist. Tasks get struck through as you finish them.",
  },
  {
    title: "Store & Companion",
    body: "Earn StudyPoints (SP) from drills and tests. Spend them in the Store on cosmetics for Buddy, your study companion.",
  },
  {
    title: "Coach + Weak Areas",
    body: "Read strategy articles in Coach for high-leverage tactics. Weak Areas tells you which topics to attack next — without spoiling specific questions.",
  },
  {
    title: "You're cleared for launch",
    body: "Visit the Help page anytime from your Profile. Now go set a target score and start a drill — your projected range will sharpen with every session.",
  },
];

export function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const nav = useNavigate();
  const slide = slides[step];
  const last = step === slides.length - 1;

  const finish = () => onClose();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="glass glass-purple max-w-lg w-full p-6 sm:p-8 relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <NovaLogo size={40} glow />
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Step {step + 1} of {slides.length}
          </div>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
          {slide.title}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{slide.body}</p>

        <div className="mt-5 flex gap-1.5">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {!last ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={finish}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold"
              >
                Launch <Rocket className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
