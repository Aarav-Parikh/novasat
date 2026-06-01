import "./index.css";

const rootElement = document.getElementById("root");

const fallbackHtml = (title = "NovaSAT is loading", message = "If this takes more than a few seconds, reload the app.") => `
  <div class="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
    <div class="glass glass-purple p-8 max-w-md w-full text-center">
      <h1 class="font-display text-2xl font-bold mb-2">${title}</h1>
      <p class="text-sm text-muted-foreground mb-6">${message}</p>
      <button class="w-full rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-primary-foreground" onclick="window.location.reload()">
        Reload app
      </button>
    </div>
  </div>
`;

const showFallback = (title?: string, message?: string) => {
  if (rootElement) rootElement.innerHTML = fallbackHtml(title, message);
};

window.addEventListener("error", () => {
  showFallback("Something went wrong", "Reload to start NovaSAT again.");
});

window.addEventListener("unhandledrejection", () => {
  showFallback("Connection hiccup", "Reload to reconnect and continue.");
});

if (!rootElement) {
  document.body.innerHTML = fallbackHtml("NovaSAT could not start", "The page shell did not load correctly. Reload to try again.");
} else {
  showFallback();

  import("react-dom/client")
    .then(({ createRoot }) => import("./App.tsx").then(({ default: App }) => ({ createRoot, App })))
    .then(({ createRoot, App }) => {
      createRoot(rootElement).render(<App />);
    })
    .catch((error) => {
      console.error("NovaSAT boot failed:", error);
      showFallback("NovaSAT could not start", "A startup file failed to load. Reload to try again.");
    });
}
