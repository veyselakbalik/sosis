"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileKey, FileWarning, FileCheck } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

interface Props {
  onLoaded: (content: string, fileName: string) => void;
  fileName?: string | null;
}

export function DropzoneP8({ onLoaded, fileName }: Props) {
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      setError(null);
      const file = accepted[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".p8") && file.type !== "application/x-pkcs8") {
        if (!/-----BEGIN PRIVATE KEY-----/.test(await file.text())) {
          setError(t.accounts.requireP8);
          return;
        }
      }
      const text = await file.text();
      if (!text.includes("-----BEGIN PRIVATE KEY-----")) {
        setError(t.accounts.p8Invalid);
        return;
      }
      onLoaded(text, file.name);
    },
    [onLoaded, t],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "application/x-pkcs8": [".p8"], "text/plain": [".p8"] },
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)]",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {fileName ? (
            <>
              <FileCheck className="h-8 w-8 text-green-600" />
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{t.accounts.p8Reupload}</p>
            </>
          ) : (
            <>
              <FileKey className="h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="text-sm font-medium">{t.accounts.p8DropHere}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                App Store Connect → Users and Access → Integrations → API Keys
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-[var(--destructive)] flex items-center gap-1">
          <FileWarning className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
