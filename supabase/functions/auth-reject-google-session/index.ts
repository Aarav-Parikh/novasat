import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!jwt || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = data.user;
    const email = (user.email ?? "").trim().toLowerCase();
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const ageMs = Date.now() - createdAt;
    const isGoogle = (user.app_metadata?.provider === "google")
      || (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes("google"))
      || (user.identities ?? []).some((i: any) => i.provider === "google");

    // A brand-new Google user means this was an unwanted signup via OAuth.
    // Delete them so we only allow login into pre-existing accounts.
    if (isGoogle && ageMs >= 0 && ageMs < 90_000) {
      await admin.auth.admin.deleteUser(user.id);
      return new Response(JSON.stringify({ rejected: true, email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ rejected: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-reject-google-session error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
