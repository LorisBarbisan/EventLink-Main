import type { Job } from "@shared/schema";
import { storage } from "../../storage";
import { emailService } from "./emailNotificationService";

type JobWithPoster = Pick<Job, "id" | "title" | "recruiter_id" | "posted_by_user_id">;

/** Resolves poster from posted_by_user_id; backfills the column from recruiter_id when missing. */
async function resolveJobPosterUserId(job: JobWithPoster): Promise<number | null> {
  return storage.ensureJobPostedByUserId(job);
}

/** In-app alert for the job poster — always job_update + related_entity_type application. */
export async function notifyJobPosterInApp(params: {
  job: JobWithPoster;
  applicationId: number;
  title: string;
  message: string;
  priority?: "high" | "normal" | "low" | "urgent";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const recipientUserId = await resolveJobPosterUserId(params.job);
  if (!recipientUserId) {
    console.warn(`Skipping job poster notification: job ${params.job.id} has no posted_by_user_id`);
    return;
  }

  await storage.createNotification({
    user_id: recipientUserId,
    type: "job_update",
    title: params.title,
    message: params.message,
    priority: params.priority ?? "normal",
    related_entity_type: "application",
    related_entity_id: params.applicationId,
    action_url: "/dashboard?tab=applications",
    metadata: JSON.stringify({
      application_id: params.applicationId,
      job_id: params.job.id,
      ...params.metadata,
    }),
  });
}

/**
 * Notify the job poster (not the whole team) of a new application.
 */
export async function notifyJobPosterOfNewApplication(params: {
  job: JobWithPoster;
  applicationId: number;
  freelancerUserId: number;
}): Promise<void> {
  const { job, applicationId, freelancerUserId } = params;
  const recipientUserId = await resolveJobPosterUserId(job);

  if (!recipientUserId) {
    console.warn(`Skipping application notification: job ${job.id} has no posted_by_user_id`);
    return;
  }

  const recruiter = await storage.getUser(recipientUserId);
  if (!recruiter) {
    console.warn(`Skipping application notification: user ${recipientUserId} not found for job ${job.id}`);
    return;
  }

  await notifyJobPosterInApp({
    job,
    applicationId,
    title: "New Job Application",
    message: `A freelancer has applied to your job: ${job.title}`,
    priority: "high",
    metadata: { kind: "new_application" },
  });

  let recruiterDisplayName = recruiter.email;
  const companyOwnerId = job.recruiter_id;
  if (companyOwnerId) {
    const recruiterProfile = await storage.getRecruiterProfile(companyOwnerId);
    if (recruiterProfile?.company_name) {
      recruiterDisplayName = recruiterProfile.company_name;
    } else if (recruiter.first_name || recruiter.last_name) {
      recruiterDisplayName =
        `${recruiter.first_name || ""} ${recruiter.last_name || ""}`.trim() || recruiter.email;
    }
  } else if (recruiter.first_name || recruiter.last_name) {
    recruiterDisplayName =
      `${recruiter.first_name || ""} ${recruiter.last_name || ""}`.trim() || recruiter.email;
  }

  let freelancerDisplayName = "A freelancer";
  let freelancerTitle: string | undefined;
  const freelancerProfile = await storage.getFreelancerProfile(freelancerUserId);
  if (freelancerProfile) {
    if (freelancerProfile.first_name || freelancerProfile.last_name) {
      freelancerDisplayName =
        `${freelancerProfile.first_name || ""} ${freelancerProfile.last_name || ""}`.trim();
    }
    freelancerTitle = freelancerProfile.title || undefined;
  }

  try {
    await emailService.sendNewApplicationNotification({
      recipientId: recipientUserId,
      recipientEmail: recruiter.email,
      recipientName: recruiterDisplayName,
      jobTitle: job.title,
      freelancerName: freelancerDisplayName,
      freelancerTitle,
      jobId: job.id,
      applicationId,
    });
  } catch (emailError) {
    console.error("Failed to send new application email:", emailError);
  }
}
