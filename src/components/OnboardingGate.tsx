import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TutorialModal } from "./TutorialModal";
import { ReviewPromptModal } from "./ReviewPromptModal";

const REVIEW_AFTER_LOGIN_COUNT = 2;

/**
 * Tracks logins and decides whether to show the first-time tutorial or a
 * review prompt. Runs once per session.
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
      // Fetch profile state
      const { data: profile } = await supabase
        .from("profiles")
        .select("login_count, tutorial_completed, review_prompt_dismissed")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) return;

      const newLoginCount = (profile.login_count ?? 0) + 1;

      // Bump login count + last login timestamp
      await supabase
        .from("profiles")
        .update({
          login_count: newLoginCount,
          last_login_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      // First time → show tutorial
      if (!profile.tutorial_completed) {
        setShowTutorial(true);
        return;
      }

      // From the 3rd login onward, prompt for a review until they submit/dismiss
      if (
        newLoginCount >= REVIEW_AFTER_LOGIN_COUNT &&
        !profile.review_prompt_dismissed
      ) {
        // Don't double-prompt if a review already exists
        const { data: existing } = await supabase
          .from("reviews")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!existing) setShowReview(true);
        else
          await supabase
            .from("profiles")
            .update({ review_prompt_dismissed: true })
            .eq("id", user.id);
      }
    })();
  }, [user]);

  const closeTutorial = async () => {
    setShowTutorial(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ tutorial_completed: true })
        .eq("id", user.id);
    }
  };

  if (showTutorial) return <TutorialModal onClose={closeTutorial} />;
  if (showReview) return <ReviewPromptModal onClose={() => setShowReview(false)} />;
  return null;
}
