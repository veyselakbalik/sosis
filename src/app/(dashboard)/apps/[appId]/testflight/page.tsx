"use client";

import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, AlertCircle, CheckCircle2, Hourglass, Pencil } from "lucide-react";
import { useBuilds } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ascFetch } from "@/lib/asc-client-fetch";
import type { Build, AscResource } from "@/lib/asc/types";
import { buildLabel, preReleaseVersionForBuild } from "@/lib/asc/build-label";
import { useT } from "@/components/i18n-provider";

export default function TestFlightPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const t = useT();
  const { data, isLoading, error } = useBuilds(accountId, appId);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 h-20 bg-[var(--muted)] animate-pulse" /></Card>
        ))}
      </div>
    );
  }
  if (error) return <Card><CardContent className="p-6 text-sm text-[var(--destructive)]">{(error as Error).message}</CardContent></Card>;
  if (!data || data.data.length === 0) {
    return <Card><CardContent className="p-10 text-center text-[var(--muted-foreground)]">{t.testflight.empty}</CardContent></Card>;
  }

  const locsByBuildId = new Map<string, string[]>();
  const locById = new Map<string, { locale: string; whatsNew: string | null }>();
  for (const inc of data.included ?? []) {
    if (inc.type === "betaBuildLocalizations") {
      const attrs = inc.attributes as { locale?: string; whatsNew?: string | null } | undefined;
      locById.set(inc.id, { locale: attrs?.locale ?? "?", whatsNew: attrs?.whatsNew ?? null });
    }
  }
  for (const build of data.data) {
    const rel = (build.relationships as { betaBuildLocalizations?: { data?: Array<{ id: string }> } })?.betaBuildLocalizations?.data;
    if (rel) locsByBuildId.set(build.id, rel.map((r) => r.id));
  }

  return (
    <div className="space-y-3">
      {data.data.map((b) => {
        const locIds = locsByBuildId.get(b.id) ?? [];
        const locs = locIds.map((id) => locById.get(id)).filter(Boolean) as Array<{ locale: string; whatsNew: string | null }>;
        const versionString = preReleaseVersionForBuild(b, data.included as Array<AscResource<Record<string, unknown>>> | undefined);
        return (
          <BuildRow
            key={b.id}
            build={b}
            versionString={versionString}
            locs={locs}
            locIds={locIds.map((id) => ({ id, locale: locById.get(id)?.locale ?? "?", whatsNew: locById.get(id)?.whatsNew ?? null }))}
            editing={editingId === b.id}
            onToggleEdit={() => setEditingId(editingId === b.id ? null : b.id)}
            accountId={accountId!}
            appId={appId}
          />
        );
      })}
    </div>
  );
}

function BuildRow({
  build,
  versionString,
  locIds,
  editing,
  onToggleEdit,
  accountId,
  appId,
}: {
  build: Build;
  versionString: string | null;
  locs: Array<{ locale: string; whatsNew: string | null }>;
  locIds: Array<{ id: string; locale: string; whatsNew: string | null }>;
  editing: boolean;
  onToggleEdit: () => void;
  accountId: string;
  appId: string;
}) {
  const qc = useQueryClient();
  const t = useT();
  const expired = build.attributes?.expired;
  const state = build.attributes?.processingState;

  const update = useMutation({
    mutationFn: async (args: { locId: string; whatsNew: string }) => {
      await ascFetch(`v1/betaBuildLocalizations/${args.locId}`, {
        accountId,
        method: "PATCH",
        body: {
          data: {
            id: args.locId,
            type: "betaBuildLocalizations",
            attributes: { whatsNew: args.whatsNew },
          },
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "builds"] }),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
              <Send className="h-5 w-5 text-[var(--muted-foreground)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium font-mono">{buildLabel(versionString, build.attributes?.version)}</p>
                {state === "VALID" && <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Valid</Badge>}
                {state === "PROCESSING" && <Badge variant="warning"><Hourglass className="h-3 w-3 mr-1 inline" />{t.attachBuild.processing}</Badge>}
                {state === "FAILED" && <Badge variant="destructive">Failed</Badge>}
                {state === "INVALID" && <Badge variant="destructive">Invalid</Badge>}
                {expired && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1 inline" />Expired</Badge>}
                {build.attributes?.usesNonExemptEncryption == null && (
                  <Badge variant="warning"><AlertCircle className="h-3 w-3 mr-1 inline" />Missing Compliance</Badge>
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {formatDateTime(build.attributes?.uploadedDate)}
                {build.attributes?.expirationDate && <> · {formatDateTime(build.attributes.expirationDate)}</>}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggleEdit}>
            <Pencil className="h-4 w-4" />
            {editing ? t.testflight.close : t.testflight.whatToTest}
          </Button>
        </div>

        {editing && (
          <div className="space-y-3 border-t border-[var(--border)] pt-3">
            {locIds.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">{t.testflight.noLocs}</p>
            )}
            {locIds.map((l) => (
              <WhatToTestEditor key={l.id} initial={l.whatsNew ?? ""} locale={l.locale} onSave={(text) => update.mutate({ locId: l.id, whatsNew: text })} saving={update.isPending} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WhatToTestEditor({ initial, locale, onSave, saving }: { initial: string; locale: string; onSave: (text: string) => void; saving: boolean }) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const dirty = value !== initial;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{locale}</p>
        {dirty && (
          <Button size="sm" variant="primary" onClick={() => onSave(value)} disabled={saving}>
            {saving ? t.common.loading : t.common.save}
          </Button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        maxLength={4000}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y"
        placeholder={t.testflight.testNotesPh}
      />
      <p className="text-xs text-[var(--muted-foreground)] text-right">{value.length} / 4000</p>
    </div>
  );
}
