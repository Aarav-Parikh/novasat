export type ArticleSection = "Math" | "Reading & Writing";

export interface PracticeProblem {
  prompt: string;
  choices: string[];
  correct: number;
  explanation: string;
}

export interface Article {
  slug: string;
  section: ArticleSection;
  domain: string;
  title: string;
  skill: string;
  readMinutes: number;
  summary: string;
  overview: string[];
  tips: string[];
  pitfalls: string[];
  problems: PracticeProblem[];
}
