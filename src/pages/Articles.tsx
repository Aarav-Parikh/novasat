import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, Sigma, Type } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { articleDomains, articlesBySection, ArticleSection } from "@/lib/articles";

const SECTIONS: { key: ArticleSection; label: string; icon: typeof Sigma }[] = [
  { key: "Math", label: "Math", icon: Sigma },
  { key: "Reading & Writing", label: "Reading & Writing", icon: Type },
];

export default function Articles() {
  const [section, setSection] = useState<ArticleSection>("Math");

  const domains = useMemo(() => articleDomains(section), [section]);
  const list = useMemo(() => articlesBySection(section), [section]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header data-page-section="Overview" className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Skill Library
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            One article for every tested SAT skill, each with an overview, tips and tricks,
            common traps, and practice problems.
          </p>
        </header>

        <div className="flex gap-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors border ${
                  active
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
                <span className="opacity-70">({articlesBySection(s.key).length})</span>
              </button>
            );
          })}
        </div>

        {domains.map((domain) => (
          <section key={domain} data-page-section={domain} className="space-y-3">
            <h2 className="text-xl font-semibold">{domain}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {list
                .filter((a) => a.domain === domain)
                .map((a) => (
                  <Link key={a.slug} to={`/articles/${a.slug}`} className="block">
                    <GlassCard className="h-full hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold leading-snug">{a.title}</h3>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="h-3 w-3" />
                          {a.readMinutes} min
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{a.summary}</p>
                      <p className="mt-3 text-xs text-primary">
                        {a.problems.length} practice problems
                      </p>
                    </GlassCard>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
