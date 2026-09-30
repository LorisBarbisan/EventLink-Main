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
  version: number;
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

  // Re-seed the form whenever a different row is opened.
  const seedKey = editing?.key;
  useEffect(() => {
    setTitle(editing?.override?.title ?? "");
    setBody(editing?.override?.body ?? "");
    setHref(editing?.override?.learn_more_href ?? "");
  }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editing) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
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
