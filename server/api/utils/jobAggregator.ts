import { createHash } from "crypto";
import { storage } from "../../storage";
import {
  ADZUNA_COUNTRIES,
  CAREERJET_COUNTRIES,
  DEFAULT_JOB_CONFIG,
  JOOBLE_COUNTRIES,
  JSEARCH_COUNTRIES,
  type AdzunaCountryConfig,
  type CareerjetCountryConfig,
  type JobSearchConfig,
  type JoobleCountryConfig,
  type JSearchCountryConfig,
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
  source: "reed" | "adzuna" | "jooble" | "careerjet" | "jsearch";
  employmentType?: string;
  categoryTag?: string; // Adzuna only; undefined for Reed/Jooble/Careerjet/JSearch
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

interface JoobleJobResponse {
  id: number | string;
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string;
}

interface CareerjetJobResponse {
  title: string;
  description: string;
  company: string;
  locations: string;
  url: string;
  date: string;
  salary?: string;
  salary_min?: string;
  salary_max?: string;
  salary_currency_code?: string;
}

interface JSearchJobResponse {
  job_id: string;
  job_title: string;
  employer_name: string | null;
  job_city: string | null;
  job_location: string | null;
  job_country: string | null;
  job_description: string;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_apply_link: string;
  job_posted_at_datetime_utc: string;
  job_employment_type: string | null;
}

export class JobAggregator {
  private reedApiKey: string | undefined;
  private adzunaApiKey: string | undefined;
  private adzunaAppId: string | undefined;
  private joobleApiKey: string | undefined;
  private careerjetApiKey: string | undefined;
  private rapidApiKey: string | undefined;

  // Sync state tracking
  private syncInProgress = false;
  private lastSyncTime: number = 0;
  private readonly BACKGROUND_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private backgroundSyncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.reedApiKey = process.env.REED_API_KEY;
    this.adzunaApiKey = process.env.ADZUNA_API_KEY;
    this.adzunaAppId = process.env.ADZUNA_APP_ID;
    this.joobleApiKey = process.env.JOOBLE_API_KEY;
    this.careerjetApiKey = process.env.CAREERJET_API_KEY;
    this.rapidApiKey = process.env.RAPIDAPI_KEY;

    console.log("🚀 JobAggregator initialized:");
    console.log(`Adzuna App ID: ${this.adzunaAppId ? "CONFIGURED" : "MISSING"}`);
    console.log(`Jooble API Key: ${this.joobleApiKey ? "CONFIGURED" : "MISSING"}`);
    console.log(`Careerjet API Key: ${this.careerjetApiKey ? "CONFIGURED" : "MISSING"}`);
    console.log(`RapidAPI Key (JSearch): ${this.rapidApiKey ? "CONFIGURED" : "MISSING"}`);

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
          // includeJSearch omitted (defaults false): JSearch stays out of the
          // automatic sync to conserve a free-tier RapidAPI credit budget —
          // it only runs on-demand, see the /api/jobs/sync-external route.
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
   * Fetch jobs from Jooble for a single country. Jooble is intentionally
   * limited to UK/US (see JOOBLE_COUNTRIES) since its free-text `location`
   * param isn't reliable for other markets.
   */
  async fetchJoobleJobs(
    countryConfig: JoobleCountryConfig,
    keywords = "technician",
    options: { page?: number } = {}
  ): Promise<ExternalJob[]> {
    if (!this.joobleApiKey) {
      console.log(`❌ Jooble (${countryConfig.countryCode}) API key not configured`);
      return [];
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔍 Jooble (${countryConfig.countryCode}) API attempt ${attempt}/${maxRetries}`
        );

        const response = await fetch(`https://jooble.org/api/${this.joobleApiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "EventLink/1.0",
            Accept: "application/json",
          },
          body: JSON.stringify({
            keywords,
            location: countryConfig.location,
            page: options.page,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Jooble (${countryConfig.countryCode}) API error (attempt ${attempt}):`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 429) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            continue;
          }

          lastError = new Error(
            `Jooble (${countryConfig.countryCode}) API returned ${response.status} ${response.statusText}: ${errorText}`
          );
          break;
        }

        const data = await response.json();
        const results: JoobleJobResponse[] = data.jobs || [];
        console.log(`✅ Jooble (${countryConfig.countryCode}) API returned ${results.length} jobs`);

        return results.map(
          (job: JoobleJobResponse): ExternalJob => ({
            id: `jooble_${job.id}`,
            title: this.stripHtml(job.title),
            company: job.company ? this.stripHtml(job.company) : "Company not specified",
            location: job.location || countryConfig.displayName,
            description: this.stripHtml(job.snippet),
            salary: job.salary ? this.stripHtml(job.salary) : "Salary not specified",
            jobUrl: job.link,
            postedDate: job.updated,
            source: "jooble",
            employmentType: job.type || undefined,
            countryCode: countryConfig.countryCode,
            countryDisplayName: countryConfig.displayName,
            currencyCode: countryConfig.currency,
          })
        );
      } catch (error) {
        console.error(
          `❌ Jooble (${countryConfig.countryCode}) fetch attempt ${attempt} failed:`,
          error
        );
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ All Jooble (${countryConfig.countryCode}) fetch attempts failed:`, lastError);
    throw (
      lastError ??
      new Error(`Jooble (${countryConfig.countryCode}) API fetch failed for an unknown reason`)
    );
  }

  /**
   * Fetch jobs from Careerjet for a single country via its `locale_code`
   * param. HTTP only (Careerjet's public API has no HTTPS endpoint), and
   * requires a Referer header or it returns 403 "Undeclared referrer".
   */
  async fetchCareerjetJobs(
    countryConfig: CareerjetCountryConfig,
    keywords = "AV technician OR event production OR sound engineer OR lighting technician OR video technician OR broadcast technician OR live events",
    options: { pagesize?: number } = {}
  ): Promise<ExternalJob[]> {
    if (!this.careerjetApiKey) {
      console.log(`❌ Careerjet (${countryConfig.countryCode}) API key not configured`);
      return [];
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔍 Careerjet (${countryConfig.countryCode}) API attempt ${attempt}/${maxRetries}`
        );

        const params = new URLSearchParams({
          keywords,
          locale_code: countryConfig.localeCode,
          affid: this.careerjetApiKey!,
          user_ip: "203.0.113.1",
          user_agent: "EventLink/1.0",
          pagesize: (options.pagesize || 25).toString(),
        });

        const url = `http://public.api.careerjet.net/search?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            Referer: "https://eventlink.one",
            "User-Agent": "EventLink/1.0",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Careerjet (${countryConfig.countryCode}) API error (attempt ${attempt}):`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 429) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            continue;
          }

          lastError = new Error(
            `Careerjet (${countryConfig.countryCode}) API returned ${response.status} ${response.statusText}: ${errorText}`
          );
          break;
        }

        const data = await response.json();
        const results: CareerjetJobResponse[] = data.jobs || [];
        console.log(
          `✅ Careerjet (${countryConfig.countryCode}) API returned ${results.length} jobs`
        );

        return results.map((job: CareerjetJobResponse): ExternalJob => {
          const salaryMin = job.salary_min ? parseInt(job.salary_min, 10) : undefined;
          const salaryMax = job.salary_max ? parseInt(job.salary_max, 10) : undefined;

          return {
            // Careerjet doesn't return a stable job ID, so derive one from the
            // job URL (which is stable across a single job's lifetime).
            id: `careerjet_${createHash("md5").update(job.url).digest("hex")}`,
            title: this.stripHtml(job.title),
            company: job.company ? this.stripHtml(job.company) : "Company not specified",
            location: job.locations || countryConfig.displayName,
            description: this.stripHtml(job.description),
            salary: this.formatAdzunaSalary(salaryMin, salaryMax, countryConfig.currencySymbol),
            jobUrl: job.url,
            postedDate: job.date,
            source: "careerjet",
            countryCode: countryConfig.countryCode,
            countryDisplayName: countryConfig.displayName,
            currencyCode: countryConfig.currency,
          };
        });
      } catch (error) {
        console.error(
          `❌ Careerjet (${countryConfig.countryCode}) fetch attempt ${attempt} failed:`,
          error
        );
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(
      `❌ All Careerjet (${countryConfig.countryCode}) fetch attempts failed:`,
      lastError
    );
    throw (
      lastError ??
      new Error(`Careerjet (${countryConfig.countryCode}) API fetch failed for an unknown reason`)
    );
  }

  /**
   * Fetch jobs from JSearch (Google for Jobs, via RapidAPI) for a single
   * country + keyword. JSearch's `country` param alone isn't reliable
   * either — a combined multi-concept query silently ignored it and
   * returned results from an unrelated country in live testing — so the
   * country display name is embedded directly in the free-form `query`
   * text as JSearch's own docs recommend, in addition to the `country` param.
   */
  async fetchJSearchJobs(
    countryConfig: JSearchCountryConfig,
    keyword = "technician",
    options: { numPages?: number } = {}
  ): Promise<ExternalJob[]> {
    if (!this.rapidApiKey) {
      console.log(`❌ JSearch (${countryConfig.countryCode}) API key not configured`);
      return [];
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔍 JSearch (${countryConfig.countryCode}, "${keyword}") API attempt ${attempt}/${maxRetries}`
        );

        const params = new URLSearchParams({
          query: `${keyword} jobs in ${countryConfig.displayName}`,
          country: countryConfig.countryCode,
          num_pages: (options.numPages || 1).toString(),
          date_posted: "all",
        });

        const url = `https://jsearch.p.rapidapi.com/search-v2?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            "x-rapidapi-host": "jsearch.p.rapidapi.com",
            "x-rapidapi-key": this.rapidApiKey!,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ JSearch (${countryConfig.countryCode}, "${keyword}") API error (attempt ${attempt}):`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 429) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            continue;
          }

          lastError = new Error(
            `JSearch (${countryConfig.countryCode}, "${keyword}") API returned ${response.status} ${response.statusText}: ${errorText}`
          );
          break;
        }

        const data = await response.json();
        const results: JSearchJobResponse[] = data.data?.jobs || [];
        console.log(
          `✅ JSearch (${countryConfig.countryCode}, "${keyword}") API returned ${results.length} jobs`
        );

        return results.map(
          (job: JSearchJobResponse): ExternalJob => ({
            id: `jsearch_${job.job_id}`,
            title: job.job_title,
            company: job.employer_name || "Company not specified",
            location: job.job_city || job.job_location || countryConfig.displayName,
            description: job.job_description || "Description not available",
            salary: this.formatAdzunaSalary(
              job.job_min_salary ?? undefined,
              job.job_max_salary ?? undefined,
              countryConfig.currencySymbol
            ),
            jobUrl: job.job_apply_link,
            postedDate: job.job_posted_at_datetime_utc,
            source: "jsearch",
            employmentType: job.job_employment_type || undefined,
            countryCode: countryConfig.countryCode,
            countryDisplayName: countryConfig.displayName,
            currencyCode: countryConfig.currency,
          })
        );
      } catch (error) {
        console.error(
          `❌ JSearch (${countryConfig.countryCode}, "${keyword}") fetch attempt ${attempt} failed:`,
          error
        );
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(
      `❌ All JSearch (${countryConfig.countryCode}, "${keyword}") fetch attempts failed:`,
      lastError
    );
    throw (
      lastError ??
      new Error(
        `JSearch (${countryConfig.countryCode}, "${keyword}") API fetch failed for an unknown reason`
      )
    );
  }

  /**
   * Fetch from both sources, apply event-industry filtering, and dedupe/limit
   * according to config. Shared by the real sync and the dry-run preview so
   * neither path duplicates the fetch/filter logic.
   */
  private async fetchFilterAndDedupe(
    config: JobSearchConfig,
    options: { includeJSearch?: boolean } = {}
  ): Promise<{
    finalJobs: ExternalJob[];
    totalFetched: number;
    reedJobCount: number;
    adzunaJobCount: number;
    joobleJobCount: number;
    careerjetJobCount: number;
    jsearchJobCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let reedJobCount = 0;
    let adzunaJobCount = 0;
    let joobleJobCount = 0;
    let careerjetJobCount = 0;
    let jsearchJobCount = 0;

    // Surface missing credentials explicitly — the fetch*Jobs methods resolve
    // to [] (not a rejection) when unconfigured, which otherwise looks
    // identical to "API call succeeded but returned zero results".
    if (!this.reedApiKey) {
      errors.push("Reed not configured: REED_API_KEY is not set on this environment");
    }
    if (!this.adzunaApiKey || !this.adzunaAppId) {
      errors.push(
        "Adzuna not configured: ADZUNA_API_KEY/ADZUNA_APP_ID are not set on this environment"
      );
    }
    if (!this.joobleApiKey) {
      errors.push("Jooble not configured: JOOBLE_API_KEY is not set on this environment");
    }
    if (!this.careerjetApiKey) {
      errors.push("Careerjet not configured: CAREERJET_API_KEY is not set on this environment");
    }
    if (options.includeJSearch && !this.rapidApiKey) {
      errors.push("JSearch not configured: RAPIDAPI_KEY is not set on this environment");
    }

    const enabledAdzunaCountries = ADZUNA_COUNTRIES.filter((c) => c.enabled);
    const enabledJoobleCountries = JOOBLE_COUNTRIES.filter((c) => c.enabled);
    const enabledCareerjetCountries = CAREERJET_COUNTRIES.filter((c) => c.enabled);
    const enabledJSearchCountries = options.includeJSearch
      ? JSEARCH_COUNTRIES.filter((c) => c.enabled)
      : [];

    // Jooble's keyword matching can't reliably handle a single multi-word/OR
    // query (see JobSearchConfig.jooble.keywords), so it gets one call per
    // country per broad keyword rather than one call per country.
    const joobleCountryKeywordPairs = enabledJoobleCountries.flatMap((countryConfig) =>
      config.jooble.keywords.map((keyword) => ({ countryConfig, keyword }))
    );

    // Same story for JSearch (see JobSearchConfig.jsearch.keywords). Empty
    // when includeJSearch is false — JSearch is excluded from the automatic
    // background sync to stay within a free-tier RapidAPI credit budget, and
    // only runs on-demand (admin dry-run / manual Refresh button).
    const jsearchCountryKeywordPairs = enabledJSearchCountries.flatMap((countryConfig) =>
      config.jsearch.keywords.map((keyword) => ({ countryConfig, keyword }))
    );

    // Fetch Reed (UK only) plus one call per enabled country for Adzuna/
    // Careerjet, and one call per country-keyword pair for Jooble/JSearch,
    // all in one batch. Results are sliced back apart below by each group's
    // known length (Promise.allSettled preserves order).
    const allSettled = await Promise.allSettled([
      this.fetchReedJobs(config.reed.keywords, config.reed.location, config.reed.options),
      ...enabledAdzunaCountries.map((countryConfig) =>
        this.fetchAdzunaJobs(countryConfig, config.adzuna.keywords, config.adzuna.options)
      ),
      ...joobleCountryKeywordPairs.map(({ countryConfig, keyword }) =>
        this.fetchJoobleJobs(countryConfig, keyword, config.jooble.options)
      ),
      ...enabledCareerjetCountries.map((countryConfig) =>
        this.fetchCareerjetJobs(countryConfig, config.careerjet.keywords, config.careerjet.options)
      ),
      ...jsearchCountryKeywordPairs.map(({ countryConfig, keyword }) =>
        this.fetchJSearchJobs(countryConfig, keyword, config.jsearch.options)
      ),
    ]);

    const reedResult = allSettled[0];
    const adzunaResults = allSettled.slice(1, 1 + enabledAdzunaCountries.length);
    const joobleResults = allSettled.slice(
      1 + enabledAdzunaCountries.length,
      1 + enabledAdzunaCountries.length + joobleCountryKeywordPairs.length
    );
    const careerjetResults = allSettled.slice(
      1 + enabledAdzunaCountries.length + joobleCountryKeywordPairs.length,
      1 +
        enabledAdzunaCountries.length +
        joobleCountryKeywordPairs.length +
        enabledCareerjetCountries.length
    );
    const jsearchResults = allSettled.slice(
      1 +
        enabledAdzunaCountries.length +
        joobleCountryKeywordPairs.length +
        enabledCareerjetCountries.length
    );

    // Process Reed results
    if (reedResult.status === "fulfilled") {
      reedJobCount = reedResult.value.length;
      console.log(`📊 Reed: ${reedJobCount} jobs fetched`);
    } else {
      errors.push(`Reed API failed: ${reedResult.reason}`);
      console.error("❌ Reed API failed:", reedResult.reason);
    }

    // Process Adzuna results, one per country
    const adzunaJobsBySource: ExternalJob[] = [];
    adzunaResults.forEach((result, index) => {
      const countryCode = enabledAdzunaCountries[index].code;
      if (result.status === "fulfilled") {
        adzunaJobCount += result.value.length;
        adzunaJobsBySource.push(...result.value);
      } else {
        errors.push(`Adzuna (${countryCode}) API failed: ${result.reason}`);
      }
    });

    // Process Jooble results, one per country-keyword pair
    const joobleJobsBySource: ExternalJob[] = [];
    joobleResults.forEach((result, index) => {
      const { countryConfig, keyword } = joobleCountryKeywordPairs[index];
      if (result.status === "fulfilled") {
        joobleJobCount += result.value.length;
        joobleJobsBySource.push(...result.value);
      } else {
        errors.push(
          `Jooble (${countryConfig.countryCode}, "${keyword}") API failed: ${result.reason}`
        );
      }
    });

    // Process Careerjet results, one per country
    const careerjetJobsBySource: ExternalJob[] = [];
    careerjetResults.forEach((result, index) => {
      const countryCode = enabledCareerjetCountries[index].countryCode;
      if (result.status === "fulfilled") {
        careerjetJobCount += result.value.length;
        careerjetJobsBySource.push(...result.value);
      } else {
        errors.push(`Careerjet (${countryCode}) API failed: ${result.reason}`);
      }
    });

    // Process JSearch results, one per country-keyword pair
    const jsearchJobsBySource: ExternalJob[] = [];
    jsearchResults.forEach((result, index) => {
      const { countryConfig, keyword } = jsearchCountryKeywordPairs[index];
      if (result.status === "fulfilled") {
        jsearchJobCount += result.value.length;
        jsearchJobsBySource.push(...result.value);
      } else {
        errors.push(
          `JSearch (${countryConfig.countryCode}, "${keyword}") API failed: ${result.reason}`
        );
      }
    });

    // Combine successful results
    const allJobs: ExternalJob[] = [
      ...(reedResult.status === "fulfilled" ? reedResult.value : []),
      ...adzunaJobsBySource,
      ...joobleJobsBySource,
      ...careerjetJobsBySource,
      ...jsearchJobsBySource,
    ];

    // Apply event industry filtering first, then config limits
    const eventFilteredJobs = filterEventIndustryJobs(allJobs);

    const limitedJobs = config.general.enableDeduplication
      ? this.deduplicateJobs(eventFilteredJobs)
      : eventFilteredJobs;

    const finalJobs = limitedJobs.slice(0, config.general.maxTotalJobs);

    return {
      finalJobs,
      totalFetched: allJobs.length,
      reedJobCount,
      adzunaJobCount,
      joobleJobCount,
      careerjetJobCount,
      jsearchJobCount,
      errors,
    };
  }

  /**
   * Store external jobs in the database with configurable options.
   * With `dryRun: true`, runs the full fetch/filter pipeline against live API
   * data and returns a scored sample without writing anything to the database.
   */
  async syncExternalJobs(
    config: JobSearchConfig = DEFAULT_JOB_CONFIG,
    options: { dryRun?: boolean; includeJSearch?: boolean } = {}
  ): Promise<{
    totalFetched: number;
    newJobsAdded: number;
    reedJobs: number;
    adzunaJobs: number;
    joobleJobs: number;
    careerjetJobs: number;
    jsearchJobs: number;
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
        joobleJobs: 0,
        careerjetJobs: 0,
        jsearchJobs: 0,
        errors: ["Sync already in progress"],
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    let newJobsAdded = 0;

    try {
      const {
        finalJobs,
        totalFetched,
        reedJobCount,
        adzunaJobCount,
        joobleJobCount,
        careerjetJobCount,
        jsearchJobCount,
        errors,
      } = await this.fetchFilterAndDedupe(config, { includeJSearch: options.includeJSearch });

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
          joobleJobs: joobleJobCount,
          careerjetJobs: careerjetJobCount,
          jsearchJobs: jsearchJobCount,
          errors,
          dryRun: true,
          sample,
        };
      }

      // Cross-sync content dedup: the same real-world job is routinely
      // reposted under many different external IDs by different recruitment
      // agencies, so an external_id-only check lets the same job accumulate
      // indefinitely across syncs. Compare against everything already stored
      // using the same title+description key deduplicateJobs uses.
      const existingExternalJobs = await storage.getExternalJobs();
      const existingContentKeys = new Set(
        existingExternalJobs.map((j) => this.contentKey(j.title, j.description))
      );

      // Store jobs in database
      for (const job of finalJobs) {
        const existingJob = await storage.getJobByExternalId(job.id);
        const contentKey = this.contentKey(job.title, job.description);

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
        joobleJobs: joobleJobCount,
        careerjetJobs: careerjetJobCount,
        jsearchJobs: jsearchJobCount,
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
        joobleJobs: 0,
        careerjetJobs: 0,
        jsearchJobs: 0,
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

  /**
   * Jooble and Careerjet (unlike Reed/Adzuna) return titles/descriptions/
   * salary strings containing raw HTML (`<b>` tags, `&nbsp;`/`&pound;`
   * entities). Left unstripped, this both leaks into the UI and pollutes
   * contentKey's normalized dedup text with literal words like "nbsp"/
   * "pound" that a clean Reed/Adzuna duplicate of the same job wouldn't have.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&pound;/gi, "£")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Keyed on title+description rather than title+company+location: the same
   * real-world job is routinely reposted under near-identical but not
   * identical company/location strings (e.g. "Encore" vs "Encore Global",
   * "Brisbane" vs "Brisbane CBD, Brisbane") by the same agency's multiple
   * Adzuna employer profiles, which let duplicates slip past a
   * company/location-based key entirely. The description text is copy-pasted
   * verbatim across those reposts, making it a far more reliable duplicate
   * signal than company or location ever were.
   *
   * Normalization strips currency symbols and punctuation, since the same
   * underlying ad comes out slightly different per source — a real example:
   * Reed rendered "32,000 - 38,000 + Overtime + Healthcare" while Adzuna
   * rendered "£32,000 - £38,000  Overtime  Healthcare" for the identical job.
   * The description is also compared only on its first 250 normalized
   * characters rather than in full, since Reed and Adzuna truncate the same
   * source text at different lengths — comparing the full string would miss
   * a match that's identical up to whichever source truncated it shorter.
   * Verified against real duplicate postings: both were byte-identical after
   * normalization for at least their first 300 characters.
   */
  private contentKey(title: string, description: string): string {
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[£$€¥]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const descriptionPrefix = normalize(description).slice(0, 250);
    return `${normalize(title)}_${descriptionPrefix}`;
  }

  private deduplicateJobs(jobs: ExternalJob[]): ExternalJob[] {
    const seen = new Set<string>();
    const unique: ExternalJob[] = [];

    for (const job of jobs) {
      const key = this.contentKey(job.title, job.description);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }

  /**
   * One-time cleanup for duplicates that accumulated in the database before
   * the title+description dedup key existed (they were stored under distinct
   * title+company+location keys, e.g. "Encore" vs "Encore Global" for the
   * same verbatim job ad). Groups existing external jobs by the current
   * content key, keeps the oldest row in each group, and deletes the rest.
   */
  async dedupeExistingExternalJobs(): Promise<{
    groupsWithDuplicates: number;
    deletedCount: number;
  }> {
    const existingExternalJobs = await storage.getExternalJobs();

    const groups = new Map<string, typeof existingExternalJobs>();
    for (const job of existingExternalJobs) {
      const key = this.contentKey(job.title, job.description);
      const group = groups.get(key);
      if (group) {
        group.push(job);
      } else {
        groups.set(key, [job]);
      }
    }

    let groupsWithDuplicates = 0;
    let deletedCount = 0;

    for (const group of Array.from(groups.values())) {
      if (group.length <= 1) continue;
      groupsWithDuplicates++;

      const sortedByOldestFirst = [...group].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const duplicatesToRemove = sortedByOldestFirst.slice(1);

      for (const duplicate of duplicatesToRemove) {
        await storage.deleteJob(duplicate.id);
        deletedCount++;
      }
    }

    console.log(
      `🧹 Dedup cleanup: ${groupsWithDuplicates} duplicate groups found, ${deletedCount} jobs removed`
    );

    return { groupsWithDuplicates, deletedCount };
  }
}

export const jobAggregator = new JobAggregator();
