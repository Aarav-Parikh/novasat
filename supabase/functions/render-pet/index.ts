// Renders the pet wearing equipped cosmetics using Gemini image edit.
// Caches results in the public `pet-renders` storage bucket so repeat
// requests for the same combination are served instantly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const BUCKET = "pet-renders";

const COSMETICS: Record<string, { slot: string; label: string; prompt: string }> = {
  // Hats
  grad_cap: { slot: "hat", label: "graduation cap", prompt: "a tiny black graduation mortarboard cap with a yellow tassel sitting on top of the puppy's head" },
  beanie: { slot: "hat", label: "beanie", prompt: "a snug knitted navy blue beanie pulled over the top of the puppy's head between the ears" },
  wizard_hat: { slot: "hat", label: "wizard hat", prompt: "a tall pointed purple wizard hat with golden stars and a curled tip on the puppy's head" },
  crown: { slot: "hat", label: "royal crown", prompt: "a small ornate golden royal crown with red velvet and jewels resting on the puppy's head" },
  cowboy_hat: { slot: "hat", label: "cowboy hat", prompt: "a brown leather cowboy hat with a curved brim on the puppy's head" },
  party_hat: { slot: "hat", label: "party hat", prompt: "a colorful striped cone-shaped birthday party hat with a pom-pom on top, strapped on the puppy's head" },
  top_hat: { slot: "hat", label: "top hat", prompt: "a classic tall black top hat with a satin band on the puppy's head" },
  // Neck
  scarf: { slot: "neck", label: "collegiate scarf", prompt: "a striped maroon and gold knitted collegiate scarf wrapped around the puppy's neck with the ends draping down" },
  bowtie: { slot: "neck", label: "bowtie", prompt: "a small red satin bowtie sitting at the front of the puppy's neck" },
  medal: { slot: "neck", label: "gold medal", prompt: "a shiny gold first-place medal hanging from a red, white and blue ribbon around the puppy's neck" },
  bandana: { slot: "neck", label: "bandana", prompt: "a red paisley bandana tied around the puppy's neck like a kerchief" },
  necktie: { slot: "neck", label: "necktie", prompt: "a striped navy and red business necktie hanging from the puppy's neck" },
  gold_chain: { slot: "neck", label: "gold chain", prompt: "a thick gold rope chain necklace draped around the puppy's neck" },
  // Outfit
  uniform: { slot: "outfit", label: "school uniform", prompt: "a tailored navy school blazer over a white shirt and red tie, fitted onto the puppy's body" },
  hoodie: { slot: "outfit", label: "campus hoodie", prompt: "a cozy grey campus hoodie with a drawstring fitted onto the puppy's body, hood resting behind" },
  labcoat: { slot: "outfit", label: "lab coat", prompt: "a clean white lab coat with a chest pocket fitted onto the puppy's body" },
  superhero_cape: { slot: "outfit", label: "superhero cape", prompt: "a flowing red superhero cape clasped at the puppy's neck and draped behind the body" },
  tuxedo: { slot: "outfit", label: "tuxedo", prompt: "a sharp black tuxedo jacket with white shirt and black bowtie fitted onto the puppy's body" },
  varsity_jacket: { slot: "outfit", label: "varsity jacket", prompt: "a classic wool varsity jacket, navy body with white leather sleeves and a chest letter, fitted onto the puppy's body" },
  pajamas: { slot: "outfit", label: "pajamas", prompt: "a cozy blue-and-white striped pajama onesie fitted onto the puppy's body" },
};

function cacheKey(mood: string, hat?: string | null, neck?: string | null, outfit?: string | null) {
  return `renders/${mood}__${hat || "none"}__${neck || "none"}__${outfit || "none"}.png`;
}

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function fetchBaseImage(mood: string): Promise<string> {
  const url = publicUrl(`base/${mood}.png`);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load base pet image");
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return `data:image/png;base64,${btoa(bin)}`;
}

async function callGeminiEdit(baseDataUrl: string, instructions: string): Promise<Uint8Array> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            { type: "image_url", image_url: { url: baseDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Gemini edit failed", res.status, body);
    throw new Error("image generation failed");
  }
  const json = await res.json();
  const parts = json?.choices?.[0]?.message?.images
    || json?.choices?.[0]?.message?.content
    || [];
  // Try a few response shapes
  let dataUrl: string | null = null;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      const url = p?.image_url?.url ?? p?.url ?? (typeof p === "string" ? p : null);
      if (typeof url === "string" && url.startsWith("data:image")) {
        dataUrl = url;
        break;
      }
    }
  }
  if (!dataUrl) {
    // Newer shape: message.images[0].url
    const imgs = json?.choices?.[0]?.message?.images;
    if (Array.isArray(imgs) && imgs[0]?.image_url?.url) dataUrl = imgs[0].image_url.url;
  }
  if (!dataUrl) throw new Error("no image in model response");
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mood, hat, neck, outfit } = await req.json();
    if (!["energetic", "tired", "asleep"].includes(mood)) {
      return new Response(JSON.stringify({ error: "invalid mood" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If nothing is equipped, just return the base image URL.
    if (!hat && !neck && !outfit) {
      return new Response(
        JSON.stringify({ url: publicUrl(`base/${mood}.png`), cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const key = cacheKey(mood, hat, neck, outfit);

    // Check cache
    const head = await fetch(publicUrl(key), { method: "HEAD" });
    if (head.ok) {
      return new Response(JSON.stringify({ url: publicUrl(key), cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the edit instruction
    const pieces = [hat, neck, outfit]
      .filter((id): id is string => !!id && !!COSMETICS[id])
      .map((id) => COSMETICS[id].prompt);
    if (pieces.length === 0) {
      return new Response(
        JSON.stringify({ url: publicUrl(`base/${mood}.png`), cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const instructions = [
      "Edit the attached cartoon puppy illustration so the puppy is actually wearing the following items, naturally fitted to its body — not floating overlays:",
      ...pieces.map((p) => `- ${p}`),
      "Keep the exact same puppy character, pose, proportions, art style, line weight, color palette and transparent/white background. Items should look like they belong on the puppy. Output a single PNG image at the same size and framing.",
    ].join("\n");

    const baseDataUrl = await fetchBaseImage(mood);
    const bytes = await callGeminiEdit(baseDataUrl, instructions);

    // Upload to bucket
    const { error: upErr } = await supa.storage.from(BUCKET).upload(key, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (upErr) {
      console.error("upload failed", upErr);
      throw new Error("could not cache render");
    }

    return new Response(JSON.stringify({ url: publicUrl(key), cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("render-pet error", e);
    return new Response(
      JSON.stringify({ error: "Could not render pet. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
