// Strip LaTeX/markdown math artifacts (e.g. {frac}, \frac, $...$) from
// AI-generated SAT questions so they render as clean numbers/letters.
export function sanitizeMath(input: string | undefined | null): string {
  if (!input) return "";
  let s = String(input);

  // Normalise escaped newlines first
  s = s.replace(/\\n/g, "\n");

  // \frac{a}{b} or {frac}{a}{b}  →  (a)/(b)   (or a/b for simple tokens)
  const fracPattern = /(?:\\frac|\{frac\})\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
  s = s.replace(fracPattern, (_m, a, b) => {
    const aClean = a.trim();
    const bClean = b.trim();
    const simple = (x: string) => /^-?\w+$/.test(x);
    return simple(aClean) && simple(bClean) ? `${aClean}/${bClean}` : `(${aClean})/(${bClean})`;
  });

  // \sqrt{x} → √(x)
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, x) => `√(${x.trim()})`);
  // Plain text sqrt(x) → √(x), cbrt(x) → ∛(x)
  s = s.replace(/\bsqrt\s*\(([^()]*)\)/gi, (_m, x) => `√(${x.trim()})`);
  s = s.replace(/\bcbrt\s*\(([^()]*)\)/gi, (_m, x) => `∛(${x.trim()})`);
  // Common ASCII math operators
  s = s.replace(/\s\*\s/g, " × ");
  s = s.replace(/(\d)\s*\*\s*(\d)/g, "$1 × $2");
  s = s.replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠");
  s = s.replace(/\+\/-/g, "±");
  s = s.replace(/\bpi\b/g, "π").replace(/\btheta\b/g, "θ").replace(/\bdegrees?\b/g, "°").replace(/\binfinity\b/gi, "∞");
  // Common exponents to superscripts
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  s = s.replace(/\^(-?\d)/g, (_m, d) => {
    if (d.startsWith("-")) return `⁻${sup[d.slice(1)] ?? d}`;
    return sup[d] ?? `^${d}`;
  });

  // ^{n} → ^n   and  _{n} → _n  (keep readable)
  s = s.replace(/\^\{([^{}]+)\}/g, "^$1");
  s = s.replace(/_\{([^{}]+)\}/g, "_$1");

  // Common LaTeX operators / symbols
  const symbols: [RegExp, string][] = [
    [/\\times/g, "×"],
    [/\\cdot/g, "·"],
    [/\\div/g, "÷"],
    [/\\pm/g, "±"],
    [/\\leq|\\le\b/g, "≤"],
    [/\\geq|\\ge\b/g, "≥"],
    [/\\neq|\\ne\b/g, "≠"],
    [/\\approx/g, "≈"],
    [/\\pi\b/g, "π"],
    [/\\theta\b/g, "θ"],
    [/\\alpha\b/g, "α"],
    [/\\beta\b/g, "β"],
    [/\\degree/g, "°"],
    [/\\infty/g, "∞"],
    [/\\rightarrow|\\to\b/g, "→"],
    [/\\left|\\right/g, ""],
  ];
  for (const [re, rep] of symbols) s = s.replace(re, rep);

  // Strip $...$ math delimiters (single or double) without dropping the content.
  // Only when $ wraps math-like content (no whitespace right after $).
  s = s.replace(/\$\$([^$]+)\$\$/g, "$1");
  s = s.replace(/\$([^$\n]+?)\$/g, "$1");

  // Stray { } around plain tokens like {x} → x
  s = s.replace(/\{([^{}\n]{1,40})\}/g, (m, inner) => {
    // Don't touch JSON-ish or multi-word braces
    if (/[{};]/.test(inner)) return m;
    return inner;
  });

  // Collapse remaining backslash-letter commands we don't recognise: keep the word
  s = s.replace(/\\([a-zA-Z]+)\b/g, "$1");

  return s;
}
