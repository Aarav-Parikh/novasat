import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLElement> {
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
  ...rest
}: GlassCardProps) {
  const variantClass =
    variant === "purple" ? "glass-purple" : variant === "cyan" ? "glass-cyan" : "";
  return (
    <Tag {...rest} className={cn("glass", variantClass, "p-6", className)}>
      {children}
    </Tag>
  );
}

