import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Hardcoded fallbacks so the published build cannot end up without Supabase
// credentials (which would crash the app at startup and leave only the
// background visible). These are public/publishable values and safe to ship.
const SUPABASE_URL_FALLBACK = "https://qkqrewlwewnwgxfqfwjo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcXJld2x3ZXdud2d4ZnFmd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzAzOTYsImV4cCI6MjA5NDgwNjM5Nn0.AUbS2uc2YZq0O66exI5q70wHrg6V5KRr2EEvcoyy9Uo";
const SUPABASE_PROJECT_ID_FALLBACK = "qkqrewlwewnwgxfqfwjo";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK;
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY_FALLBACK;
  const supabaseProjectId =
    env.VITE_SUPABASE_PROJECT_ID || SUPABASE_PROJECT_ID_FALLBACK;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
  };
});
