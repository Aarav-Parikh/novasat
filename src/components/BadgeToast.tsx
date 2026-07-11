import { toast } from "sonner";
import { BadgeDef } from "@/lib/badges";

export function showBadgeToast(badge: BadgeDef) {
  const Icon = badge.icon;
  toast.custom(
    () => (
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-success/50 bg-background/95 px-4 py-3 shadow-[0_0_40px_hsl(var(--success)/0.55)] backdrop-blur-lg">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-success/40 blur-md" />
          <div className="relative h-11 w-11 rounded-full bg-gradient-to-br from-success to-success/60 flex items-center justify-center ring-2 ring-success/70 ring-offset-2 ring-offset-background">
            <Icon className="h-5 w-5 text-background" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-success font-semibold">Badge Unlocked</div>
          <div className="font-display font-semibold text-base leading-tight">{badge.name}</div>
          <div className="text-xs text-muted-foreground truncate">{badge.detail}</div>
        </div>
      </div>
    ),
    { duration: 5000 },
  );
}
