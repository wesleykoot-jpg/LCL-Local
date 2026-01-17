import { cn } from "@/lib/utils";

/**
 * StatBlock - A single statistic display block
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Displays a value and label in a clean, high-contrast format.
 * Reusable across Identity Cards, Friend Profiles, and other contexts.
 */

interface StatBlockProps {
  value: number | string;
  label: string;
  highlight?: boolean;
  className?: string;
}

export function StatBlock({ value, label, highlight = false, className }: StatBlockProps) {
  return (
    <div 
      className={cn("text-center", className)}
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <p 
        className={cn(
          "font-bold text-lg",
          highlight ? "text-brand-primary" : "text-text-primary"
        )}
      >
        {value}
      </p>
      <p className="text-text-secondary text-xs">
        {label}
      </p>
    </div>
  );
}
