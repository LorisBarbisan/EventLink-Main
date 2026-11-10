import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Archive, Building2, Pencil, Plus } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: number;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  accounts_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  payment_terms_days: number | null;
  requires_po: boolean;
  vat_number: string | null;
  notes: string | null;
  archived: boolean;
  invoice_count: number;
  last_invoiced: string | null;
}

type ClientForm = {
  name: string;
  contact_name: string;
  contact_email: string;
  accounts_email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  country: string;
  payment_terms_days: string;
  requires_po: boolean;
  vat_number: string;
  notes: string;
};

const EMPTY_FORM: ClientForm = {
  name: "",
  contact_name: "",
  contact_email: "",
  accounts_email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  country: "",
  payment_terms_days: "",
  requires_po: false,
  vat_number: "",
  notes: "",
};

function clientToForm(c: Client): ClientForm {
  return {
    name: c.name,
    contact_name: c.contact_name ?? "",
    contact_email: c.contact_email ?? "",
    accounts_email: c.accounts_email ?? "",
    address_line1: c.address_line1 ?? "",
    address_line2: c.address_line2 ?? "",
    city: c.city ?? "",
    postcode: c.postcode ?? "",
    country: c.country ?? "",
    payment_terms_days: c.payment_terms_days != null ? String(c.payment_terms_days) : "",
    requires_po: c.requires_po,
    vat_number: c.vat_number ?? "",
    notes: c.notes ?? "",
  };
}

function formToPayload(f: ClientForm) {
  return {
    name: f.name.trim(),
    contact_name: f.contact_name.trim() || null,
    contact_email: f.contact_email.trim() || null,
    accounts_email: f.accounts_email.trim() || null,
    address_line1: f.address_line1.trim() || null,
    address_line2: f.address_line2.trim() || null,
    city: f.city.trim() || null,
    postcode: f.postcode.trim() || null,
    country: f.country.trim() || null,
    payment_terms_days: f.payment_terms_days ? parseInt(f.payment_terms_days, 10) : null,
    requires_po: f.requires_po,
    vat_number: f.vat_number.trim() || null,
    notes: f.notes.trim() || null,
  };
}

// ── Form dialog ───────────────────────────────────────────────────────────────

function ClientFormDialog({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial: ClientForm;
  onSave: (form: ClientForm) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ClientForm>(initial);
  const set = (k: keyof ClientForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const isNew = !initial.name;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add client" : "Edit client"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Company name */}
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">
              Company / Client name <span className="text-destructive">*</span>
            </Label>
            <input
              id="cl-name"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Acme Productions Ltd"
            />
          </div>

          {/* Contact */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cl-contact-name">Contact name</Label>
              <input
                id="cl-contact-name"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-contact-email">Booker email</Label>
              <input
                id="cl-contact-email"
                type="email"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.contact_email}
                onChange={(e) => set("contact_email", e.target.value)}
                placeholder="jane@acme.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-accounts-email">Accounts / AP email</Label>
            <input
              id="cl-accounts-email"
              type="email"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.accounts_email}
              onChange={(e) => set("accounts_email", e.target.value)}
              placeholder="accounts@acme.com"
            />
            <p className="text-[11px] text-muted-foreground">
              The email invoices go to — often different from the booker.
            </p>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label>Billing address</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)}
              placeholder="Line 1"
            />
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.address_line2}
              onChange={(e) => set("address_line2", e.target.value)}
              placeholder="Line 2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="City"
              />
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.postcode}
                onChange={(e) => set("postcode", e.target.value)}
                placeholder="Postcode"
              />
            </div>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="Country"
            />
          </div>

          {/* Invoicing settings */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cl-terms">Payment terms (days)</Label>
              <input
                id="cl-terms"
                type="number"
                min={0}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.payment_terms_days}
                onChange={(e) => set("payment_terms_days", e.target.value)}
                placeholder="30 (profile default)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-vat">VAT number</Label>
              <input
                id="cl-vat"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.vat_number}
                onChange={(e) => set("vat_number", e.target.value)}
                placeholder="GB123456789"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={form.requires_po}
              onClick={() => set("requires_po", !form.requires_po)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.requires_po ? "bg-primary" : "bg-input"}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${form.requires_po ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
            <div>
              <p className="text-sm font-medium">Requires PO number</p>
              <p className="text-xs text-muted-foreground">
                Invoice form will prompt for a purchase order number.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-notes">Notes</Label>
            <textarea
              id="cl-notes"
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Chase after 30 days, slow payer…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : isNew ? "Add client" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ClientsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Client | null | "new">(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/earnings/clients", "stats"],
    queryFn: () => apiRequest("/api/earnings/clients?stats=1"),
  });

  const createMut = useMutation({
    mutationFn: (body: ReturnType<typeof formToPayload>) =>
      apiRequest("/api/earnings/clients", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/clients"] });
      toast({ title: "Client added" });
      setEditing(null);
    },
    onError: (e: Error) =>
      toast({ title: "Failed to add client", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReturnType<typeof formToPayload> }) =>
      apiRequest(`/api/earnings/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/clients"] });
      toast({ title: "Client updated" });
      setEditing(null);
    },
    onError: (e: Error) =>
      toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/earnings/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/clients"] });
      toast({ title: "Client archived" });
    },
    onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
  });

  const handleSave = (form: ClientForm) => {
    const payload = formToPayload(form);
    if (editing === "new") {
      createMut.mutate(payload);
    } else if (editing) {
      updateMut.mutate({ id: editing.id, body: payload });
    }
  };

  const visible = clients.filter((c) => (showArchived ? c.archived : !c.archived));
  const archivedCount = clients.filter((c) => c.archived).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Clients</h3>
          <p className="text-xs text-muted-foreground">
            Saved billing details — prefilled on future invoices.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
          <Plus className="h-3.5 w-3.5" />
          Add client
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {showArchived ? "No archived clients" : "No clients yet"}
          </p>
          {!showArchived && (
            <p className="mt-1 text-xs text-muted-foreground">
              Add a client to prefill their details on invoices.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y rounded-xl border">
          {visible.map((client) => (
            <div key={client.id} className="flex items-start gap-4 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{client.name}</span>
                  {client.requires_po && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      PO required
                    </Badge>
                  )}
                  {client.archived && (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                      Archived
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {client.contact_name && <span>{client.contact_name}</span>}
                  {(client.accounts_email ?? client.contact_email) && (
                    <span>{client.accounts_email ?? client.contact_email}</span>
                  )}
                  {client.city && (
                    <span>{[client.city, client.postcode].filter(Boolean).join(" ")}</span>
                  )}
                  {client.payment_terms_days != null && (
                    <span>{client.payment_terms_days}‑day terms</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {client.invoice_count > 0 ? (
                    <>
                      {client.invoice_count} invoice{client.invoice_count !== 1 ? "s" : ""}
                      {client.last_invoiced && (
                        <>
                          {" · "}last{" "}
                          {new Date(client.last_invoiced).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <span className="italic">Not yet invoiced</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setEditing(client)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!client.archived && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archive {client.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They will disappear from client pickers. Existing invoices are not
                          affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => archiveMut.mutate(client.id)}>
                          Archive
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {archivedCount > 0 && (
        <button
          className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Hide archived" : `Show ${archivedCount} archived`}
        </button>
      )}

      {editing && (
        <ClientFormDialog
          initial={editing === "new" ? EMPTY_FORM : clientToForm(editing)}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}
