import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TutorialModal } from "./TutorialModal";
import { ReviewPromptModal } from "./ReviewPromptModal";

/**
 * Tracks logins via a server RPC (column-level UPDATEs on profiles are revoked
 * from the client). Shows the tutorial on first login and the review prompt
 * on the next login afterwards.
 */
export function OnboardingGate() {
  const { user } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (!user) return;
    const sessionKey = `nova_onboarding_checked::${user.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    (async () => {
      const { data, error } = await supabase.rpc("record_login_and_get_onboarding");
      if (error || !data || typeof data !== "object") return;
      const state = data as {
        ok?: boolean;
        login_count?: number;
        tutorial_completed?: boolean;
        review_prompt_dismissed?: boolean;
        has_review?: boolean;
      };
      if (!state.ok) return;

      // First login → tutorial
      if (!state.tutorial_completed) {
        setShowTutorial(true);
        return;
      }

      // Second login onwards → ask for a review on EVERY login until they
      // review or explicitly say "don't ask again".
      if (
        (state.login_count ?? 0) >= 2 &&
        !state.review_prompt_dismissed &&
        !state.has_review
      ) {
        setShowReview(true);
      }
    })();
  }, [user]);

  const closeTutorial = async () => {
    setShowTutorial(false);
    await supabase.rpc("mark_tutorial_completed");
  };

  // Only persist the dismissal when the user submitted a review or chose
  // "Don't ask again" — closing/ignoring keeps the prompt for next login.
  const closeReview = async (dismissed: boolean) => {
    setShowReview(false);
    if (dismissed) await supabase.rpc("mark_review_prompt_dismissed");
  };

  if (showTutorial) return <TutorialModal onClose={closeTutorial} />;
  if (showReview) return <ReviewPromptModal onClose={closeReview} />;
  return null;
}
