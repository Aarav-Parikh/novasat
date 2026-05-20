import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { coachArticles } from "./CoachArticle";

const Articles = () => {
  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Library</span>
        <h1 className="font-display text-4xl font-bold mt-1">Articles</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Hand-written, fact-checked deep dives on SAT strategy, pacing, grammar patterns, and
          test-day decision-making. Each article focuses on a different topic — no repeats.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {coachArticles.map((article) => (
          <Link key={article.slug} to={`/coach/${article.slug}`} className="block">
            <GlassCard className="group cursor-pointer hover:scale-[1.01] transition-transform h-full">
              <div className="flex items-center gap-2 text-secondary text-xs">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="font-mono">{article.duration}</span>
              </div>
              <h3 className="font-display text-lg font-semibold mt-3">{article.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{article.summary}</p>
              <div className="mt-4 flex items-center gap-1 text-sm text-secondary group-hover:text-secondary-glow">
                Read article <ChevronRight className="h-4 w-4" />
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
};

export default Articles;
