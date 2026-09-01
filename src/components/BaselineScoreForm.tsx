import { useState } from "react";
import { Plus } from "lucide-react";
import {
  BaselineScore,
  BaselineTestType,
  BLUEBOOK_TESTS,
  TEST_TYPE_LABEL,
  bluebookByLabel,
  scoreRange,
} from "@/lib/baseline-scores";

type NewScore = Omit<BaselineScore, "id">;

const today = () => new Date().toISOString().slice(0, 10);

const inputClass =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary";

export function BaselineScoreForm({
  onAdd,
  compact = false,
}: {
  onAdd: (entry: NewScore) => Promise<boolean>;
  compact?: boolean;
}) {
  const [type, setType] = useState<BaselineTestType>("Bluebook");
  const [label, setLabel] = useState(BLUEBOOK_TESTS[0].label);
  const [rw, setRw] = useState("");
  const [math, setMath] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = scoreRange(type);
  const note = type === "Bluebook" ? bluebookByLabel(label)?.note : null;

  const changeType = (t: BaselineTestType) => {
    setType(t);
    setLabel(t === "Bluebook" ? BLUEBOOK_TESTS[0].label : TEST_TYPE_LABEL[t]);
  };

  const submit = async () => {
    const r = Number(rw);
    const m = Number(math);
    if (!Number.isFinite(r) || !Number.isFinite(m)) {
      setError("Enter both section scores.");
      return;
    }
    if (r < range.min || r > range.max || m < range.min || m > range.max) {
      setError(`Section scores must be between ${range.min} and ${range.max}.`);
      return;
    }
    if (r % 10 !== 0 || m % 10 !== 0) {
      setError("Section scores are always reported in multiples of 10.");
      return;
    }
    setError(null);
    setSaving(true);
    const ok = await onAdd({
      test_type: type,
      test_label: type === "Bluebook" ? label : TEST_TYPE_LABEL[type],
      rw_score: r,
      math_score: m,
      taken_on: date,
    });
    setSaving(false);
    if (ok) {
      setRw("");
      setMath("");
    } else {
      setError("Couldn't save that score. Try again.");
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-3 rounded-xl border border-border/60 p-4"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Test type
          <select
            value={type}
            onChange={(e) => changeType(e.target.value as BaselineTestType)}
            className={`${inputClass} mt-1`}
          >
            {(Object.keys(TEST_TYPE_LABEL) as BaselineTestType[]).map((t) => (
              <option key={t} value={t}>
                {TEST_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>

        {type === "Bluebook" ? (
          <label className="text-xs text-muted-foreground">
            Which practice test
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              {BLUEBOOK_TESTS.map((t) => (
                <option key={t.id} value={t.label}>
                  {t.label}
                  {t.adjustment !== 0
                    ? ` (${t.adjustment > 0 ? "+" : ""}${t.adjustment} difficulty)`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-xs text-muted-foreground">
            Date taken
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Reading &amp; Writing
          <input
            inputMode="numeric"
            placeholder={`${range.min}–${range.max}`}
            value={rw}
            onChange={(e) => setRw(e.target.value.replace(/[^0-9]/g, ""))}
            className={`${inputClass} mt-1 font-mono`}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Math
          <input
            inputMode="numeric"
            placeholder={`${range.min}–${range.max}`}
            value={math}
            onChange={(e) => setMath(e.target.value.replace(/[^0-9]/g, ""))}
            className={`${inputClass} mt-1 font-mono`}
          />
        </label>
        {type === "Bluebook" ? (
          <label className="text-xs text-muted-foreground">
            Date taken
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        ) : (
          <div className="flex items-end text-xs text-muted-foreground">
            Total:{" "}
            <span className="ml-1 font-mono text-foreground">
              {Number(rw || 0) + Number(math || 0)}
            </span>
          </div>
        )}
      </div>

      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      {type === "PSAT" && (
        <p className="text-[11px] text-muted-foreground">
          PSAT sections top out at 760 — we stretch them onto the SAT scale automatically.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {saving ? "Saving…" : "Add score"}
      </button>
    </div>
  );
}
