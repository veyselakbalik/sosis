"use client";

import { use, useState } from "react";
import { Smartphone, Monitor, Tv, Glasses, Plus, Package, Rocket } from "lucide-react";
import { useVersions } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VersionStateBadge } from "@/components/version-badge";
import { NewVersionModal, suggestNextVersion } from "@/components/new-version-modal";
import { AttachBuildModal } from "@/components/attach-build-modal";
import { SubmitReviewModal } from "@/components/submit-review-modal";
import { useT } from "@/components/i18n-provider";
import { formatDate } from "@/lib/utils";
import type { Build } from "@/lib/asc/types";

const PlatformIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  IOS: Smartphone,
  MAC_OS: Monitor,
  TV_OS: Tv,
  VISION_OS: Glasses,
};

const SUBMITTABLE_STATES = new Set([
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
]);

export default function VersionsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const t = useT();
  const { data, isLoading, error } = useVersions(accountId, appId);
  const [newOpen, setNewOpen] = useState(false);
  const [attachFor, setAttachFor] = useState<{ versionId: string; currentBuildId: string | null } | null>(null);
  const [submitFor, setSubmitFor] = useState<{ versionId: string; versionString: string; platform: string } | null>(null);

  const latest = data?.data?.[0];
  const defaultPlatform = latest?.attributes?.platform || "IOS";
  const suggested = suggestNextVersion(latest?.attributes?.versionString);

  const header = (
    <div className="flex items-center justify-end -mt-2 mb-2">
      {accountId && (
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> {t.versions.newVersion}
        </Button>
      )}
    </div>
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 h-20 bg-[var(--muted)] animate-pulse" /></Card>
        ))}
      </div>
    );
  } else if (error) {
    content = <Card><CardContent className="p-6 text-sm text-[var(--destructive)]">{(error as Error).message}</CardContent></Card>;
  } else if (!data || data.data.length === 0) {
    content = <Card><CardContent className="p-10 text-center text-[var(--muted-foreground)]">{t.versions.empty}</CardContent></Card>;
  } else {
    const buildsById = new Map<string, Build>();
    for (const inc of data.included ?? []) {
      if (inc.type === "builds") buildsById.set(inc.id, inc as unknown as Build);
    }

    content = (
      <div className="space-y-2">
        {data.data.map((v) => {
          const platform = v.attributes?.platform || "IOS";
          const Icon = PlatformIcon[platform] ?? Smartphone;
          const buildRel = (v.relationships as { build?: { data?: { id?: string } } })?.build?.data?.id ?? null;
          const build = buildRel ? buildsById.get(buildRel) : null;
          const state = v.attributes?.appStoreState ?? "";
          const canEdit = SUBMITTABLE_STATES.has(state);
          const canSubmit = canEdit && !!buildRel;
          return (
            <Card key={v.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-[var(--muted-foreground)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium font-mono">
                          {v.attributes?.versionString}
                          {build?.attributes?.version && (
                            <span className="text-[var(--muted-foreground)]"> ({build.attributes.version})</span>
                          )}
                        </p>
                        <VersionStateBadge state={v.attributes?.appStoreState} />
                        {build && build.attributes?.usesNonExemptEncryption == null && (
                          <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            {t.versions.missingCompliance}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {platform} · {formatDate(v.attributes?.createdDate)}
                        {!build && canEdit && <> · <span className="text-amber-600">{t.versions.buildMissing}</span></>}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttachFor({ versionId: v.id, currentBuildId: buildRel })}
                      >
                        <Package className="h-4 w-4" />
                        {build ? t.versions.changeBuild : t.versions.addBuild}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!canSubmit}
                        onClick={() => setSubmitFor({ versionId: v.id, versionString: v.attributes?.versionString ?? "", platform })}
                        title={!canSubmit ? t.versions.suggestBuildFirst : t.versions.submitReview}
                      >
                        <Rocket className="h-4 w-4" />
                        {t.versions.submitReview}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {header}
      {content}
      {accountId && (
        <>
          <NewVersionModal
            open={newOpen}
            onClose={() => setNewOpen(false)}
            accountId={accountId}
            appId={appId}
            defaultPlatform={defaultPlatform}
            suggestedVersion={suggested}
          />
          {attachFor && (
            <AttachBuildModal
              open={!!attachFor}
              onClose={() => setAttachFor(null)}
              accountId={accountId}
              appId={appId}
              versionId={attachFor.versionId}
              currentBuildId={attachFor.currentBuildId}
            />
          )}
          {submitFor && (
            <SubmitReviewModal
              open={!!submitFor}
              onClose={() => setSubmitFor(null)}
              accountId={accountId}
              appId={appId}
              versionId={submitFor.versionId}
              versionString={submitFor.versionString}
              platform={submitFor.platform}
            />
          )}
        </>
      )}
    </>
  );
}
