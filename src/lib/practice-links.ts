export type DayFocus = "Concept Fix" | "Time Management" | "Redemption" | "Maintenance";

export function cleanPracticeTopic(task: string) {
  return task
    .replace(/^Concept Lesson\s*[—-]\s*/i, "")
    .replace(/^Targeted set\s*[—-]\s*/i, "")
    .replace(/^Deep-dive\s*[—-]\s*/i, "")
    .replace(/^Diagnostic:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s*[—-]\s*\d+\s*questions?$/i, "")
    .trim();
}

export function taskCompletionKey(dayLabel: string, task: string) {
  return `${dayLabel}::${task}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function routeForTask(task: string, focus?: DayFocus, dayLabel?: string) {
  const topic = cleanPracticeTopic(task);
  const lower = `${task} ${focus ?? ""}`.toLowerCase();
  const mode = lower.includes("mistake bank") || lower.includes("mistake redrills") || lower.includes("review")
    ? "review"
    : lower.includes("reading") || lower.includes("grammar") || lower.includes("vocab") || lower.includes("passage") || lower.includes("inference")
      ? "reading"
      : lower.includes("redemption") || lower.includes("weak")
        ? "redemption"
        : lower.includes("math") || lower.includes("quadratic") || lower.includes("linear") || lower.includes("pacing") || lower.includes("functions")
          ? "math"
          : focus === "Time Management"
            ? "reading"
            : focus === "Redemption"
              ? "redemption"
              : "math";

  const params = new URLSearchParams({ topic });
  if (dayLabel) params.set("day", dayLabel);
  params.set("task", task);
  return `/test/${mode}?${params.toString()}`;
}