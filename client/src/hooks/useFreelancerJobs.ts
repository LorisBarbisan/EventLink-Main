import { useQuery } from "@tanstack/react-query";

export type JobPhase = "upcoming" | "awaiting_payment" | "paid" | "cancelled";

export interface FreelancerJob {
  booking: {
    id: number;
    jobId: number;
    employerId: number;
    status: string;
    agreedRate: string | null;
    currency: string | null;
    earnings_entry_id: number | null;
    entry_status: string | null;
    entry_gross_pence: number | null;
    entry_paid_pence: number | null;
    entry_paid_date: string | null;
    createdAt: string;
    updatedAt: string;
  };
  job: {
    id: number;
    title: string;
    location: string | null;
    eventDate: string | null;
    endDate: string | null;
    payRate: string | null;
  };
  employer: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    profilePicture: string | null;
  };
  phase: JobPhase;
}

function derivePhase(hb: Omit<FreelancerJob, "phase">): JobPhase {
  if (hb.booking.status === "cancelled") return "cancelled";
  if (hb.booking.entry_status === "paid") return "paid";
  const eventDate = hb.job.eventDate;
  if (!eventDate || new Date(eventDate) >= new Date(new Date().toDateString())) return "upcoming";
  return "awaiting_payment";
}

export function useFreelancerJobs() {
  return useQuery<FreelancerJob[]>({
    queryKey: ["/api/bookings/freelancer"],
    select: (raw: any[]) =>
      raw.map((item) => {
        const base = { booking: item.booking, job: item.job, employer: item.employer };
        return { ...base, phase: derivePhase(base) };
      }),
  });
}
