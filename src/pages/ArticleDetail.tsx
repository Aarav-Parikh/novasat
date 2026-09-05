import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Lightbulb, TriangleAlert, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { articleBySlug } from "@/lib/articles";

function Problem({
  index,
  prompt,
  choices,
  correct,
  explanation,
}: {
  index: number;
  prompt: string;
  choices: string[];
  correct: number;
  explanation: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <p className="font-medium">
        {index + 1}. {prompt}
      </p>
      <div className="grid gap-2">
        {choices.map((c, i) => {
          const isCorrect = i === correct;
          const state = !answered
            ? "border-border hover:border-primary/60"
            : isCorrect
              ? "border-primary bg-primary/10"
              : i === picked
                ? "border-destructive bg-destructive/10"
                : "border-border opacity-60";
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${state}`}
            >
              <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
              <span>{c}</span>
              {answered && isCorrect && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
              {answered && !isCorrect && i === picked && (
                <XCircle className="ml-auto h-4 w-4 text-destructive" />
              )}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <span className="font-semibold">Why: </span>
          {explanation}
        </div>
      )}
    </div>
  );
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const article = slug ? articleBySlug(slug) : undefined;

  if (!article) {
    return (
      <AppLayout>
        <GlassCard className="text-center space-y-3">
          <p className="text-muted-foreground">That article doesn't exist.</p>
          <Link to="/articles" className="text-primary underline">
            Back to the Skill Library
          </Link>
        </GlassCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <Link
          to="/articles"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Skill Library
        </Link>

        <header data-page-section="Overview" className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-primary">
            {article.section} · {article.domain}
          </p>
          <h1 className="text-3xl font-bold">{article.title}</h1>
          <p className="text-muted-foreground">{article.summary}</p>
        </header>

        <GlassCard as="article" className="space-y-4">
          <h2 className="text-lg font-semibold">Overview</h2>
          {article.overview.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </GlassCard>

        <GlassCard data-page-section="Tips & Tricks" variant="purple" className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" /> Tips & Tricks
          </h2>
          <ul className="space-y-2">
            {article.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard data-page-section="Common Traps" className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-primary" /> Common Traps
          </h2>
          <ul className="space-y-2">
            {article.pitfalls.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard data-page-section="Practice" variant="cyan" className="space-y-4">
          <h2 className="text-lg font-semibold">Practice Problems</h2>
          {article.problems.map((p, i) => (
            <Problem key={i} index={i} {...p} />
          ))}
        </GlassCard>
      </div>
    </AppLayout>
  );
}
