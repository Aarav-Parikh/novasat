import { useMemo } from "react";

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}

const GRADIENTS = [
  "from-primary to-secondary",
  "from-secondary to-primary-glow",
  "from-warning to-primary",
  "from-success to-secondary",
  "from-primary-glow to-warning",
  "from-secondary to-success",
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, url, size = 40, className = "" }: AvatarProps) {
  const initials = useMemo(() => {
    const n = (name ?? "").trim();
    if (!n) return "?";
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const gradient = GRADIENTS[hash(name ?? "cadet") % GRADIENTS.length];
  const style = { height: size, width: size };

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "avatar"}
        style={style}
        className={`rounded-full object-cover border border-border/60 shrink-0 ${className}`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-primary-foreground font-display font-semibold shrink-0 ${className}`}
    >
      <span style={{ fontSize: Math.max(10, size * 0.36) }}>{initials}</span>
    </div>
  );
}
