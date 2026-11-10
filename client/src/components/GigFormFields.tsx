import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GigForm {
  description: string;
  client_name: string;
  work_date: string;
  work_end_date: string;
  unit: "day" | "hour" | "job";
  quantity: string;
  gross_amount: string;
  currency: string;
  status: "expected" | "paid";
  paid_date: string;
  notes: string;
  work_status: "" | "pencilled" | "confirmed" | "completed" | "cancelled";
  call_time: string;
  venue_address: string;
}

export const EMPTY_GIG_FORM: GigForm = {
  description: "",
  client_name: "",
  work_date: "",
  work_end_date: "",
  unit: "day",
  quantity: "1",
  gross_amount: "",
  currency: "GBP",
  status: "expected",
  paid_date: "",
  notes: "",
  work_status: "",
  call_time: "",
  venue_address: "",
};

export function GigFormBody({
  form,
  onChange,
  clients,
}: {
  form: GigForm;
  onChange: (k: keyof GigForm, v: string) => void;
  clients: Array<{ id: number; name: string }>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="gig-desc">Job / gig description *</Label>
        <Input
          id="gig-desc"
          placeholder="e.g. Wedding photography, Corporate AV"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="gig-client">Client name</Label>
        <Input
          id="gig-client"
          list="gig-clients-list"
          placeholder="Type or pick an existing client"
          value={form.client_name}
          onChange={(e) => onChange("client_name", e.target.value)}
        />
        <datalist id="gig-clients-list">
          {clients.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="gig-date">Work date *</Label>
          <Input
            id="gig-date"
            type="date"
            value={form.work_date}
            onChange={(e) => onChange("work_date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gig-end">End date (optional)</Label>
          <Input
            id="gig-end"
            type="date"
            value={form.work_end_date}
            onChange={(e) => onChange("work_end_date", e.target.value)}
          />
        </div>
      </div>

      {/* Booking status — makes this gig appear on the calendar */}
      <div className="space-y-1">
        <Label>Booking status</Label>
        <Select
          value={form.work_status || "__none__"}
          onValueChange={(v) => onChange("work_status", v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Not a scheduled booking" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Not a scheduled booking</SelectItem>
            <SelectItem value="pencilled">Pencilled in</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Set to show this gig on your calendar.</p>
      </div>

      {form.work_status && form.work_status !== "cancelled" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="gig-call-time">Call time</Label>
            <Input
              id="gig-call-time"
              type="time"
              value={form.call_time}
              onChange={(e) => onChange("call_time", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gig-venue">Venue / address</Label>
            <Input
              id="gig-venue"
              placeholder="e.g. St Paul's Cathedral"
              value={form.venue_address}
              onChange={(e) => onChange("venue_address", e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Unit</Label>
          <Select value={form.unit} onValueChange={(v) => onChange("unit", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Per day</SelectItem>
              <SelectItem value="hour">Per hour</SelectItem>
              <SelectItem value="job">Per job</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="gig-qty">Qty</Label>
          <Input
            id="gig-qty"
            type="number"
            min="0.5"
            step="0.5"
            value={form.quantity}
            onChange={(e) => onChange("quantity", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Select value={form.currency} onValueChange={(v) => onChange("currency", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GBP">GBP £</SelectItem>
              <SelectItem value="EUR">EUR €</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="gig-amount">Total amount (optional)</Label>
        <Input
          id="gig-amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.gross_amount}
          onChange={(e) => onChange("gross_amount", e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Full amount owed or paid — not the day rate. Leave blank or 0 if not yet agreed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Payment status</Label>
          <Select value={form.status} onValueChange={(v) => onChange("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expected">Expected / owed</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.status === "paid" && (
          <div className="space-y-1">
            <Label htmlFor="gig-paid-date">Date paid</Label>
            <Input
              id="gig-paid-date"
              type="date"
              value={form.paid_date}
              onChange={(e) => onChange("paid_date", e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="gig-notes">Notes (optional)</Label>
        <Textarea
          id="gig-notes"
          rows={2}
          placeholder="Any extra details…"
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </div>
    </div>
  );
}
