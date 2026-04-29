import cron from "node-cron";
import { storage } from "../../storage";
import { sendEmail } from "../utils/emailService";
import * as emailTemplates from "../utils/emailTemplates";
import { isWithinRadius } from "../utils/uk-coordinates";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";

/**
 * Determines if a job matches a freelancer's alert filters.
 * Mirrors the logic in emailNotificationService.ts.
 */
function jobMatchesFilters(job: any, filter: any): boolean {
  if (!filter || !filter.is_active) return false;

  if (filter.skills && filter.skills.length > 0) {
    const searchText = `${(job.title || "").toLowerCase()} ${(job.description || "").toLowerCase()}`;
    const hasMatch = filter.skills.some((s: string) => searchText.includes(s.toLowerCase()));
    if (!hasMatch) return false;
  }

  if (filter.locations && filter.locations.length > 0) {
    const jobLocation = (job.location || "").trim();
    const radiusKm = filter.location_radius_km || 30;
    const hasMatch = filter.locations.some((filterLocation: string) => {
      const geoResult = isWithinRadius(filterLocation, jobLocation, radiusKm);
      if (geoResult !== null) return geoResult;
      return (
        jobLocation.toLowerCase().includes(filterLocation.toLowerCase()) ||
        filterLocation.toLowerCase().includes(jobLocation.toLowerCase())
      );
    });
    if (!hasMatch) return false;
  }

  if (filter.keywords && filter.keywords.length > 0) {
    const searchText = `${(job.title || "").toLowerCase()} ${(job.description || "").toLowerCase()}`;
    const hasMatch = filter.keywords.some((k: string) => searchText.includes(k.toLowerCase()));
    if (!hasMatch) return false;
  }

  if (filter.date_from || filter.date_to) {
    const jobStartDate = job.event_date ? new Date(job.event_date) : null;
    if (!jobStartDate) return false;
    if (filter.date_from && jobStartDate < new Date(filter.date_from)) return false;
    if (filter.date_to && jobStartDate > new Date(filter.date_to)) return false;
  }

  return true;
}

/**
 * Send a batch notification email to a freelancer for one or more jobs.
 */
async function sendBatchEmail(params: {
  recipientId: number;
  recipientEmail: string;
  recipientFirstName: string;
  jobs: Array<{
    id: number;
    title: string;
    company: string;
    location: string;
    rate: string;
    event_date: string | null;
    description: string;
    slug?: string | null;
  }>;
  isUrgent?: boolean;
}): Promise<boolean> {
  try {
    const jobsData = params.jobs.map(job => {
      const eventDate = job.event_date
        ? new Date(job.event_date).toLocaleDateString("en-GB", {
            weekday: "short", year: "numeric", month: "short", day: "numeric",
          })
        : "Date TBC";
      const descriptionPreview = job.description
        ? job.description.slice(0, 120).replace(/\s+\S*$/, "") + (job.description.length > 120 ? "…" : "")
        : "";
      const jobUrl = job.slug
        ? `${BASE_URL}/jobs/${job.slug}`
        : `${BASE_URL}/jobs?jobId=${job.id}`;
      return {
        title: job.title,
        employerName: job.company,
        location: job.location,
        payRate: job.rate,
        eventDate,
        descriptionPreview,
        jobUrl,
      };
    });

    const { subject, html } = emailTemplates.batchJobNotifyEmail({
      recipientFirstName: params.recipientFirstName,
      jobs: jobsData,
      dashboardUrl: `${BASE_URL}/dashboard`,
      unsubscribeUrl: `${BASE_URL}/notification-settings`,
      isUrgent: params.isUrgent,
    });

    await sendEmail({ to: params.recipientEmail, subject, html });

    await storage.logEmailNotification({
      user_id: params.recipientId,
      email: params.recipientEmail,
      notification_type: "job_alert",
      subject,
      status: "sent",
      related_entity_type: "job",
      related_entity_id: params.jobs[0]?.id ?? null,
      metadata: JSON.stringify({ jobIds: params.jobs.map(j => j.id), batch: true }),
      error_message: null,
    });

    return true;
  } catch (err: any) {
    console.error(`❌ Batch email failed for user ${params.recipientId}:`, err?.message || err);
    return false;
  }
}

/**
 * Determine if a freelancer matches a job using the same skill/location logic
 * as getFreelancersMatchingJob in storage.ts.
 */
function freelancerMatchesJob(job: any, freelancerTitle: string | null, freelancerLocation: string | null): boolean {
  const stopWords = new Set(["and", "or", "the", "a", "an", "in", "at", "of", "for", "to", "with"]);
  const jobTitleWords = job.title
    .toLowerCase()
    .split(/[\s\-\/,]+/)
    .filter((w: string) => w.length > 2 && !stopWords.has(w));
  const jobLocationNorm = (job.location || "").toLowerCase();

  const titleNorm = (freelancerTitle || "").toLowerCase();
  const locationNorm = (freelancerLocation || "").toLowerCase();

  const roleMatch = jobTitleWords.some((w: string) => titleNorm.includes(w));
  const locationMatch =
    locationNorm.length > 0 &&
    (jobLocationNorm.includes(locationNorm.split(/[,\s]/)[0]) ||
      locationNorm.includes(jobLocationNorm.split(/[,\s]/)[0]));

  return roleMatch || locationMatch;
}

/**
 * Process a batch window: find matching jobs and freelancers, send bundled emails.
 */
export async function processBatchWindow(window: "morning" | "afternoon"): Promise<void> {
  console.log(`📬 Processing ${window} batch window...`);

  const batchJobs = await storage.getJobsForBatchWindow(window);

  if (batchJobs.length === 0) {
    console.log(`📭 No jobs in ${window} batch window — skipping.`);
    return;
  }

  console.log(`📋 Found ${batchJobs.length} job(s) in ${window} batch window.`);

  const { users: freelancerUsers } = await storage.getAllUsers(
    1, 100000, undefined, "freelancer", "active", "created_at", "desc", undefined
  );

  const freelancerJobMap = new Map<number, typeof batchJobs>();

  for (const user of freelancerUsers) {
    if (!user.email_verified) continue;

    const prefs = await storage.getFreelancerJobAlertPrefs(user.id);

    if (prefs.jobAlertsOptOut || prefs.jobAlertFrequencyPreference === "none") continue;

    if (prefs.lastJobAlertSentAt) {
      const hoursSinceLast = (Date.now() - new Date(prefs.lastJobAlertSentAt).getTime()) / 3_600_000;
      if (hoursSinceLast < 24) continue;
    }

    const filters = await storage.getJobAlertFilters(user.id);
    const profile = await storage.getFreelancerProfile(user.id);

    const matchedJobs = batchJobs.filter(job => {
      if (filters.length > 0) {
        return filters.some(f => jobMatchesFilters(job, f));
      }
      return freelancerMatchesJob(job, profile?.title ?? null, profile?.location ?? null);
    });

    if (matchedJobs.length === 0) continue;

    freelancerJobMap.set(user.id, matchedJobs);
  }

  let notifiedCount = 0;
  for (const [userId, matchedJobs] of freelancerJobMap.entries()) {
    const user = freelancerUsers.find(u => u.id === userId);
    if (!user) continue;

    const firstName = user.first_name || "there";

    const ok = await sendBatchEmail({
      recipientId: userId,
      recipientEmail: user.email,
      recipientFirstName: firstName,
      jobs: matchedJobs as any[],
    });

    if (ok) {
      await storage.updateFreelancerLastJobAlertSent(userId);
      notifiedCount++;
    }
  }

  for (const job of batchJobs) {
    await storage.updateJobBatchNotification(job.id, null, new Date());
  }

  console.log(`✅ ${window} batch complete: ${notifiedCount} freelancer(s) notified, ${batchJobs.length} job(s) processed.`);
}

/**
 * Send urgent job notification immediately (called via setTimeout).
 */
export async function sendUrgentJobNotification(job: any): Promise<void> {
  console.log(`🚨 Sending urgent job notification for job ${job.id}: "${job.title}"`);

  try {
    const matching = await storage.getFreelancersMatchingJob(job);
    if (matching.length === 0) {
      console.log(`📭 No matching freelancers for urgent job ${job.id}`);
      return;
    }

    let notifiedCount = 0;
    for (const freelancer of matching) {
      const prefs = await storage.getFreelancerJobAlertPrefs(freelancer.userId);
      if (prefs.jobAlertsOptOut || prefs.jobAlertFrequencyPreference === "none") continue;

      const eventDate = job.event_date
        ? new Date(job.event_date).toLocaleDateString("en-GB", {
            weekday: "short", year: "numeric", month: "short", day: "numeric",
          })
        : "Date TBC";

      const ok = await sendBatchEmail({
        recipientId: freelancer.userId,
        recipientEmail: freelancer.email,
        recipientFirstName: freelancer.firstName || "there",
        jobs: [{
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          rate: job.rate,
          event_date: job.event_date,
          description: job.description,
          slug: (job as any).slug ?? null,
        }],
        isUrgent: true,
      });

      if (ok) {
        await storage.updateFreelancerLastJobAlertSent(freelancer.userId);
        notifiedCount++;
      }
    }

    await storage.setJobNotificationSentAt(job.id);
    console.log(`✅ Urgent job ${job.id}: ${notifiedCount}/${matching.length} freelancer(s) notified.`);
  } catch (err) {
    console.error(`❌ Failed to send urgent notification for job ${job.id}:`, err);
  }
}

/**
 * Register the morning (09:00) and afternoon (13:00) batch window cron jobs.
 */
export function registerJobNotificationScheduler(): void {
  cron.schedule("0 9 * * *", async () => {
    try {
      await processBatchWindow("morning");
    } catch (err) {
      console.error("❌ Morning batch window error:", err);
    }
  }, { timezone: "Europe/London" });

  cron.schedule("0 13 * * *", async () => {
    try {
      await processBatchWindow("afternoon");
    } catch (err) {
      console.error("❌ Afternoon batch window error:", err);
    }
  }, { timezone: "Europe/London" });

  console.log("✅ Job notification batch scheduler registered (09:00 & 13:00 UK time).");
}
