import { useEffect, useMemo, useRef, useState } from "react";

export type SubjectKind = "ela" | "math";

export const ELA_TAGS = [
  "Out of Scope",
  "Too Extreme",
  "Factually Faulty",
  "Contradicts Passage",
  "Other",
] as const;

export const MATH_TAGS = [
  "Wrong Operation",
  "Sign / Arithmetic Error",
  "Misread the Problem",
  "Doesn't Satisfy Constraint",
  "Other",
] as const;

// Backwards-compat union
export type EliminationTag = typeof ELA_TAGS[number] | typeof MATH_TAGS[number];

interface Props {
  open: boolean;
  choiceLetter: string;
  subject?: SubjectKind;
  onCancel: () => void;
  onConfirm: (tag: string) => void;
}

export function ChoiceEliminator({ open, choiceLetter, subject = "ela", onCancel, onConfirm }: Props) {
  const tags = useMemo(() => (subject === "math" ? MATH_TAGS : ELA_TAGS), [subject]);
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setTag(null); setNote(""); }
  }, [open]);

  if (!open) return null;
  const canConfirm = tag && (tag !== "Other" || note.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="glass max-w-md w-full p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] uppercase tracking-widest text-secondary">Eliminate choice {choiceLetter} · {subject === "math" ? "Math" : "ELA"}</div>
        <h3 className="font-display text-lg font-semibold mt-1">What's wrong with this answer?</h3>
        <p className="text-xs text-muted-foreground mt-1">Diagnose the flaw — required to cross it out. The app won't tell you if you're right.</p>

        <div className="mt-4 grid gap-2">
          {tags.map((t) => {
            const active = tag === t;
            return (
              <button
                key={t}
                onClick={() => { setTag(t); if (t === "Other") setTimeout(() => noteRef.current?.focus(), 0); }}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${active ? "border-destructive/60 bg-destructive/10" : "border-border bg-muted/30 hover:border-destructive/40"}`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {tag === "Other" && (
          <input
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is it wrong?"
            maxLength={120}
            className="mt-3 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-destructive"
          />
        )}

        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border bg-muted/30 text-xs font-medium">Cancel</button>
          <button
            onClick={() => canConfirm && onConfirm(tag === "Other" ? `Other: ${note.trim()}` : tag!)}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-destructive to-secondary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          >
            Cross it out
          </button>
        </div>
      </div>
    </div>
  );
}
