"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Pause, Play, Rocket, ShieldCheck, Trash2 } from "lucide-react";
import { useVersions } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { ascFetch } from "@/lib/asc-client-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VersionStateBadge } from "@/components/version-badge";

interface ReviewDetail {
  id: string;
  type: string;
  attributes?: {
    contactFirstName?: string | null;
    contactLastName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    demoAccountRequired?: boolean;
    demoAccountName?: string | null;
    demoAccountPassword?: string | null;
    notes?: string | null;
  };
}

interface PhasedRelease {
  id: string;
  type: string;
  attributes?: {
    phasedReleaseState?: string;
    startDate?: string | null;
    totalPauseDuration?: number;
    currentDayNumber?: number;
  };
}

export default function ReleasePage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const { data: versions } = useVersions(accountId, appId);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const versionId = selectedVersionId ?? versions?.data[0]?.id ?? null;
  const active = versions?.data.find((v) => v.id === versionId);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-2 block">Version</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {versions?.data.slice(0, 10).map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  v.id === versionId ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
                }`}
              >
                <span className="font-mono">{v.attributes?.versionString}</span>
              </button>
            ))}
          </div>
          {active && <div className="mt-2"><VersionStateBadge state={active.attributes?.appStoreState} /></div>}
        </CardContent>
      </Card>

      {accountId && versionId && (
        <>
          <ReleaseReadiness accountId={accountId} versionId={versionId} />
          <ReviewDetailsEditor accountId={accountId} versionId={versionId} />
          <ReleaseControls accountId={accountId} appId={appId} versionId={versionId} state={active?.attributes?.appStoreState ?? ""} />
        </>
      )}
    </div>
  );
}

function ReleaseReadiness({ accountId, versionId }: { accountId: string; versionId: string }) {
  const { data, error } = useQuery({
    queryKey: ["asc", accountId, "version", versionId, "readiness"],
    queryFn: async () => {
      const [version, locs, reviewDetail] = await Promise.all([
        ascFetch<{ data: { id: string; relationships?: { build?: { data?: { id?: string } | null } } }; included?: Array<{ id: string; type: string; attributes?: { usesNonExemptEncryption?: boolean | null } }> }>(
          `v1/appStoreVersions/${versionId}?include=build`,
          { accountId },
        ),
        ascFetch<{ data: Array<{ id: string; attributes?: { locale?: string; description?: string | null; keywords?: string | null; supportUrl?: string | null } }> }>(
          `v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
          { accountId },
        ),
        ascFetch<{ data: ReviewDetail }>(`v1/appStoreVersions/${versionId}/appStoreReviewDetail`, { accountId }).catch(() => null),
      ]);
      const buildId = version.data.relationships?.build?.data?.id ?? null;
      const build = buildId ? version.included?.find((i) => i.type === "builds" && i.id === buildId) : null;
      const screenshotResults = await Promise.all(
        locs.data.map(async (loc) => {
          const sets = await ascFetch<{ data: Array<{ relationships?: { appScreenshots?: { data?: unknown[] } } }> }>(
            `v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50&include=appScreenshots`,
            { accountId },
          ).catch(() => ({ data: [] }));
          return {
            locale: loc.attributes?.locale ?? loc.id,
            screenshots: sets.data.reduce((sum, set) => sum + (set.relationships?.appScreenshots?.data ?? []).length, 0),
          };
        }),
      );
      const missingText = locs.data.filter((loc) => !loc.attributes?.description || !loc.attributes?.keywords || !loc.attributes?.supportUrl);
      return {
        buildAttached: !!buildId,
        complianceReady: !!build && build.attributes?.usesNonExemptEncryption != null,
        localizations: locs.data.length,
        missingText: missingText.map((l) => l.attributes?.locale ?? l.id),
        missingScreenshots: screenshotResults.filter((l) => l.screenshots === 0).map((l) => l.locale),
        reviewDetailsReady: !!reviewDetail?.data?.attributes?.contactFirstName
          && !!reviewDetail.data.attributes.contactLastName
          && !!reviewDetail.data.attributes.contactEmail
          && !!reviewDetail.data.attributes.contactPhone,
      };
    },
  });

  const checks = [
    { label: "Build attached", ok: data?.buildAttached },
    { label: "Encryption compliance answered", ok: data?.complianceReady },
    { label: "Review contact details ready", ok: data?.reviewDetailsReady },
    { label: "Metadata filled for all locales", ok: data ? data.missingText.length === 0 : undefined },
    { label: "Screenshots exist for all locales", ok: data ? data.missingScreenshots.length === 0 : undefined },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Release readiness</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-[var(--destructive)]">{(error as Error).message}</p>}
        <div className="grid md:grid-cols-2 gap-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              {check.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
              <span>{check.label}</span>
            </div>
          ))}
        </div>
        {data && (data.missingText.length > 0 || data.missingScreenshots.length > 0) && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Missing text: {data.missingText.join(", ") || "none"} · Missing screenshots: {data.missingScreenshots.join(", ") || "none"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewDetailsEditor({ accountId, versionId }: { accountId: string; versionId: string }) {
  const { data, error } = useQuery<{ data: ReviewDetail } | null>({
    queryKey: ["asc", accountId, "version", versionId, "reviewDetail"],
    queryFn: async () => {
      try {
        return await ascFetch<{ data: ReviewDetail }>(`v1/appStoreVersions/${versionId}/appStoreReviewDetail`, { accountId });
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
  });
  const detail = data?.data ?? null;

  return (
    <ReviewDetailsForm
      key={detail?.id ?? `new-${versionId}`}
      accountId={accountId}
      versionId={versionId}
      detail={detail}
      error={error as Error | null}
    />
  );
}

function ReviewDetailsForm({
  accountId,
  versionId,
  detail,
  error,
}: {
  accountId: string;
  versionId: string;
  detail: ReviewDetail | null;
  error: Error | null;
}) {
  const qc = useQueryClient();
  const attrs = detail?.attributes;
  const [form, setForm] = useState({
    contactFirstName: attrs?.contactFirstName ?? "",
    contactLastName: attrs?.contactLastName ?? "",
    contactPhone: attrs?.contactPhone ?? "",
    contactEmail: attrs?.contactEmail ?? "",
    demoAccountRequired: attrs?.demoAccountRequired ?? false,
    demoAccountName: attrs?.demoAccountName ?? "",
    demoAccountPassword: attrs?.demoAccountPassword ?? "",
    notes: attrs?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const attributes = {
        contactFirstName: form.contactFirstName || null,
        contactLastName: form.contactLastName || null,
        contactPhone: form.contactPhone || null,
        contactEmail: form.contactEmail || null,
        demoAccountRequired: form.demoAccountRequired,
        demoAccountName: form.demoAccountName || null,
        demoAccountPassword: form.demoAccountPassword || null,
        notes: form.notes || null,
      };
      if (detail?.id) {
        await ascFetch(`v1/appStoreReviewDetails/${detail.id}`, {
          accountId,
          method: "PATCH",
          body: { data: { id: detail.id, type: "appStoreReviewDetails", attributes } },
        });
      } else {
        await ascFetch("v1/appStoreReviewDetails", {
          accountId,
          method: "POST",
          body: {
            data: {
              type: "appStoreReviewDetails",
              attributes,
              relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } },
            },
          },
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId, "reviewDetail"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> App Review details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-[var(--destructive)]">{(error as Error).message}</p>}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="First name"><Input value={form.contactFirstName} onChange={(e) => setForm({ ...form, contactFirstName: e.target.value })} /></Field>
          <Field label="Last name"><Input value={form.contactLastName} onChange={(e) => setForm({ ...form, contactLastName: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.demoAccountRequired} onChange={(e) => setForm({ ...form, demoAccountRequired: e.target.checked })} />
          Demo account required
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Demo username"><Input value={form.demoAccountName} onChange={(e) => setForm({ ...form, demoAccountName: e.target.value })} /></Field>
          <Field label="Demo password"><Input value={form.demoAccountPassword} onChange={(e) => setForm({ ...form, demoAccountPassword: e.target.value })} /></Field>
        </div>
        <div className="space-y-1.5">
          <Label>Review notes</Label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          {save.isSuccess && <span className="text-xs text-green-600">Saved</span>}
          {save.isError && <span className="text-xs text-[var(--destructive)]">{(save.error as Error).message}</span>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save review details"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReleaseControls({ accountId, appId, versionId, state }: { accountId: string; appId: string; versionId: string; state: string }) {
  const qc = useQueryClient();
  const { data: phased } = useQuery<{ data: PhasedRelease } | null>({
    queryKey: ["asc", accountId, "version", versionId, "phasedRelease"],
    queryFn: async () => {
      try {
        return await ascFetch<{ data: PhasedRelease }>(`v1/appStoreVersions/${versionId}/appStoreVersionPhasedRelease`, { accountId });
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
  });
  const phasedId = phased?.data?.id;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId, "phasedRelease"] });
    qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "versions"] });
  };
  const releaseNow = useMutation({
    mutationFn: async () => {
      await ascFetch("v1/appStoreVersionReleaseRequests", {
        accountId,
        method: "POST",
        body: { data: { type: "appStoreVersionReleaseRequests", relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } } } },
      });
    },
    onSuccess: invalidate,
  });
  const createPhased = useMutation({
    mutationFn: async () => {
      await ascFetch("v1/appStoreVersionPhasedReleases", {
        accountId,
        method: "POST",
        body: { data: { type: "appStoreVersionPhasedReleases", relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } } } },
      });
    },
    onSuccess: invalidate,
  });
  const patchPhased = useMutation({
    mutationFn: async (phasedReleaseState: string) => {
      if (!phasedId) throw new Error("No phased release.");
      await ascFetch(`v1/appStoreVersionPhasedReleases/${phasedId}`, {
        accountId,
        method: "PATCH",
        body: { data: { id: phasedId, type: "appStoreVersionPhasedReleases", attributes: { phasedReleaseState } } },
      });
    },
    onSuccess: invalidate,
  });
  const deletePhased = useMutation({
    mutationFn: async () => {
      if (!phasedId) throw new Error("No phased release.");
      await ascFetch(`v1/appStoreVersionPhasedReleases/${phasedId}`, { accountId, method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  const anyError = releaseNow.error || createPhased.error || patchPhased.error || deletePhased.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4" /> Release controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <p className="font-medium">Manual release</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Use when Apple approved a MANUAL release and the version is pending developer release.</p>
            <Button className="mt-3" size="sm" onClick={() => releaseNow.mutate()} disabled={releaseNow.isPending || state !== "PENDING_DEVELOPER_RELEASE"}>
              <Rocket className="h-4 w-4" /> Release now
            </Button>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4">
            <p className="font-medium">Phased release</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Current: <span className="font-mono">{phased?.data?.attributes?.phasedReleaseState ?? "not configured"}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {!phasedId ? (
                <Button size="sm" onClick={() => createPhased.mutate()} disabled={createPhased.isPending}><CheckCircle2 className="h-4 w-4" /> Enable</Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => patchPhased.mutate("PAUSED")}><Pause className="h-4 w-4" /> Pause</Button>
                  <Button size="sm" variant="outline" onClick={() => patchPhased.mutate("ACTIVE")}><Play className="h-4 w-4" /> Resume</Button>
                  <Button size="sm" variant="outline" onClick={() => patchPhased.mutate("COMPLETE")}>Release all</Button>
                  <Button size="sm" variant="ghost" onClick={() => deletePhased.mutate()}><Trash2 className="h-4 w-4 text-[var(--destructive)]" /></Button>
                </>
              )}
            </div>
          </div>
        </div>
        {anyError && <p className="text-sm text-[var(--destructive)]">{(anyError as Error).message}</p>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
