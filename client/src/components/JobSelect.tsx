import { useMemo } from "react";
import { ukToday } from "@shared/job-dates";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { fmtDate } from "@shared/dates";

export interface JobOption {
  id: number;
  description: string;
  work_date: string;
  work_end_date: string | null;
  client_name: string | null;
  booking_id: number | null;
  work_status: string | null;
  job_ref: string | null;
  venue: string | null;
  venue_address: string | null;
  invoice_number: string | null;
}

interface JobSelectProps {
  value: string; // earnings_entry_id as string, or "" for none
  onChange: (value: string) => void;
  label?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12–14 Nov 2026" within a month, otherwise both dates in full. */
function fmtRange(start: string, end: string | null): string {
  if (!end || end === start) return fmtDate(start);
  const [sy, sm, sd] = start.split("-");
  const [ey, em, ed] = end.split("-");
  if (sy === ey && sm === em)
    return `${parseInt(sd)}–${parseInt(ed)} ${MONTHS[parseInt(em) - 1]} ${ey}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

const NOT_LINKED: SearchableOption[] = [{ value: "", label: "Not linked to a job" }];

export function toJobOption(j: JobOption, today: string): SearchableOption {
  const venue = j.venue?.trim();
  const label =
    venue && !j.description.toLowerCase().includes(venue.toLowerCase())
      ? `${j.description} — ${venue}`
      : j.description;
  const upcoming = j.work_status === "confirmed" && j.work_date >= today;
  const sublabel = [
    j.client_name,
    fmtRange(j.work_date, j.work_end_date),
    j.invoice_number ?? j.job_ref,
    upcoming ? "Confirmed" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    value: String(j.id),
    label,
    sublabel,
    keywords: [j.job_ref, j.invoice_number, j.venue_address],
  };
}

export function JobSelect({ value, onChange, label = "Link to a job (optional)" }: JobSelectProps) {
  const { data: jobOptions = [] } = useQuery<JobOption[]>({
    queryKey: ["/api/earnings/jobs"],
    queryFn: () => apiRequest("/api/earnings/jobs"),
  });

  // Keeps the server's order: future confirmed work first, then most recent.
  const options = useMemo(() => {
    const today = ukToday();
    return jobOptions.map((j) => toJobOption(j, today));
  }, [jobOptions]);

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        pinned={NOT_LINKED}
        disabled={jobOptions.length === 0}
        placeholder={jobOptions.length === 0 ? "No jobs added yet" : "Not linked to a job"}
        searchPlaceholder="Type a job, client, venue or invoice number"
        emptyLabel="No jobs match"
        aria-label={label}
        triggerClassName="text-base"
      />
    </div>
  );
}

/** Resolve the booking_id for a given earnings_entry_id from the cached job list. */
export function useJobBookingId(jobOptions: JobOption[], entryId: string): number | null {
  if (!entryId) return null;
  return jobOptions.find((j) => j.id === parseInt(entryId))?.booking_id ?? null;
}
