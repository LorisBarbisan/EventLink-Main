import { AdminGuard } from "@/components/AdminGuard";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { loadRegistry } from "@/help/registry";
import type { HelpDetail, HelpEntry } from "@/help/types";

interface Metric {
  key: string;
  impressions: number;
  usersSeen: number;
  dismissals: number;
  completions: number;
  usedWithin7d: number;
}
interface Override {
  key: string;
  title?: string | null;
  body?: string | null;
  learn_more_href?: string | null;
  detail?: HelpDetail | null;
  version: number;
  updated_at?: string;
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function DetailText({ detail }: { detail?: HelpDetail | null }) {
  if (!detail) return null;
  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      {detail.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {!!detail.canDo?.length && <p>You can: {detail.canDo.join(" · ")}</p>}
      {!!detail.cannotDo?.length && <p>You can&apos;t: {detail.cannotDo.join(" · ")}</p>}
    </div>
  );
}

function ActiveOverrides({
  overrides,
  onEdit,
  onRevert,
}: {
  overrides: Override[];
  onEdit: (o: Override) => void;
  onRevert: (key: string) => void;
}) {
  const [registry, setRegistry] = useState<Map<string, HelpEntry> | null>(null);
  useEffect(() => {
    loadRegistry()
      .then(setRegistry)
      .catch(() => setRegistry(new Map()));
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Active overrides</h2>
        <p className="text-sm text-muted-foreground">
          These keys are showing database copy instead of the code registry. Fold the fix into the
          registry file and revert here, or the two will drift.
        </p>
      </div>
      {overrides.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is overridden.</p>
      ) : (
        overrides.map((o) => {
          const base = registry?.get(o.key);
          return (
            <Card key={o.key}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs">
                    {o.key}
                    {registry && !base && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">
                        not in registry
                      </Badge>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(o)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onRevert(o.key)}>
                      Revert to registry
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Registry
                    </p>
                    {base ? (
                      <>
                        {base.title && <p className="text-sm font-medium">{base.title}</p>}
                        <p className="text-sm">{base.body}</p>
                        <DetailText detail={base.detail} />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {registry ? "No registry entry." : "Loading…"}
                      </p>
                    )}
                  </div>
                  <div className="rounded-md border border-amber-300 p-3 dark:border-amber-700">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Override · v{o.version}
                      {o.updated_at
                        ? ` · ${new Date(o.updated_at).toLocaleDateString("en-GB")}`
                        : ""}
                    </p>
                    {o.title && <p className="text-sm font-medium">{o.title}</p>}
                    <p className="text-sm">{o.body ?? <em>(registry body)</em>}</p>
                    <DetailText detail={o.detail} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function HelpMetricsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ key: string; override?: Override } | null>(null);

  const { data, isLoading } = useQuery<{ metrics: Metric[]; overrides: Override[] }>({
    queryKey: ["/api/help/admin/metrics"],
    queryFn: () => apiRequest("/api/help/admin/metrics"),
  });

  const overridesByKey = useMemo(() => {
    const m = new Map<string, Override>();
    (data?.overrides ?? []).forEach((o) => m.set(o.key, o));
    return m;
  }, [data]);

  const rows = useMemo(() => {
    const keys = new Set<string>();
    (data?.metrics ?? []).forEach((m) => keys.add(m.key));
    (data?.overrides ?? []).forEach((o) => keys.add(o.key));
    const byKey = new Map((data?.metrics ?? []).map((m) => [m.key, m]));
    return Array.from(keys)
      .map((key) => ({
        key,
        m: byKey.get(key) ?? {
          key,
          impressions: 0,
          usersSeen: 0,
          dismissals: 0,
          completions: 0,
          usedWithin7d: 0,
        },
        hasOverride: overridesByKey.has(key),
      }))
      .sort((a, b) => b.m.impressions - a.m.impressions);
  }, [data, overridesByKey]);

  const save = useMutation({
    mutationFn: (o: Override) =>
      apiRequest(`/api/help/admin/content/${encodeURIComponent(o.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(o),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help/admin/metrics"] });
      setEditing(null);
      toast({ title: "Saved", description: "Override updated. Users pick it up next session." });
    },
    onError: () =>
      toast({ title: "Error", description: "Could not save.", variant: "destructive" }),
  });

  const revert = useMutation({
    mutationFn: (key: string) =>
      apiRequest(`/api/help/admin/content/${encodeURIComponent(key)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help/admin/metrics"] });
      setEditing(null);
      toast({ title: "Reverted", description: "Back to the code registry copy." });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Help content</h1>
        <p className="text-muted-foreground">
          Impressions, dismissals, and whether the feature was used within 7 days. High impressions
          with no downstream use means the copy is wrong; a high dismissal rate means it fires at
          the wrong moment.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Dismissals</TableHead>
                <TableHead className="text-right">Used ≤7d</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No help interactions recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ key, m, hasOverride }) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs">
                      {key}
                      {hasOverride && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          override
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{m.impressions}</TableCell>
                    <TableCell className="text-right">{m.usersSeen}</TableCell>
                    <TableCell className="text-right">{m.dismissals}</TableCell>
                    <TableCell className="text-right">{m.usedWithin7d}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ key, override: overridesByKey.get(key) })}
                      >
                        Edit copy
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ActiveOverrides
        overrides={data?.overrides ?? []}
        onEdit={(o) => setEditing({ key: o.key, override: o })}
        onRevert={(key) => revert.mutate(key)}
      />

      <OverrideDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(o) => save.mutate(o)}
        onRevert={(key) => revert.mutate(key)}
        saving={save.isPending}
      />
    </div>
  );
}

function OverrideDialog({
  editing,
  onClose,
  onSave,
  onRevert,
  saving,
}: {
  editing: { key: string; override?: Override } | null;
  onClose: () => void;
  onSave: (o: Override) => void;
  onRevert: (key: string) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [paragraphs, setParagraphs] = useState("");
  const [canDo, setCanDo] = useState("");
  const [cannotDo, setCannotDo] = useState("");

  // Re-seed the form whenever a different row is opened.
  const seedKey = editing?.key;
  useEffect(() => {
    const d = editing?.override?.detail;
    setTitle(editing?.override?.title ?? "");
    setBody(editing?.override?.body ?? "");
    setHref(editing?.override?.learn_more_href ?? "");
    setParagraphs((d?.paragraphs ?? []).join("\n"));
    setCanDo((d?.canDo ?? []).join("\n"));
    setCannotDo((d?.cannotDo ?? []).join("\n"));
  }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildDetail = (): HelpDetail | null => {
    const prev = editing?.override?.detail;
    const p = lines(paragraphs);
    const c = lines(canDo);
    const n = lines(cannotDo);
    if (!p.length && !c.length && !n.length) return null;
    return {
      paragraphs: p,
      ...(c.length ? { canDo: c } : {}),
      ...(n.length ? { cannotDo: n } : {}),
      ...(prev?.seeAlso ? { seeAlso: prev.seeAlso } : {}),
      ...(prev?.manualOrder != null ? { manualOrder: prev.manualOrder } : {}),
    };
  };

  if (!editing) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{editing.key}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Overrides the code registry for this key. Leave a field blank to fall back to the
            registry value. One sentence; say what it does for the user; British English.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ov-title">Title (optional)</Label>
            <Input id="ov-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ov-body">Body</Label>
            <Textarea
              id="ov-body"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ov-href">Learn more link (optional)</Label>
            <Input id="ov-href" value={href} onChange={(e) => setHref(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ov-paras">Manual paragraphs (one per line, optional)</Label>
            <Textarea
              id="ov-paras"
              rows={4}
              value={paragraphs}
              onChange={(e) => setParagraphs(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ov-can">You can (one per line)</Label>
              <Textarea
                id="ov-can"
                rows={3}
                value={canDo}
                onChange={(e) => setCanDo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-cannot">You can&apos;t (one per line)</Label>
              <Textarea
                id="ov-cannot"
                rows={3}
                value={cannotDo}
                onChange={(e) => setCannotDo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          {editing.override ? (
            <Button variant="ghost" onClick={() => onRevert(editing.key)}>
              Revert to registry
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={saving || !body.trim()}
              onClick={() =>
                onSave({
                  key: editing.key,
                  title: title.trim() || null,
                  body: body.trim() || null,
                  learn_more_href: href.trim() || null,
                  detail: buildDetail(),
                  version: (editing.override?.version ?? 0) + 1,
                })
              }
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminHelp() {
  return (
    <AdminGuard>
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <HelpMetricsContent />
        </div>
      </Layout>
    </AdminGuard>
  );
}
