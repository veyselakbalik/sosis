"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Users } from "lucide-react";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { useBuilds } from "@/hooks/use-asc";
import { ascFetch } from "@/lib/asc-client-fetch";
import { buildLabel, preReleaseVersionForBuild } from "@/lib/asc/build-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { AscListResponse, AscResource } from "@/lib/asc/types";

type BetaGroup = AscResource<{ name?: string; publicLinkEnabled?: boolean; publicLink?: string | null }, {
  builds?: { data?: Array<{ id: string }> };
  betaTesters?: { data?: Array<{ id: string }> };
}>;

export default function TestersPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const qc = useQueryClient();
  const [groupName, setGroupName] = useState("");
  const [testerEmail, setTesterEmail] = useState("");
  const [testerFirstName, setTesterFirstName] = useState("");
  const [testerLastName, setTesterLastName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedBuildId, setSelectedBuildId] = useState("");

  const { data: buildData } = useBuilds(accountId, appId);
  const { data, error } = useQuery<AscListResponse<BetaGroup>>({
    queryKey: ["asc", accountId, "app", appId, "betaGroups"],
    enabled: !!accountId,
    queryFn: () => ascFetch(`v1/apps/${appId}/betaGroups?include=builds,betaTesters&limit=50`, { accountId: accountId! }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "betaGroups"] });
  const createGroup = useMutation({
    mutationFn: async () => {
      await ascFetch("v1/betaGroups", {
        accountId: accountId!,
        method: "POST",
        body: {
          data: {
            type: "betaGroups",
            attributes: { name: groupName.trim(), publicLinkEnabled: false },
            relationships: { app: { data: { type: "apps", id: appId } } },
          },
        },
      });
    },
    onSuccess: () => { setGroupName(""); invalidate(); },
  });

  const addTester = useMutation({
    mutationFn: async (input: { groupId: string }) => {
      await ascFetch("v1/betaTesters", {
        accountId: accountId!,
        method: "POST",
        body: {
          data: {
            type: "betaTesters",
            attributes: {
              email: testerEmail.trim(),
              firstName: testerFirstName.trim() || undefined,
              lastName: testerLastName.trim() || undefined,
            },
            relationships: {
              betaGroups: { data: [{ type: "betaGroups", id: input.groupId }] },
            },
          },
        },
      });
    },
    onSuccess: () => { setTesterEmail(""); setTesterFirstName(""); setTesterLastName(""); invalidate(); },
  });

  const addBuild = useMutation({
    mutationFn: async (input: { groupId: string; buildId: string }) => {
      await ascFetch(`v1/betaGroups/${input.groupId}/relationships/builds`, {
        accountId: accountId!,
        method: "POST",
        body: { data: [{ type: "builds", id: input.buildId }] },
      });
    },
    onSuccess: invalidate,
  });

  const builds = buildData?.data.filter((b) => !b.attributes?.expired && b.attributes?.processingState === "VALID") ?? [];
  const included = buildData?.included as Array<AscResource<Record<string, unknown>>> | undefined;
  const firstGroup = data?.data[0]?.id ?? "";
  const effectiveGroupId = selectedGroupId || firstGroup;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> TestFlight groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-[var(--destructive)]">{(error as Error).message}</p>}
          <div className="grid md:grid-cols-2 gap-3">
            {(data?.data ?? []).map((g) => (
              <div key={g.id} className="rounded-lg border border-[var(--border)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{g.attributes?.name ?? g.id}</p>
                  {g.attributes?.publicLinkEnabled && <Badge variant="info">Public link</Badge>}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {(g.relationships?.builds?.data ?? []).length} builds · {(g.relationships?.betaTesters?.data ?? []).length} testers
                </p>
              </div>
            ))}
            {data?.data.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No beta groups yet.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Create group</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Group name"><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} /></Field>
            <Button size="sm" disabled={!groupName.trim() || createGroup.isPending} onClick={() => createGroup.mutate()}>
              <Plus className="h-4 w-4" /> Create
            </Button>
            {createGroup.isError && <p className="text-xs text-[var(--destructive)]">{(createGroup.error as Error).message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Invite tester</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <GroupSelect groups={data?.data ?? []} value={effectiveGroupId} onChange={setSelectedGroupId} />
            <Field label="Email"><Input value={testerEmail} onChange={(e) => setTesterEmail(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="First"><Input value={testerFirstName} onChange={(e) => setTesterFirstName(e.target.value)} /></Field>
              <Field label="Last"><Input value={testerLastName} onChange={(e) => setTesterLastName(e.target.value)} /></Field>
            </div>
            <Button size="sm" disabled={!effectiveGroupId || !testerEmail.trim() || addTester.isPending} onClick={() => { setSelectedGroupId(effectiveGroupId); addTester.mutate({ groupId: effectiveGroupId }); }}>
              <Send className="h-4 w-4" /> Invite
            </Button>
            {addTester.isError && <p className="text-xs text-[var(--destructive)]">{(addTester.error as Error).message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Add build to group</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <GroupSelect groups={data?.data ?? []} value={effectiveGroupId} onChange={setSelectedGroupId} />
            <div className="space-y-1.5">
              <Label>Build</Label>
              <select value={selectedBuildId} onChange={(e) => setSelectedBuildId(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
                <option value="">Choose build</option>
                {builds.map((b) => (
                  <option key={b.id} value={b.id}>{buildLabel(preReleaseVersionForBuild(b, included), b.attributes?.version)}</option>
                ))}
              </select>
            </div>
            <Button size="sm" disabled={!effectiveGroupId || !selectedBuildId || addBuild.isPending} onClick={() => { setSelectedGroupId(effectiveGroupId); addBuild.mutate({ groupId: effectiveGroupId, buildId: selectedBuildId }); }}>
              <Plus className="h-4 w-4" /> Add build
            </Button>
            {addBuild.isError && <p className="text-xs text-[var(--destructive)]">{(addBuild.error as Error).message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GroupSelect({ groups, value, onChange }: { groups: BetaGroup[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Group</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
        <option value="">Choose group</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.attributes?.name ?? g.id}</option>)}
      </select>
    </div>
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
