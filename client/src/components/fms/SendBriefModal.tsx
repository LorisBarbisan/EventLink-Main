import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Paperclip, Loader2 } from "lucide-react";

interface Booking {
  id: number;
  eventTitle?: string;
  callTime?: string | null;
  venueAddress?: string | null;
  roleRequired?: string | null;
  agreedRate?: string | null;
  status?: string;
}

interface Job {
  title?: string;
  eventDate?: string | null;
  location?: string;
  payRate?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  job?: Job;
}

interface BriefTemplate {
  id: number;
  name: string;
  details?: string | null;
  callTime?: string | null;
  venueAddress?: string | null;
  roleRequired?: string | null;
  dresscode?: string | null;
  parkingInfo?: string | null;
  contactOnDay?: string | null;
  scheduleNotes?: string | null;
}

interface PendingFile {
  file: File;
  objectPath: string | null;
  uploading: boolean;
  error?: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

export function SendBriefModal({ open, onOpenChange, booking, job }: Props) {
  const { toast } = useToast();

  // Form state
  const [eventTitle, setEventTitle] = useState(job?.title ?? booking.eventTitle ?? "");
  const [eventDate, setEventDate] = useState(job?.eventDate ?? "");
  const [callTime, setCallTime] = useState(booking.callTime ?? "");
  const [venueAddress, setVenueAddress] = useState(booking.venueAddress ?? "");
  const [roleRequired, setRoleRequired] = useState(booking.roleRequired ?? "");
  const [agreedRate, setAgreedRate] = useState(booking.agreedRate ?? job?.payRate ?? "");
  const [dresscode, setDresscode] = useState("");
  const [parkingInfo, setParkingInfo] = useState("");
  const [contactOnDay, setContactOnDay] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [details, setDetails] = useState("");

  // Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Files
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates = [] } = useQuery<BriefTemplate[]>({
    queryKey: ["/api/briefs/templates"],
    queryFn: () => apiRequest("/api/briefs/templates"),
    enabled: open,
  });

  const applyTemplate = (templateId: string) => {
    const t = templates.find((t) => t.id === parseInt(templateId));
    if (!t) return;
    if (t.callTime) setCallTime(t.callTime);
    if (t.venueAddress) setVenueAddress(t.venueAddress);
    if (t.roleRequired) setRoleRequired(t.roleRequired);
    if (t.dresscode) setDresscode(t.dresscode);
    if (t.parkingInfo) setParkingInfo(t.parkingInfo);
    if (t.contactOnDay) setContactOnDay(t.contactOnDay);
    if (t.scheduleNotes) setScheduleNotes(t.scheduleNotes);
    if (t.details) setDetails(t.details);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (pendingFiles.length + files.length > MAX_FILES) {
      toast({ title: `Maximum ${MAX_FILES} files`, variant: "destructive" });
      return;
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: `${file.name} exceeds 10 MB limit`, variant: "destructive" });
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: `${file.name}: unsupported file type`, variant: "destructive" });
        continue;
      }
      const entry: PendingFile = { file, objectPath: null, uploading: true };
      setPendingFiles((prev) => [...prev, entry]);
      try {
        const { uploadURL } = await apiRequest("/api/briefs/attachment-upload-url");
        await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        // Extract path from signed URL
        const url = new URL(uploadURL);
        const objectPath = url.pathname;
        setPendingFiles((prev) =>
          prev.map((f) => (f.file === file ? { ...f, objectPath, uploading: false } : f))
        );
      } catch {
        setPendingFiles((prev) =>
          prev.map((f) => (f.file === file ? { ...f, uploading: false, error: "Upload failed" } : f))
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (file: File) => {
    setPendingFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (saveAsTemplate && templateName.trim()) {
        await apiRequest("/api/briefs/templates", {
          method: "POST",
          body: JSON.stringify({
            name: templateName.trim(),
            details: details || null,
            callTime: callTime || null,
            venueAddress: venueAddress || null,
            roleRequired: roleRequired || null,
            dresscode: dresscode || null,
            parkingInfo: parkingInfo || null,
            contactOnDay: contactOnDay || null,
            scheduleNotes: scheduleNotes || null,
          }),
        });
      }
      const brief = await apiRequest(`/api/briefs/booking/${booking.id}`, {
        method: "POST",
        body: JSON.stringify({
          eventTitle,
          eventDate,
          callTime: callTime || null,
          venueAddress: venueAddress || null,
          roleRequired: roleRequired || null,
          agreedRate: agreedRate || null,
          details: details || null,
          dresscode: dresscode || null,
          parkingInfo: parkingInfo || null,
          contactOnDay: contactOnDay || null,
          scheduleNotes: scheduleNotes || null,
        }),
      });
      const uploaded = pendingFiles.filter((f) => f.objectPath && !f.error);
      for (const f of uploaded) {
        await apiRequest(`/api/briefs/booking/${booking.id}/attachments`, {
          method: "POST",
          body: JSON.stringify({
            objectPath: f.objectPath,
            originalFilename: f.file.name,
            fileType: f.file.type,
            fileSize: f.file.size,
          }),
        });
      }
      return brief;
    },
    onSuccess: () => {
      toast({ title: "Brief sent!", description: "The freelancer has been notified by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/employer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/briefs/booking", booking.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/briefs/templates"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to send brief", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    },
  });

  const canSend = eventTitle.trim() && eventDate.trim() && pendingFiles.every((f) => !f.uploading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Brief — {job?.title ?? booking.eventTitle ?? "Booking"}</DialogTitle>
        </DialogHeader>

        {/* Template selector */}
        {templates.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedTemplateId}
              onValueChange={(v) => setSelectedTemplateId(v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Load a saved template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { if (selectedTemplateId) applyTemplate(selectedTemplateId); }}
            >
              Load
            </Button>
          </div>
        )}

        <Separator />

        <div className="space-y-5">
          {/* Event Details */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Event Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Event title *</Label>
                <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Event date *</Label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Call time</Label>
                <Input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Location & Role */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Location & Role
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Venue address</Label>
                <Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role required</Label>
                <Input value={roleRequired} onChange={(e) => setRoleRequired(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Agreed rate</Label>
                <Input value={agreedRate} onChange={(e) => setAgreedRate(e.target.value)} placeholder="e.g. £150/day" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Brief Details */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Brief Details
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Dress code</Label>
                <Input value={dresscode} onChange={(e) => setDresscode(e.target.value)} placeholder="e.g. Smart casual / All black" />
              </div>
              <div className="space-y-1.5">
                <Label>Parking information</Label>
                <Input value={parkingInfo} onChange={(e) => setParkingInfo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact on the day</Label>
                <Input value={contactOnDay} onChange={(e) => setContactOnDay(e.target.value)} placeholder="Name, phone number" />
              </div>
              <div className="space-y-1.5">
                <Label>Schedule / Running order</Label>
                <Textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. 10:00 Crew call, 12:00 Doors open…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Additional information</Label>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  placeholder="Any other information for the freelancer"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Attachments */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Attachments
            </p>
            <div className="space-y-2">
              {pendingFiles.map((f) => (
                <div key={f.file.name} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{f.file.name}</span>
                  {f.uploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  {f.error && <span className="text-xs text-red-500">{f.error}</span>}
                  {!f.uploading && (
                    <button type="button" onClick={() => removeFile(f.file)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pendingFiles.length < MAX_FILES && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                    Attach documents
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG — max 10 MB each, up to 5 files</p>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Save as template */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="saveTemplate"
                checked={saveAsTemplate}
                onCheckedChange={(v) => setSaveAsTemplate(!!v)}
              />
              <Label htmlFor="saveTemplate" className="cursor-pointer">Save as template for future briefs</Label>
            </div>
            {saveAsTemplate && (
              <Input
                placeholder="Template name (e.g. Standard Festival Brief)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sendMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend || sendMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {sendMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              "Send Brief"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
