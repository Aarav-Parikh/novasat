import { Article, ArticleSection, PracticeProblem } from "./types";
import { algebraArticles } from "./math-algebra";
import { advancedMathArticles } from "./math-advanced";
import { dataArticles } from "./math-data";
import { geometryArticles } from "./math-geometry";
import { elaArticles } from "./ela";

export type { Article, ArticleSection, PracticeProblem };

export const articles: Article[] = [
  ...algebraArticles,
  ...advancedMathArticles,
  ...dataArticles,
  ...geometryArticles,
  ...elaArticles,
];

export const articlesBySection = (section: ArticleSection): Article[] =>
  articles.filter((a) => a.section === section);

export const articleBySlug = (slug: string): Article | undefined =>
  articles.find((a) => a.slug === slug);

export const articleDomains = (section: ArticleSection): string[] =>
  Array.from(new Set(articlesBySection(section).map((a) => a.domain)));
