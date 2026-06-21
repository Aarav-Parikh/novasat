import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const GOOGLE_PENDING_KEY = "novaprep_google_pending";
const GOOGLE_ERROR_KEY = "novaprep_google_error";

const withAuthTimeout = <T,>(promise: Promise<T>, message = "Sign-in took too long. Please try again.") =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), 15_000)),
  ]);

const Auth = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [targetScore, setTargetScore] = useState("1500");
  const [testDate, setTestDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const googleError = localStorage.getItem(GOOGLE_ERROR_KEY);
    if (googleError) {
      localStorage.removeItem(GOOGLE_ERROR_KEY);
      toast({ title: "Google sign-in failed", description: googleError, variant: "destructive" });
    }
    if (user) nav("/app", { replace: true });
  }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.removeItem(GOOGLE_PENDING_KEY);
    localStorage.removeItem(GOOGLE_ERROR_KEY);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await withAuthTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { display_name: displayName || email.split("@")[0] },
            },
          }),
        );
        if (error) throw error;
        // Update profile with target score / test date
        if (data.user) {
          await supabase
            .from("profiles")
            .update({
              display_name: displayName || email.split("@")[0],
              target_score: targetScore ? parseInt(targetScore) : null,
              test_date: testDate || null,
            })
            .eq("id", data.user.id);
        }
        toast({ title: "Welcome aboard, Cadet", description: "Your mission begins now." });
      } else {
        const { data, error } = await withAuthTimeout(
          supabase.auth.signInWithPassword({ email, password }),
        );
        if (error) throw error;
        if (data.session) nav("/app", { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Authentication failed",
        description: err.message ?? "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="starfield" />
      <div className="glass glass-purple p-8 max-w-md w-full relative z-10 animate-scale-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-purple">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-xl leading-none">NovaSAT</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
              {mode === "signup" ? "Create your mission" : "Resume your mission"}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Cadet Nova"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target score">
                  <input
                    type="number"
                    min={400}
                    max={1600}
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Test date">
                  <input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {busy ? "…" : mode === "signup" ? "Launch" : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const timeout = window.setTimeout(() => setBusy(false), 15_000);
            try {
              localStorage.setItem(GOOGLE_PENDING_KEY, "1");
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
                extraParams: { prompt: "select_account" },
              });
              if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
              window.clearTimeout(timeout);
              if (result.redirected) return;
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                nav("/app", { replace: true });
                return;
              }
              localStorage.removeItem(GOOGLE_PENDING_KEY);
              setBusy(false);
            } catch (err: any) {
              window.clearTimeout(timeout);
              localStorage.removeItem(GOOGLE_PENDING_KEY);
              toast({ title: "Google sign-in failed", description: err.message ?? "Try again", variant: "destructive" });
              setBusy(false);
            }
          }}
          className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-background/60 border border-border hover:bg-muted/40 text-sm font-medium disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6.01-2.74-6.01-6.2S8.69 5.8 12 5.8c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.83 3.2 14.65 2.2 12 2.2 6.94 2.2 2.85 6.29 2.85 11.4S6.94 20.6 12 20.6c6.93 0 9.15-4.86 9.15-7.36 0-.49-.05-.86-.13-1.24H12z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-5 text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already a Cadet?" : "New to NovaSAT?"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-secondary hover:text-secondary-glow"
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </div>

        <p className="mt-6 text-[10px] leading-relaxed text-muted-foreground/70 text-center">
          Independent practice platform; not affiliated with College Board.
        </p>
      </div>
    </div>
  );
};

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-background/60 border border-border focus:border-primary/60 focus:outline-none text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default Auth;
