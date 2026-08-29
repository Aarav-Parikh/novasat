import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

type Section = { id: string; label: string };

const slug = (s: string) =>
  "sec-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Per-page "jump to section" sidebar.
 * Any page can opt in by adding data-page-section="Label" to a wrapper element.
 */
export function PageNav() {
  const location = useLocation();
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const scan = () => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("[data-page-section]"),
      );
      const found: Section[] = nodes.map((el) => {
        const label = el.dataset.pageSection || "Section";
        if (!el.id) el.id = slug(label);
        return { id: el.id, label };
      });
      setSections((prev) =>
        prev.length === found.length && prev.every((p, i) => p.id === found[i].id)
          ? prev
          : found,
      );
    };
    scan();
    const t = window.setTimeout(scan, 400);
    const t2 = window.setTimeout(scan, 1200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <aside className="hidden lg:block w-52 xl:w-56 shrink-0">
      <div className="sticky top-8 pr-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 pl-3">
          On this page
        </div>
        <nav className="space-y-0.5 border-l border-border/60">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() =>
                  document
                    .getElementById(s.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={[
                  "block w-full text-left text-xs leading-snug py-2 pl-3 -ml-px border-l transition-colors",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                ].join(" ")}
              >
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
