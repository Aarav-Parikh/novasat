import { Link } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  Sparkles,
  Target,
  Trophy,
  Zap,
  LineChart,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import petEnergetic from "@/assets/pet-energetic.png";

const features = [
  {
    icon: Brain,
    title: "Adaptive drills",
    body: "Every question is tuned to attack the gaps in your mastery map.",
  },
  {
    icon: Target,
    title: "Score projections",
    body: "Live projection of your Bluebook score from real session data, not guesswork.",
  },
  {
    icon: LineChart,
    title: "Mistake autopsy",
    body: "Every miss is logged, categorized, and queued for spaced review.",
  },
  {
    icon: Zap,
    title: "Short or full sims",
    body: "Pick a 50-minute sprint or the full Bluebook simulation when you're ready.",
  },
  {
    icon: Trophy,
    title: "XP, streaks & a pet",
    body: "Built-in habit loop keeps you coming back. Your study pet thrives when you do.",
  },
  {
    icon: Sparkles,
    title: "Daily plan, zero friction",
    body: "Open the app, hit start. We pick the next best thing for you to study.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/auth";
  const ctaLabel = user ? "Open dashboard" : "Start training free";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="starfield" />

      {/* Nav */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-display font-bold">
            N
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Nova<span className="text-gradient-nebula">SAT</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          <a href="#features" className="hidden sm:inline text-muted-foreground hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hidden sm:inline text-muted-foreground hover:text-foreground">
            How it works
          </a>
          <Link
            to={user ? "/app" : "/auth"}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold"
          >
            {user ? "Dashboard" : "Sign in"}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div>
          <span className="inline-block text-[11px] uppercase tracking-[0.3em] text-secondary mb-4">
            Adaptive SAT training
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]">
            Train smarter for the SAT.{" "}
            <span className="text-gradient-nebula">Beat your target score.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl">
            NovaSAT builds you a daily plan, generates adaptive drills around your
            weak spots, and projects your real Bluebook score as you go.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to={ctaHref}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-foreground hover:bg-muted"
            >
              See features
            </a>
          </div>
          <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
            <span>✓ Free to start</span>
            <span>✓ No card required</span>
            <span>✓ Bluebook-style sims</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-tr from-primary/20 to-secondary/20 blur-3xl rounded-full" />
          <div className="relative glass rounded-3xl p-8 flex flex-col items-center">
            <img
              src={petEnergetic}
              alt="NovaSAT study companion"
              className="w-56 h-56 object-contain drop-shadow-2xl"
              loading="eager"
            />
            <div className="mt-4 text-center">
              <div className="text-xs uppercase tracking-[0.25em] text-secondary">
                Your study pet
              </div>
              <div className="font-display text-lg font-bold mt-1">
                Levels up when you do
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="text-[11px] uppercase tracking-[0.3em] text-secondary">
            What you get
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2">
            Everything you need to push your score
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-6">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="text-[11px] uppercase tracking-[0.3em] text-secondary">
            How it works
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2">
            Three steps to liftoff
          </h2>
        </div>
        <ol className="grid md:grid-cols-3 gap-5">
          {[
            {
              n: "01",
              t: "Set your target",
              b: "Tell us your goal score and test date. We map the path.",
            },
            {
              n: "02",
              t: "Train daily",
              b: "Adaptive drills, short or full sims, and AI-graded review.",
            },
            {
              n: "03",
              t: "Watch your score climb",
              b: "Projected score updates with every session. Beat your target.",
            },
          ].map((s) => (
            <li key={s.n} className="glass rounded-2xl p-6">
              <div className="text-gradient-nebula font-display text-3xl font-bold">
                {s.n}
              </div>
              <div className="font-display text-lg font-bold mt-2">{s.t}</div>
              <p className="text-sm text-muted-foreground mt-1.5">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold">
          Ready to <span className="text-gradient-nebula">launch</span>?
        </h2>
        <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
          Join students using NovaSAT to train smarter, not longer.
        </p>
        <Link
          to={ctaHref}
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="relative z-10 border-t border-border/50 mt-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} NovaSAT</span>
          <span>Built for students aiming higher.</span>
        </div>
      </footer>
    </div>
  );
}
