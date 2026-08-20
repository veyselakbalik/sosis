import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(ts: number | string | Date | null | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "number" || typeof ts === "string" ? new Date(ts) : ts;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(ts: number | string | Date | null | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "number" || typeof ts === "string" ? new Date(ts) : ts;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
