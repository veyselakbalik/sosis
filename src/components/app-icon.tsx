"use client";

import { AppWindow } from "lucide-react";
import { useAppIcon } from "@/hooks/use-app-icon";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { cn } from "@/lib/utils";

interface Props {
  appId: string;
  size?: number;
  className?: string;
}

export function AppIcon({ appId, size = 48, className }: Props) {
  const accountId = useActiveAccountId();
  const url = useAppIcon(accountId, appId, size * 2);

  return (
    <div
      className={cn(
        "rounded-lg bg-[var(--muted)] flex items-center justify-center overflow-hidden shrink-0",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <AppWindow className="text-[var(--muted-foreground)]" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );
}
