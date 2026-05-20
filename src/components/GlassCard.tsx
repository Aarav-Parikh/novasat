import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "purple" | "cyan";
  as?: "div" | "section" | "article";
}

export function GlassCard({
  children,
  className,
  variant = "default",
  as: Tag = "div",
}: GlassCardProps) {
  const variantClass =
    variant === "purple" ? "glass-purple" : variant === "cyan" ? "glass-cyan" : "";
  return (
    <Tag className={cn("glass", variantClass, "p-6", className)}>{children}</Tag>
  );
}
