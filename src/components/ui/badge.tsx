import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[var(--muted)] text-[var(--foreground)]",
        success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        outline: "border border-[var(--border)] text-[var(--foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
