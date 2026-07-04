import { storage } from "../../storage";
import {
  ADZUNA_COUNTRIES,
  DEFAULT_JOB_CONFIG,
  type AdzunaCountryConfig,
  type JobSearchConfig,
} from "./jobConfig";
import { filterEventIndustryJobs, scoreJob } from "./jobFilter";

interface ExternalJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  jobUrl: string;
  postedDate: string;
  source: "reed" | "adzuna";
  employmentType?: string;
  categoryTag?: string; // Adzuna only; undefined for Reed
  countryCode: string;
  countryDisplayName: string;
  currencyCode: string;
}

interface ReedJobResponse {
  jobId: number;
  employerId: number;
  employerName: string;
  employerProfileId?: number;
  employerProfileName?: string;
  jobTitle: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  currency: string;
  expirationDate: string;
  date: string;
  jobDescription: string;
  jobUrl: string;
  employmentType?: string;
}

interface AdzunaJobResponse {
  id: string;
  title: string;
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
  };
  description: string;
  salary_min?: number;
  salary_max?: number;
  created: string;
  redirect_url: string;
  contract_type?: string;
  contract_time?: string;
  category?: {
    tag: string;
    label: string;
  };
}

export class JobAggregator {
  private reedApiKey: string | undefined;
  private adzunaApiKey: string | undefined;
  private adzunaAppId: string | undefined;

  // Sync state tracking
  private syncInProgress = false;
  private lastSyncTime: number = 0;
  private readonly BACKGROUND_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private backgroundSyncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.reedApiKey = process.env.REED_API_KEY;
    this.adzunaApiKey = process.env.ADZUNA_API_KEY;
    this.adzunaAppId = process.env.ADZUNA_APP_ID;

    console.log("🚀 JobAggregator initialized:");
    console.log(`Adzuna App ID: ${this.adzunaAppId ? "CONFIGURED" : "MISSING"}`);

    // Start background sync
    this.startBackgroundSync();
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Start background sync timer
   */
  private startBackgroundSync(): void {
    // Clear existing timer if any
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
    }

    this.backgroundSyncTimer = setInterval(async () => {
      if (!this.syncInProgress) {
        try {
          console.log("⏰ Running background sync...");
          await this.syncExternalJobs();
        } catch (error) {
          console.error("❌ Background sync failed:", error);
        }
      } else {
        console.log("⏸️ Background sync skipped (sync in progress)");
      }
    }, this.BACKGROUND_SYNC_INTERVAL);
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
      this.backgroundSyncTimer = null;
      console.log("🛑 Background sync stopped");
    }
  }

  /**
   * Fetch jobs from Reed UK API
   * You can customize these default parameters:
   * - keywords: Search terms (default: events-related terms)
   * - location: Geographic area (default: 'UK')
   * - resultsToTake: Number of jobs to fetch (max 100, default: 20)
   *
   * Additional Reed API parameters you can add:
   * - minimumSalary: Minimum salary filter
   * - maximumSalary: Maximum salary filter
   * - employmentType: 'permanent', 'contract', 'temp', 'parttime'
   * - graduate: true/false for graduate roles
   * - postedByRecruitmentAgency: true/false
   */
  async fetchReedJobs(
    keywords = "AV Technician OR Audio Visual OR Event Technician OR Event Production OR Production Technician OR Sound Engineer OR Audio Engineer OR Lighting Technician OR Video Technician OR Vision Mixer OR vMix OR Broadcast Technician OR Live Events Technician OR Conference AV OR Technical Crew OR Stage Technician OR LED Technician OR Projection Technician",
    location = "UK",
    options: {
      resultsToTake?: number;
      minimumSalary?: number;
      maximumSalary?: number;
      employmentType?: string;
      graduate?: boolean;
      postedByRecruitmentAgency?: boolean;
    } = {}
  ): Promise<ExternalJob[]> {
    if (!this.reedApiKey) {
      console.log("❌ Reed API key not configured");
      return [];
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Reed API attempt ${attempt}/${maxRetries}`);

        // Build query parameters
        const params = new URLSearchParams({
          keywords: keywords,
          locationName: location,
          resultsToTake: (options.resultsToTake || 25).toString(),
        });

        // Add optional filters
        if (options.minimumSalary) params.append("minimumSalary", options.minimumSalary.toString());
        if (options.maximumSalary) params.append("maximumSalary", options.maximumSalary.toString());
        if (options.employmentType) params.append("employmentType", options.employmentType);
        if (options.graduate !== undefined) params.append("graduate", options.graduate.toString());
        if (options.postedByRecruitmentAgency !== undefined)
          params.append("postedByRecruitmentAgency", options.postedByRecruitmentAgency.toString());

        const url = `https://www.reed.co.uk/api/1.0/search?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Basic ${Buffer.from(this.reedApiKey + ":").toString("base64")}`,
            "User-Agent": "EventLink/1.0",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Reed API error (attempt ${attempt}):`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 429) {
            // Rate limited - wait before retrying
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            // Server error - retry
            continue;
          }

          // Client error - not retryable, fail immediately
          lastError = new Error(
            `Reed API returned ${response.status} ${response.statusText}: ${errorText}`
          );
          break;
        }

        const data = await response.json();
        const results: ReedJobResponse[] = data.results || [];

        return results.map(
          (job: ReedJobResponse): ExternalJob => ({
            id: `reed_${job.jobId}`,
            title: job.jobTitle,
            company: job.employerName,
            location: job.locationName,
            description: job.jobDescription,
            salary: this.formatReedSalary(job.minimumSalary, job.maximumSalary, job.currency),
            jobUrl: job.jobUrl,
            postedDate: job.date,
            source: "reed",
            employmentType: job.employmentType,
            countryCode: "gb",
            countryDisplayName: "United Kingdom",
            currencyCode: "GBP",
          })
        );
      } catch (error) {
        console.error(`❌ Reed fetch attempt ${attempt} failed:`, error);
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error("❌ All Reed fetch attempts failed:", lastError);
    throw lastError ?? new Error("Reed API fetch failed for an unknown reason");
  }

  /**
   * Fetch jobs from Adzuna API for a single country. Salary bounds and
   * currency come from the country config rather than being passed loose,
   * since they only make sense per-market (see ADZUNA_COUNTRIES).
   */
  async fetchAdzunaJobs(
    countryConfig: AdzunaCountryConfig,
    keywords = "AV technician OR event production OR sound engineer OR lighting technician OR video technician OR broadcast technician OR live events",
    options: {
      location?: string;
      results_per_page?: number;
      contract_type?: string;
    } = {}
  ): Promise<ExternalJob[]> {
    if (!this.adzunaApiKey || !this.adzunaAppId) {
      console.log(`❌ Adzuna (${countryConfig.code}) API credentials not configured`);
      return [];
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Adzuna (${countryConfig.code}) API attempt ${attempt}/${maxRetries}`);

        // Build query parameters. Adzuna's `what` param does a strict AND
        // match across every word — it has no boolean "OR" syntax, so a
        // literal " OR "-joined keyword string (e.g. "AV technician OR sound
        // engineer") matches nothing (every result would need to contain the
        // literal word "OR" too). `what_or` is Adzuna's actual OR-semantics
        // param, so the " OR " separators are converted to plain whitespace
        // before sending.
        const params = new URLSearchParams({
          app_id: this.adzunaAppId!,
          app_key: this.adzunaApiKey!,
          what_or: keywords.replace(/\s+OR\s+/gi, " "),
          results_per_page: (options.results_per_page || 25).toString(),
          // Sorting by date pulled almost entirely irrelevant results (whatever
          // was newest across all of Adzuna UK matching any single OR term).
          // Relevance surfaces jobs that actually relate to the search terms.
          sort_by: "relevance",
        });

        // Add optional filters
        if (options.location) params.append("where", options.location);
        if (countryConfig.salaryMin)
          params.append("salary_min", countryConfig.salaryMin.toString());
        if (countryConfig.salaryMax)
          params.append("salary_max", countryConfig.salaryMax.toString());

        const url = `https://api.adzuna.com/v1/api/jobs/${countryConfig.code}/search/1?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            "User-Agent": "EventLink/1.0",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Adzuna (${countryConfig.code}) API error (attempt ${attempt}):`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 429) {
            // Rate limited - wait before retrying
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            // Server error - retry
            continue;
          }

          // Client error - not retryable, fail immediately
          lastError = new Error(
            `Adzuna (${countryConfig.code}) API returned ${response.status} ${response.statusText}: ${errorText}`
          );
          break;
        }

        const data = await response.json();
        console.log(
          `✅ Adzuna (${countryConfig.code}) API returned ${data.results?.length || 0} jobs`
        );

        const jobs = data.results || [];

        return jobs.map(
          (job: AdzunaJobResponse): ExternalJob => ({
            id: `adzuna_${job.id}`,
            title: job.title,
            company: job.company?.display_name || "Company not specified",
            location: job.location?.display_name || "Location not specified",
            description: job.description || "Description not available",
            salary: this.formatAdzunaSalary(
              job.salary_min,
              job.salary_max,
              countryConfig.currencySymbol
            ),
            jobUrl: job.redirect_url,
            postedDate: job.created,
            source: "adzuna",
            employmentType: job.contract_type || job.contract_time,
            categoryTag: job.category?.tag,
            countryCode: countryConfig.code,
            countryDisplayName: countryConfig.displayName,
            currencyCode: countryConfig.currency,
          })
        );
      } catch (error) {
        console.error(`❌ Adzuna (${countryConfig.code}) fetch attempt ${attempt} failed:`, error);
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ All Adzuna (${countryConfig.code}) fetch attempts failed:`, lastError);
    throw (
      lastError ??
      new Error(`Adzuna (${countryConfig.code}) API fetch failed for an unknown reason`)
    );
  }

  /**
   * Fetch from both sources, apply event-industry filtering, and dedupe/limit
   * according to config. Shared by the real sync and the dry-run preview so
   * neither path duplicates the fetch/filter logic.
   */
  private async fetchFilterAndDedupe(config: JobSearchConfig): Promise<{
    finalJobs: ExternalJob[];
    totalFetched: number;
    reedJobCount: number;
    adzunaJobCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let reedJobCount = 0;
    let adzunaJobCount = 0;

    // Surface missing credentials explicitly — fetchReedJobs/fetchAdzunaJobs
    // resolve to [] (not a rejection) when unconfigured, which otherwise looks
    // identical to "API call succeeded but returned zero results".
    if (!this.reedApiKey) {
      errors.push("Reed not configured: REED_API_KEY is not set on this environment");
    }
    if (!this.adzunaApiKey || !this.adzunaAppId) {
      errors.push(
        "Adzuna not configured: ADZUNA_API_KEY/ADZUNA_APP_ID are not set on this environment"
      );
    }

    const enabledCountries = ADZUNA_COUNTRIES.filter((c) => c.enabled);

    // Fetch Reed (UK only) plus one Adzuna call per enabled country
    const [reedJobs, ...adzunaResults] = await Promise.allSettled([
      this.fetchReedJobs(config.reed.keywords, config.reed.location, config.reed.options),
      ...enabledCountries.map((countryConfig) =>
        this.fetchAdzunaJobs(countryConfig, config.adzuna.keywords, config.adzuna.options)
      ),
    ]);

    // Process Reed results
    if (reedJobs.status === "fulfilled") {
      reedJobCount = reedJobs.value.length;
      console.log(`📊 Reed: ${reedJobCount} jobs fetched`);
    } else {
      errors.push(`Reed API failed: ${reedJobs.reason}`);
      console.error("❌ Reed API failed:", reedJobs.reason);
    }

    // Process Adzuna results, one per country
    const adzunaJobsBySource: ExternalJob[] = [];
    adzunaResults.forEach((result, index) => {
      const countryCode = enabledCountries[index].code;
      if (result.status === "fulfilled") {
        adzunaJobCount += result.value.length;
        adzunaJobsBySource.push(...result.value);
      } else {
        errors.push(`Adzuna (${countryCode}) API failed: ${result.reason}`);
      }
    });

    // Combine successful results
    const allJobs: ExternalJob[] = [
      ...(reedJobs.status === "fulfilled" ? reedJobs.value : []),
      ...adzunaJobsBySource,
    ];

    // Apply event industry filtering first, then config limits
    const eventFilteredJobs = filterEventIndustryJobs(allJobs);

    const limitedJobs = config.general.enableDeduplication
      ? this.deduplicateJobs(eventFilteredJobs)
      : eventFilteredJobs;

    const finalJobs = limitedJobs.slice(0, config.general.maxTotalJobs);

    return { finalJobs, totalFetched: allJobs.length, reedJobCount, adzunaJobCount, errors };
  }

  /**
   * Store external jobs in the database with configurable options.
   * With `dryRun: true`, runs the full fetch/filter pipeline against live API
   * data and returns a scored sample without writing anything to the database.
   */
  async syncExternalJobs(
    config: JobSearchConfig = DEFAULT_JOB_CONFIG,
    options: { dryRun?: boolean } = {}
  ): Promise<{
    totalFetched: number;
    newJobsAdded: number;
    reedJobs: number;
    adzunaJobs: number;
    errors: string[];
    dryRun?: boolean;
    sample?: Array<{
      title: string;
      company: string;
      source: string;
      score: number;
      included: boolean;
    }>;
  }> {
    if (this.syncInProgress) {
      console.log("⏸️ Sync already in progress, skipping...");
      return {
        totalFetched: 0,
        newJobsAdded: 0,
        reedJobs: 0,
        adzunaJobs: 0,
        errors: ["Sync already in progress"],
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    let newJobsAdded = 0;

    try {
      const { finalJobs, totalFetched, reedJobCount, adzunaJobCount, errors } =
        await this.fetchFilterAndDedupe(config);

      if (options.dryRun) {
        const sample = finalJobs.slice(0, 20).map((job) => {
          const breakdown = scoreJob(job);
          return {
            title: job.title,
            company: job.company,
            source: job.source,
            score: breakdown.score,
            included: breakdown.included,
          };
        });

        this.lastSyncTime = Date.now();
        console.log(`✅ Dry run completed: ${finalJobs.length} jobs would be synced`);

        return {
          totalFetched,
          newJobsAdded: 0,
          reedJobs: reedJobCount,
          adzunaJobs: adzunaJobCount,
          errors,
          dryRun: true,
          sample,
        };
      }

      // Cross-sync content dedup: the same real-world job is routinely
      // reposted under many different external IDs by different recruitment
      // agencies, so an external_id-only check lets the same job accumulate
      // indefinitely across syncs. Compare against everything already stored
      // using the same title+company+location key deduplicateJobs uses.
      const existingExternalJobs = await storage.getExternalJobs();
      const existingContentKeys = new Set(
        existingExternalJobs.map((j) => this.contentKey(j.title, j.company, j.location))
      );

      // Store jobs in database
      for (const job of finalJobs) {
        const existingJob = await storage.getJobByExternalId(job.id);
        const contentKey = this.contentKey(job.title, job.company, job.location);

        if (!existingJob && !existingContentKeys.has(contentKey)) {
          // Convert external job format to internal job format
          const jobData = {
            recruiter_id: null, // Null for external jobs
            title: job.title,
            company: job.company,
            location: job.location,
            country: job.countryDisplayName,
            currency: job.currencyCode,
            type: "external" as const,
            rate: job.salary || "Not specified",
            description: job.description,
            status: "active" as const,
            external_id: job.id,
            external_source: job.source,
            external_url: job.jobUrl,
            posted_date: job.postedDate,
          };

          await storage.createExternalJob(jobData);
          existingContentKeys.add(contentKey);
          newJobsAdded++;
        }
      }

      this.lastSyncTime = Date.now();
      const duration = (this.lastSyncTime - startTime) / 1000;

      console.log(`✅ Sync completed in ${duration.toFixed(1)}s: ${newJobsAdded} new jobs added`);

      return {
        totalFetched,
        newJobsAdded,
        reedJobs: reedJobCount,
        adzunaJobs: adzunaJobCount,
        errors,
      };
    } catch (error) {
      const errorMessage = `Sync failed: ${error instanceof Error ? error.message : error}`;
      console.error("❌ External job sync failed:", error);

      return {
        totalFetched: 0,
        newJobsAdded: 0,
        reedJobs: 0,
        adzunaJobs: 0,
        errors: [errorMessage],
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  private formatReedSalary(min?: number, max?: number, currency?: string): string {
    if (!min && !max) return "Salary not specified";

    const symbol = currency === "GBP" ? "£" : "¤";

    if (min && max && min !== max) {
      return `${symbol}${min.toLocaleString()} - ${symbol}${max.toLocaleString()}`;
    } else if (min) {
      return `${symbol}${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to ${symbol}${max.toLocaleString()}`;
    }

    return "Salary not specified";
  }

  private formatAdzunaSalary(min?: number, max?: number, currencySymbol = "£"): string {
    if (!min && !max) return "Salary not specified";

    if (min && max && min !== max) {
      return `${currencySymbol}${min.toLocaleString()} - ${currencySymbol}${max.toLocaleString()}`;
    } else if (min) {
      return `${currencySymbol}${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to ${currencySymbol}${max.toLocaleString()}`;
    }

    return "Salary not specified";
  }

  private contentKey(title: string, company: string, location: string): string {
    return `${title.toLowerCase()}_${company.toLowerCase()}_${location.toLowerCase()}`;
  }

  private deduplicateJobs(jobs: ExternalJob[]): ExternalJob[] {
    const seen = new Set<string>();
    const unique: ExternalJob[] = [];

    for (const job of jobs) {
      const key = this.contentKey(job.title, job.company, job.location);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }
}

export const jobAggregator = new JobAggregator();
