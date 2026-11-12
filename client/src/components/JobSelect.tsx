import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface JobOption {
  id: number;
  description: string;
  work_date: string;
  work_end_date: string | null;
  client_name: string | null;
  booking_id: number | null;
  work_status: string | null;
}

interface JobSelectProps {
  value: string; // earnings_entry_id as string, or "" for none
  onChange: (value: string) => void;
  label?: string;
}

const today = new Date().toISOString().slice(0, 10);

export function JobSelect({ value, onChange, label = "Link to a job (optional)" }: JobSelectProps) {
  const { data: jobOptions = [] } = useQuery<JobOption[]>({
    queryKey: ["/api/earnings/jobs"],
    queryFn: () => apiRequest("/api/earnings/jobs"),
  });

  if (jobOptions.length === 0) {
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <Select disabled>
          <SelectTrigger style={{ fontSize: "16px" }} className="text-muted-foreground">
            <SelectValue placeholder="No jobs added yet" />
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger style={{ fontSize: "16px" }}>
          <SelectValue placeholder="Not linked to a job" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Not linked —</SelectItem>
          {jobOptions.map((j) => (
            <SelectItem key={j.id} value={String(j.id)}>
              {j.description}
              {j.client_name ? ` · ${j.client_name}` : ""}
              {" · "}
              {j.work_date}
              {j.work_status === "confirmed" && j.work_date >= today ? " ✓" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Resolve the booking_id for a given earnings_entry_id from the cached job list. */
export function useJobBookingId(jobOptions: JobOption[], entryId: string): number | null {
  if (!entryId) return null;
  return jobOptions.find((j) => j.id === parseInt(entryId))?.booking_id ?? null;
}
