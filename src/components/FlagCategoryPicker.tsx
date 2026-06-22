import { useEffect, useRef, useState } from "react";

export type FlagCategory = "50/50 Guess" | "Completely Stuck" | "Ran out of time" | "Careless / Silly" | "Other";

export const FLAG_CATEGORIES: FlagCategory[] = [
  "50/50 Guess",
  "Completely Stuck",
  "Ran out of time",
  "Careless / Silly",
  "Other",
];

interface Props {
  open: boolean;
  initialCategory?: FlagCategory;
  initialNote?: string;
  onCancel: () => void;
  onConfirm: (category: FlagCategory, note?: string) => void;
}

export function FlagCategoryPicker({ open, initialCategory, initialNote, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<FlagCategory | null>(initialCategory ?? null);
  const [note, setNote] = useState(initialNote ?? "");
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelected(initialCategory ?? null);
      setNote(initialNote ?? "");
    }
  }, [open, initialCategory, initialNote]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancel(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 5 && document.activeElement !== noteRef.current) {
        e.preventDefault();
        const cat = FLAG_CATEGORIES[n - 1];
        setSelected(cat);
        if (cat === "Other") {
          setTimeout(() => noteRef.current?.focus(), 0);
        }
      }
      if (e.key === "Enter" && selected && (selected !== "Other" || note.trim())) {
        e.preventDefault();
        onConfirm(selected, selected === "Other" ? note.trim() : undefined);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selected, note, onCancel, onConfirm]);

  if (!open) return null;

  const canConfirm = selected && (selected !== "Other" || note.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="glass max-w-md w-full p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] uppercase tracking-widest text-secondary">Flag · pick a category</div>
        <h3 className="font-display text-lg font-semibold mt-1">Why are you flagging this?</h3>
        <p className="text-xs text-muted-foreground mt-1">Press 1–5 to pick. Logged for post-test analysis only.</p>

        <div className="mt-4 grid gap-2">
          {FLAG_CATEGORIES.map((cat, i) => {
            const active = selected === cat;
            return (
              <button
                key={cat}
                onClick={() => { setSelected(cat); if (cat === "Other") setTimeout(() => noteRef.current?.focus(), 0); }}
                className={`flex items-center justify-between text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${active ? "border-primary/60 bg-primary/10" : "border-border bg-muted/30 hover:border-secondary/50"}`}
              >
                <span><span className="font-mono text-xs text-muted-foreground mr-2">{i + 1}</span>{cat}</span>
                {active && <span className="text-[10px] uppercase tracking-widest text-secondary">selected</span>}
              </button>
            );
          })}
        </div>

        {selected === "Other" && (
          <input
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type your reason…"
            maxLength={120}
            className="mt-3 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}

        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border bg-muted/30 text-xs font-medium">Cancel</button>
          <button
            onClick={() => canConfirm && onConfirm(selected!, selected === "Other" ? note.trim() : undefined)}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          >
            Flag question
          </button>
        </div>
      </div>
    </div>
  );
}
