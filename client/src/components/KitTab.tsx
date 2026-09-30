import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Package, Plus, Paperclip, Trash2, Pencil, Upload } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type KitCategory =
  | "audio"
  | "lighting"
  | "video"
  | "computing"
  | "networking"
  | "rigging"
  | "cable"
  | "case"
  | "vehicle"
  | "tools"
  | "other";

type KitStatus = "in_service" | "sold" | "disposed" | "lost" | "stolen";
type FundingMethod = "purchased" | "finance" | "gift" | "pre_existing";

interface KitItemFile {
  id: number;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  kind: string;
  created_at: string;
}

interface KitItem {
  id: number;
  name: string;
  category: KitCategory;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  quantity: number;
  purchase_date: string | null;
  purchase_price_pence: number | null;
  currency: string;
  supplier: string | null;
  funding_method: FundingMethod;
  business_use_percent: number;
  replacement_value_pence: number | null;
  condition_notes: string | null;
  status: KitStatus;
  disposal_date: string | null;
  disposal_proceeds_pence: number | null;
  disposal_notes: string | null;
  archived: boolean;
  files?: KitItemFile[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPence(pence: number | null | undefined, currency = "GBP"): string {
  if (pence == null) return "—";
  const sym =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${sym}${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

const CATEGORY_LABELS: Record<KitCategory, string> = {
  audio: "Audio",
  lighting: "Lighting",
  video: "Video",
  computing: "Computing",
  networking: "Networking",
  rigging: "Rigging",
  cable: "Cables",
  case: "Cases",
  vehicle: "Vehicle",
  tools: "Tools",
  other: "Other",
};

const STATUS_COLORS: Record<KitStatus, string> = {
  in_service: "bg-green-100 text-green-700",
  sold: "bg-blue-100 text-blue-700",
  disposed: "bg-gray-100 text-gray-600",
  lost: "bg-red-100 text-red-700",
  stolen: "bg-red-100 text-red-700",
};

// ── Form state ─────────────────────────────────────────────────────────────────

interface KitFormState {
  name: string;
  category: KitCategory;
  manufacturer: string;
  model: string;
  serial_number: string;
  quantity: string;
  purchase_date: string;
  purchase_price_pence: string;
  currency: string;
  supplier: string;
  funding_method: FundingMethod;
  business_use_percent: string;
  replacement_value_pence: string;
  condition_notes: string;
  status: KitStatus;
}

const emptyForm = (): KitFormState => ({
  name: "",
  category: "other",
  manufacturer: "",
  model: "",
  serial_number: "",
  quantity: "1",
  purchase_date: "",
  purchase_price_pence: "",
  currency: "GBP",
  supplier: "",
  funding_method: "purchased",
  business_use_percent: "100",
  replacement_value_pence: "",
  condition_notes: "",
  status: "in_service",
});

function formToPayload(f: KitFormState) {
  return {
    name: f.name,
    category: f.category,
    manufacturer: f.manufacturer || null,
    model: f.model || null,
    serial_number: f.serial_number || null,
    quantity: parseInt(f.quantity) || 1,
    purchase_date: f.purchase_date || null,
    purchase_price_pence: f.purchase_price_pence
      ? Math.round(parseFloat(f.purchase_price_pence) * 100)
      : null,
    currency: f.currency,
    supplier: f.supplier || null,
    funding_method: f.funding_method,
    business_use_percent: parseInt(f.business_use_percent) || 100,
    replacement_value_pence: f.replacement_value_pence
      ? Math.round(parseFloat(f.replacement_value_pence) * 100)
      : null,
    condition_notes: f.condition_notes || null,
    status: f.status,
  };
}

function itemToForm(item: KitItem): KitFormState {
  return {
    name: item.name,
    category: item.category,
    manufacturer: item.manufacturer ?? "",
    model: item.model ?? "",
    serial_number: item.serial_number ?? "",
    quantity: String(item.quantity),
    purchase_date: item.purchase_date?.slice(0, 10) ?? "",
    purchase_price_pence:
      item.purchase_price_pence != null ? String(item.purchase_price_pence / 100) : "",
    currency: item.currency,
    supplier: item.supplier ?? "",
    funding_method: item.funding_method,
    business_use_percent: String(item.business_use_percent),
    replacement_value_pence:
      item.replacement_value_pence != null ? String(item.replacement_value_pence / 100) : "",
    condition_notes: item.condition_notes ?? "",
    status: item.status,
  };
}

// ── Item form dialog ───────────────────────────────────────────────────────────

function KitItemDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: KitItem;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<KitFormState>(existing ? itemToForm(existing) : emptyForm());

  const set = (key: keyof KitFormState) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form);
      if (existing) {
        return apiRequest(`/api/kit/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json());
      }
      return apiRequest("/api/kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kit"] });
      toast({ title: existing ? "Item updated" : "Item added" });
      onClose();
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit kit item" : "Add kit item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="e.g. Shure SM58"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as KitCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={set("status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_service">In service</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="stolen">Stolen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Manufacturer</Label>
              <Input
                value={form.manufacturer}
                onChange={(e) => set("manufacturer")(e.target.value)}
                placeholder="Shure"
              />
            </div>
            <div>
              <Label>Model</Label>
              <Input
                value={form.model}
                onChange={(e) => set("model")(e.target.value)}
                placeholder="SM58"
              />
            </div>
            <div>
              <Label>Serial number</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => set("serial_number")(e.target.value)}
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => set("quantity")(e.target.value)}
              />
            </div>
            <div>
              <Label>Purchase date</Label>
              <Input
                type="date"
                value={form.purchase_date}
                onChange={(e) => set("purchase_date")(e.target.value)}
              />
            </div>
            <div>
              <Label>Purchase price (£)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.purchase_price_pence}
                onChange={(e) => set("purchase_price_pence")(e.target.value)}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={set("currency")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Supplier</Label>
              <Input
                value={form.supplier}
                onChange={(e) => set("supplier")(e.target.value)}
                placeholder="Thomann"
              />
            </div>
            <div>
              <Label>Funding method</Label>
              <Select value={form.funding_method} onValueChange={set("funding_method")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchased">Purchased</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="gift">Gift</SelectItem>
                  <SelectItem value="pre_existing">Pre-existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business use %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.business_use_percent}
                onChange={(e) => set("business_use_percent")(e.target.value)}
              />
            </div>
            <div>
              <Label>Replacement value (£)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.replacement_value_pence}
                onChange={(e) => set("replacement_value_pence")(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Condition notes</Label>
              <Input
                value={form.condition_notes}
                onChange={(e) => set("condition_notes")(e.target.value)}
                placeholder="Minor scuffs on body"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── File upload row ────────────────────────────────────────────────────────────

function KitFileRow({ itemId, file }: { itemId: number; file: KitItemFile }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/kit/${itemId}/files/${file.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kit", itemId] });
      toast({ title: "File deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return (
    <div className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{file.file_name}</span>
        <Badge variant="outline" className="shrink-0 text-xs capitalize">
          {file.kind}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── Item detail panel ──────────────────────────────────────────────────────────

function KitItemDetail({ item, onEdit }: { item: KitItem; onEdit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: fullItem } = useQuery<KitItem & { files: KitItemFile[] }>({
    queryKey: ["/api/kit", item.id],
    queryFn: () => apiRequest(`/api/kit/${item.id}`).then((r) => r.json()),
  });

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      const reader = new FileReader();
      const fileData: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      return apiRequest(`/api/kit/${item.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData,
          filename: f.name,
          contentType: f.type || "application/octet-stream",
          kind: "receipt",
        }),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kit", item.id] });
      toast({ title: "File uploaded" });
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/kit/${item.id}/archive`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kit"] });
      toast({ title: "Item archived" });
    },
    onError: () => toast({ title: "Archive failed", variant: "destructive" }),
  });

  const files = fullItem?.files ?? [];

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="text-muted-foreground">Category</div>
        <div>{CATEGORY_LABELS[item.category]}</div>
        {item.manufacturer && (
          <>
            <div className="text-muted-foreground">Manufacturer</div>
            <div>
              {item.manufacturer}
              {item.model ? ` ${item.model}` : ""}
            </div>
          </>
        )}
        {item.serial_number && (
          <>
            <div className="text-muted-foreground">Serial</div>
            <div className="font-mono">{item.serial_number}</div>
          </>
        )}
        {item.quantity > 1 && (
          <>
            <div className="text-muted-foreground">Quantity</div>
            <div>{item.quantity}</div>
          </>
        )}
        {item.purchase_price_pence != null && (
          <>
            <div className="text-muted-foreground">Purchase price</div>
            <div>{formatPence(item.purchase_price_pence, item.currency)}</div>
          </>
        )}
        {item.purchase_date && (
          <>
            <div className="text-muted-foreground">Purchased</div>
            <div>{fmtDate(item.purchase_date)}</div>
          </>
        )}
        {item.supplier && (
          <>
            <div className="text-muted-foreground">Supplier</div>
            <div>{item.supplier}</div>
          </>
        )}
        <div className="text-muted-foreground">Funding</div>
        <div className="capitalize">{item.funding_method.replace("_", " ")}</div>
        <div className="text-muted-foreground">Business use</div>
        <div>{item.business_use_percent}%</div>
        {item.replacement_value_pence != null && (
          <>
            <div className="text-muted-foreground">Replacement value</div>
            <div>{formatPence(item.replacement_value_pence, item.currency)}</div>
          </>
        )}
        {item.condition_notes && (
          <>
            <div className="text-muted-foreground">Condition</div>
            <div>{item.condition_notes}</div>
          </>
        )}
      </div>

      {/* Files */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Files
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <Upload className="h-3 w-3" />
            {uploadMutation.isPending ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadMutation.mutate(f);
              e.target.value = "";
            }}
          />
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files attached.</p>
        ) : (
          <div className="space-y-1">
            {files.map((f) => (
              <KitFileRow key={f.id} itemId={item.id} file={f} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => archiveMutation.mutate()}
          disabled={archiveMutation.isPending}
        >
          Archive
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function KitTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<KitItem | undefined>(undefined);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [includeDisposed, setIncludeDisposed] = useState(false);

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery<KitItem[]>({
    queryKey: ["/api/kit", includeDisposed],
    queryFn: () =>
      apiRequest(`/api/kit${includeDisposed ? "?includeDisposed=true" : ""}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border p-4">
            <div className="mb-2 h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Could not load kit register.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const byCategory: Partial<Record<KitCategory, KitItem[]>> = {};
  for (const item of items) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category]!.push(item);
  }
  const categories = Object.keys(byCategory) as KitCategory[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Kit register</h3>
          {items.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeDisposed}
              onChange={(e) => setIncludeDisposed(e.target.checked)}
              className="h-3 w-3"
            />
            Show disposed
          </label>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Add item
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 font-medium text-muted-foreground">No kit items yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Track your equipment for insurance and tax purposes.
            </p>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grouped list */}
      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium">{CATEGORY_LABELS[cat]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byCategory[cat]!.map((item) => (
              <div key={item.id} className="rounded-md border">
                <button
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    {item.manufacturer && (
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        {item.manufacturer}
                        {item.model ? ` ${item.model}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    {item.purchase_price_pence != null && (
                      <span className="text-sm tabular-nums">
                        {formatPence(item.purchase_price_pence, item.currency)}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className={`text-xs capitalize ${STATUS_COLORS[item.status]}`}
                    >
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>
                </button>

                {expanded === item.id && (
                  <div className="border-t px-3 pb-3 pt-2">
                    <KitItemDetail
                      item={item}
                      onEdit={() => {
                        setEditing(item);
                        setExpanded(null);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Add / edit dialog */}
      {(showAdd || editing) && (
        <KitItemDialog
          open
          onClose={() => {
            setShowAdd(false);
            setEditing(undefined);
          }}
          existing={editing}
        />
      )}
    </div>
  );
}
