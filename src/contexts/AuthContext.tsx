import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const GOOGLE_PENDING_KEY = "novaprep_google_pending";
const GOOGLE_ERROR_KEY = "novaprep_google_error";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const withAuthTimeout = <T,>(promise: Promise<T>, ms = 8_000) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Auth check timed out")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const commitSession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      localStorage.removeItem(GOOGLE_PENDING_KEY);
      commitSession(s);
    });


    const hydrateSession = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token") ?? query.get("access_token");
      const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");

      if (accessToken && refreshToken) {
        try {
          const { data, error } = await withAuthTimeout(supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }));
          if (!error) {
            window.history.replaceState({}, document.title, window.location.pathname || "/");
            commitSession(data.session);

            return;
          }
        } catch {
          window.history.replaceState({}, document.title, window.location.pathname || "/");
        }
      }

      for (const delay of [0, 350, 900, 1_800]) {
        if (delay) await wait(delay);
        try {
          const { data } = await withAuthTimeout(supabase.auth.getSession());
          if (data.session || !localStorage.getItem(GOOGLE_PENDING_KEY)) {
            commitSession(data.session);
            return;
          }
        } catch {
          if (!localStorage.getItem(GOOGLE_PENDING_KEY)) break;
        }
      }

      commitSession(null);
    };

    hydrateSession();
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
