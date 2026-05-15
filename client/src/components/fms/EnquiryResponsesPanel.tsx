import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  CalendarDays,
  Clock,
  MapPin,
  Loader2,
  User,
  Briefcase,
  DollarSign,
  Trash2,
  Pencil,
  UserPlus,
  XCircle,
} from "lucide-react";

type ResponseValue = "yes" | "no" | "maybe" | null;

interface FreelancerResponse {
  response: {
    id: number;
    freelancerId: number;
    response: ResponseValue;
    responseNote: string | null;
    respondedAt: string | null;
    convertedToBookingId: number | null;
    convertedAt: string | null;
  };
  profile: {
    first_name: string | null;
    last_name: string | null;
    profile_image_url: string | null;
    title: string | null;
  } | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface EnquiryDetail {
  enquiry: {
    id: number;
    status: "active" | "closed";
    eventTitle: string;
    eventDate: string;
    eventEndDate: string | null;
    callTime: string | null;
    venueAddress: string | null;
    roleRequired: string | null;
    agreedRate: string | null;
    additionalNotes: string | null;
  };
  responses: FreelancerResponse[];
}

interface CrewFreelancer {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  title: string | null;
  location: string | null;
}

const RESPONSE_ORDER: Record<string, number> = { yes: 0, maybe: 1, null: 2, no: 3 };

function responseSortKey(r: FreelancerResponse) {
  return RESPONSE_ORDER[String(r.response.response)] ?? 2;
}

function ResponseBadge({ value }: { value: ResponseValue }) {
  if (value === "yes")
    return <Badge className="bg-green-500 text-white hover:bg-green-500">Yes</Badge>;
  if (value === "maybe")
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Maybe</Badge>;
  if (value === "no")
    return <Badge className="bg-red-500 text-white hover:bg-red-500">No</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Awaiting response
    </Badge>
  );
}

interface Props {
  enquiryId: number;
  onClose: () => void;
}

export function EnquiryResponsesPanel({ enquiryId, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAddIds, setSelectedAddIds] = useState<number[]>([]);

  const { data, isLoading } = useQuery<EnquiryDetail>({
    queryKey: ["/api/enquiries", enquiryId, "responses"],
    queryFn: () => apiRequest(`/api/enquiries/${enquiryId}/responses`),
  });

  const { data: crew = [] } = useQuery<CrewFreelancer[]>({
    queryKey: ["/api/my-crew"],
    queryFn: () => apiRequest("/api/my-crew"),
    enabled: addOpen,
  });

  // ── Mutations ────────────────────────────────────────────

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/enquiries/${enquiryId}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Enquiry cancelled", description: "All freelancers have been notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
    },
    onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: object) =>
      apiRequest(`/api/enquiries/${enquiryId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: (data: any) => {
      const msg = data.emailsSent
        ? "Details updated. Freelancers notified of the changes."
        : "Details updated.";
      toast({ title: "Enquiry updated", description: msg });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "responses"] });
      setEditOpen(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiRequest(`/api/enquiries/${enquiryId}/freelancers`, {
        method: "POST",
        body: JSON.stringify({ freelancerIds: ids }),
      }),
    onSuccess: () => {
      toast({
        title: "Freelancers added",
        description: "They have been sent the availability check.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "responses"] });
      setAddOpen(false);
      setSelectedAddIds([]);
    },
    onError: () => toast({ title: "Failed to add freelancers", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: (responseId: number) =>
      apiRequest(`/api/enquiries/${enquiryId}/convert/${responseId}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Booking confirmed", description: "The freelancer has been booked." });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "responses"] });
    },
    onError: (err: any) =>
      toast({
        title: "Could not convert to booking",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (fId: number) =>
      apiRequest(`/api/enquiries/${enquiryId}/freelancers/${fId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Freelancer removed", description: "They have been notified by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
    },
    onError: (err: any) =>
      toast({
        title: "Cannot remove",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      }),
  });

  // ── Helpers ──────────────────────────────────────────────

  function handleCancel() {
    if (
      window.confirm(
        "Cancel this availability enquiry? All freelancers will be notified by email."
      )
    ) {
      cancelMutation.mutate();
    }
  }

  function handleRemove(fId: number, name: string) {
    if (
      window.confirm(
        `Remove ${name} from this enquiry? They will be notified by email.`
      )
    ) {
      removeMutation.mutate(fId);
    }
  }

  function toggleAddId(id: number) {
    setSelectedAddIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Loading ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { enquiry, responses } = data;
  const sorted = [...responses].sort((a, b) => responseSortKey(a) - responseSortKey(b));
  const isActive = enquiry.status === "active";

  // Freelancers already on this enquiry (for filtering the add dialog)
  const existingFreelancerIds = new Set(responses.map((r) => r.response.freelancerId));

  // Crew members not already on this enquiry
  const availableCrew = crew.filter((c) => !existingFreelancerIds.has(c.user_id));

  return (
    <div className="p-5 space-y-5">
      {/* ── Enquiry header ── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <h4 className="font-semibold text-base truncate">{enquiry.eventTitle}</h4>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {enquiry.eventDate}
              </span>
              {enquiry.callTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {enquiry.callTime}
                </span>
              )}
              {enquiry.venueAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {enquiry.venueAddress}
                </span>
              )}
              {enquiry.roleRequired && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {enquiry.roleRequired}
                </span>
              )}
              {enquiry.agreedRate && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {enquiry.agreedRate}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons — active only */}
          {isActive && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => setAddOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Cancel Enquiry
              </Button>
            </div>
          )}
        </div>

        {/* Closed banner */}
        {!isActive && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
            <Badge variant="secondary" className="text-muted-foreground">
              Closed
            </Badge>
            <span className="text-xs text-muted-foreground">
              This enquiry is closed — no further actions available.
            </span>
          </div>
        )}
      </div>

      <div className="border-t" />

      {/* ── Response rows ── */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No responses yet.</p>
      ) : (
        <div className="divide-y">
          {sorted.map(({ response: resp, profile, user }) => {
            const firstName = profile?.first_name ?? user?.firstName ?? "";
            const lastName = profile?.last_name ?? user?.lastName ?? "";
            const photo = profile?.profile_image_url ?? null;
            const title = profile?.title ?? null;
            const fullName = `${firstName} ${lastName}`.trim();

            return (
              <div
                key={resp.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {photo ? (
                    <img
                      src={photo}
                      alt={fullName}
                      className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                      <User className="h-5 w-5 text-orange-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{fullName}</p>
                    {title && (
                      <p className="text-xs text-muted-foreground truncate">{title}</p>
                    )}
                  </div>
                </div>

                {/* Badge + note + timestamp */}
                <div className="flex flex-col gap-1 sm:items-end">
                  <ResponseBadge value={resp.response} />
                  {resp.responseNote && (
                    <p className="text-xs italic text-muted-foreground max-w-xs text-right">
                      "{resp.responseNote}"
                    </p>
                  )}
                  {resp.respondedAt && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(resp.respondedAt), "d MMM, HH:mm")}
                    </p>
                  )}
                </div>

                {/* Book Now / Booked chip */}
                {resp.response === "yes" && (
                  <div className="sm:ml-2 flex-shrink-0">
                    {resp.convertedToBookingId ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Booked
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={convertMutation.isPending}
                        onClick={() => convertMutation.mutate(resp.id)}
                        className="bg-orange-500 hover:bg-orange-600 h-8 text-xs"
                      >
                        {convertMutation.isPending && (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        )}
                        Book Now
                      </Button>
                    )}
                  </div>
                )}

                {/* Remove button — active enquiry, not yet booked */}
                {isActive && !resp.convertedToBookingId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(resp.freelancerId, fullName)}
                    disabled={removeMutation.isPending}
                    title={`Remove ${fullName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Details Dialog ── */}
      {editOpen && (
        <EditEnquiryDialog
          enquiry={enquiry}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={(updates) => updateMutation.mutate(updates)}
          isPending={updateMutation.isPending}
        />
      )}

      {/* ── Add Freelancers Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setSelectedAddIds([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Freelancers</DialogTitle>
          </DialogHeader>
          {availableCrew.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {crew.length === 0
                ? "No crew members saved yet."
                : "All your saved crew are already on this enquiry."}
            </p>
          ) : (
            <div className="divide-y max-h-72 overflow-y-auto">
              {availableCrew.map((c) => (
                <label
                  key={c.user_id}
                  className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/40 px-1 rounded"
                >
                  <Checkbox
                    checked={selectedAddIds.includes(c.user_id)}
                    onCheckedChange={() => toggleAddId(c.user_id)}
                  />
                  {c.profile_image_url ? (
                    <img
                      src={c.profile_image_url}
                      alt={`${c.first_name} ${c.last_name}`}
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-orange-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    {c.title && (
                      <p className="text-xs text-muted-foreground truncate">{c.title}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setSelectedAddIds([]); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              disabled={selectedAddIds.length === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate(selectedAddIds)}
            >
              {addMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Send Enquiry{selectedAddIds.length > 0 ? ` (${selectedAddIds.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit Enquiry Dialog ────────────────────────────────────

interface EditDialogProps {
  enquiry: EnquiryDetail["enquiry"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: object) => void;
  isPending: boolean;
}

function EditEnquiryDialog({ enquiry, open, onOpenChange, onSave, isPending }: EditDialogProps) {
  const [form, setForm] = useState({
    eventTitle: enquiry.eventTitle ?? "",
    eventDate: enquiry.eventDate ?? "",
    eventEndDate: enquiry.eventEndDate ?? "",
    callTime: enquiry.callTime ?? "",
    venueAddress: enquiry.venueAddress ?? "",
    roleRequired: enquiry.roleRequired ?? "",
    agreedRate: enquiry.agreedRate ?? "",
    additionalNotes: enquiry.additionalNotes ?? "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave() {
    const updates: Record<string, string | null> = {
      eventTitle: form.eventTitle || null,
      eventDate: form.eventDate || null,
      eventEndDate: form.eventEndDate || null,
      callTime: form.callTime || null,
      venueAddress: form.venueAddress || null,
      roleRequired: form.roleRequired || null,
      agreedRate: form.agreedRate || null,
      additionalNotes: form.additionalNotes || null,
    };
    onSave(updates);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Enquiry Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="eq-eventTitle">Event title *</Label>
            <Input
              id="eq-eventTitle"
              value={form.eventTitle}
              onChange={(e) => set("eventTitle", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-eventDate">Event date *</Label>
              <Input
                id="eq-eventDate"
                type="date"
                value={form.eventDate}
                onChange={(e) => set("eventDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-eventEndDate">End date</Label>
              <Input
                id="eq-eventEndDate"
                type="date"
                value={form.eventEndDate}
                onChange={(e) => set("eventEndDate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-callTime">Call time</Label>
              <Input
                id="eq-callTime"
                type="time"
                value={form.callTime}
                onChange={(e) => set("callTime", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-agreedRate">Agreed rate</Label>
              <Input
                id="eq-agreedRate"
                placeholder="e.g. £150/day"
                value={form.agreedRate}
                onChange={(e) => set("agreedRate", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-venueAddress">Venue address</Label>
            <Input
              id="eq-venueAddress"
              value={form.venueAddress}
              onChange={(e) => set("venueAddress", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-roleRequired">Role required</Label>
            <Input
              id="eq-roleRequired"
              value={form.roleRequired}
              onChange={(e) => set("roleRequired", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-additionalNotes">Additional notes</Label>
            <Textarea
              id="eq-additionalNotes"
              rows={3}
              value={form.additionalNotes}
              onChange={(e) => set("additionalNotes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={handleSave}
            disabled={!form.eventTitle || !form.eventDate || isPending}
          >
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
