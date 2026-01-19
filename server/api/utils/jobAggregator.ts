import { storage } from "../../storage";
import { DEFAULT_JOB_CONFIG, type JobSearchConfig } from "./jobConfig";

// Event industry specific roles to filter for
const EVENT_INDUSTRY_ROLES = [
  "AV technician",
  "lighting technician",
  "lighting engineer",
  "Camera operator",
  "photographer",
  "video mixer",
  "streaming engineer",
  "Powerpoint technician",
  "Stage manager",
];

// Keywords that indicate event industry roles
const EVENT_ROLE_KEYWORDS = [
  // Core specified roles
  "av technician",
  "audio visual",
  "audiovisual technician",
  "event technician",
  "event production",
  "production technician",
  "sound engineer",
  "audio engineer",
  "lighting technician",
  "lighting engineer",
  "lighting operator",
  "video technician",
  "vision mixer",
  "vmix",
  "broadcast technician",
  "live events technician",
  "live events",
  "conference av",
  "technical crew",
  "stage technician",
  "led technician",
  "projection technician",

  // Related technical roles
  "sound technician",
  "audio technician",
  "event crew",
  "event staff",
  "live streaming",
  "live production",
  "production crew",
  "production assistant",
  "technical support",
  "technical coordinator",
  "camera operator",
  "video operator",
  "video mixer",
  "video engineer",
  "streaming engineer",
  "stage manager",
  "stage management",
  "production manager",

  // Equipment and venue specific
  "rigging",
  "staging",
  "set up",
  "conference technician",
  "exhibition",
  "trade show",
  "corporate events",

  // Broadcasting and media
  "video production",
  "live broadcast",
  "streaming technician",
  "media technician",

  // Technical equipment signals (strong positive indicators)
  "mixing desk",
  "pa system",
  "lighting desk",
  "grandma",
  "avolites",
  "led wall",
  "projectors",
  "cameras",
  "signal flow",
  "rf microphones",
  "live stream",
  "vision mixing",
];

// Keywords that indicate NON-event industry roles (catering, hospitality, etc.) that should be excluded
const EXCLUDE_KEYWORDS = [
  // Marketing and sales
  "marketing",
  "digital marketing",
  "brand",
  "brand ambassador",
  "sales",
  "sales executive",
  "promotion",
  "promotional",
  "pr",
  "public relations",
  "social media",
  "content creator",

  // Hospitality and catering
  "hospitality",
  "hotel",
  "restaurant",
  "bar",
  "waiter",
  "waitress",
  "front of house",
  "venue assistant",
  "event host",
  "wedding",
  "festival",
  "catering",
  "chef",
  "head chef",
  "sous chef",
  "cook",
  "kitchen",
  "culinary",
  "food",
  "banquet",
  "menu",
  "dining",
  "bartender",
  "barista",
  "food service",
  "food preparation",
  "pastry chef",

  // Management and coordination roles
  "event manager",
  "events manager",
  "event coordinator",
  "events coordinator",
  "project manager",
  "account manager",
  "client services",

  // Administrative and office roles
  "administrator",
  "assistant",
  "office",
  "hr",
  "human resources",

  // General hospitality services
  "reception",
  "front desk",
  "housekeeping",
  "concierge",
  "guest services",
  "accommodation",
  "booking",

  // Other non-technical roles
  "cleaning",
  "security guard",
  "bouncer",
  "steward",
  "usher",
  "ticket sales",
  "customer service",

  // Marketing/business signals (strong negative indicators)
  "campaign",
  "marketing strategy",
  "kpis",
  "pipeline",
  "lead generation",
  "customer acquisition",
  "content calendar",
];

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
}

export class JobAggregator {
  private reedApiKey: string | undefined;
  private adzunaApiKey: string | undefined;
  private adzunaAppId: string | undefined;

  // Performance: In-memory cache for external jobs (refresh every 30 minutes)
  private jobCache: { data: ExternalJob[]; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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
    console.log(`Reed API key: ${this.reedApiKey ? "CONFIGURED" : "MISSING"}`);
    console.log(`Adzuna API key: ${this.adzunaApiKey ? "CONFIGURED" : "MISSING"}`);
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

    console.log(
      "📅 Starting background sync every",
      this.BACKGROUND_SYNC_INTERVAL / 1000 / 60,
      "minutes"
    );

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
        console.log(`📡 Reed API URL: ${url}`);

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
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            // Server error - retry
            continue;
          }

          // Client error - don't retry
          return [];
        }

        const data = await response.json();
        console.log(`✅ Reed API returned ${data.results?.length || 0} jobs`);

        if (data.results?.length > 0) {
          console.log("📋 Reed sample job:", JSON.stringify(data.results[0], null, 2));
        }

        const jobs = data.results || [];

        return jobs.map(
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
          })
        );
      } catch (error) {
        console.error(`❌ Reed fetch attempt ${attempt} failed:`, error);
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error("❌ All Reed fetch attempts failed:", lastError);
    return [];
  }

  /**
   * Fetch jobs from Adzuna API
   * You can customize these parameters:
   * - keywords: Search terms (default: events-related terms)
   * - country: Country code (default: 'gb' for UK)
   * - location: Specific location within country
   * - salary_min: Minimum salary filter
   * - salary_max: Maximum salary filter
   * - results_per_page: Number of results (max 50, default: 20)
   * - contract_type: 'permanent', 'contract', 'part_time', 'temporary'
   */
  async fetchAdzunaJobs(
    keywords = "AV technician OR event production OR sound engineer OR lighting technician OR video technician OR broadcast technician OR live events",
    country = "gb",
    options: {
      location?: string;
      salary_min?: number;
      salary_max?: number;
      results_per_page?: number;
      contract_type?: string;
    } = {}
  ): Promise<ExternalJob[]> {
    if (!this.adzunaApiKey || !this.adzunaAppId) {
      console.log("❌ Adzuna API credentials not configured");
      return [];
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Adzuna API attempt ${attempt}/${maxRetries}`);

        // Build query parameters
        const params = new URLSearchParams({
          app_id: this.adzunaAppId!,
          app_key: this.adzunaApiKey!,
          what: keywords,
          results_per_page: (options.results_per_page || 25).toString(),
          sort_by: "date", // Get most recent jobs first
        });

        // Add optional filters
        if (options.location) params.append("where", options.location);
        if (options.salary_min) params.append("salary_min", options.salary_min.toString());
        if (options.salary_max) params.append("salary_max", options.salary_max.toString());

        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
        console.log(`📡 Adzuna API URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            "User-Agent": "EventLink/1.0",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Adzuna API error (attempt ${attempt}):`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 429) {
            // Rate limited - wait before retrying
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500) {
            // Server error - retry
            continue;
          }

          // Client error - don't retry
          return [];
        }

        const data = await response.json();
        console.log(`✅ Adzuna API returned ${data.results?.length || 0} jobs`);
        console.log("🔍 Adzuna API full response:", JSON.stringify(data, null, 2));

        if (data.results?.length > 0) {
          console.log("📋 Adzuna sample job:", JSON.stringify(data.results[0], null, 2));
        }

        const jobs = data.results || [];

        return jobs.map(
          (job: AdzunaJobResponse): ExternalJob => ({
            id: `adzuna_${job.id}`,
            title: job.title,
            company: job.company?.display_name || "Company not specified",
            location: job.location?.display_name || "Location not specified",
            description: job.description || "Description not available",
            salary: this.formatAdzunaSalary(job.salary_min, job.salary_max),
            jobUrl: job.redirect_url,
            postedDate: job.created,
            source: "adzuna",
            employmentType: job.contract_type || job.contract_time,
          })
        );
      } catch (error) {
        console.error(`❌ Adzuna fetch attempt ${attempt} failed:`, error);
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error("❌ All Adzuna fetch attempts failed:", lastError);
    return [];
  }

  /**
   * Fetch jobs from all configured sources with customizable parameters
   */
  async fetchAllExternalJobs(
    reedOptions?: Parameters<typeof this.fetchReedJobs>[2],
    adzunaOptions?: Parameters<typeof this.fetchAdzunaJobs>[2]
  ): Promise<ExternalJob[]> {
    // Check cache first for performance
    if (this.jobCache && Date.now() - this.jobCache.timestamp < this.CACHE_DURATION) {
      console.log(`⚡ Returning cached external jobs: ${this.jobCache.data.length} jobs`);
      return this.jobCache.data;
    }

    console.log("Starting fetchAllExternalJobs...");

    const [reedJobs, adzunaJobs] = await Promise.all([
      this.fetchReedJobs(undefined, undefined, reedOptions),
      this.fetchAdzunaJobs(undefined, undefined, adzunaOptions),
    ]);

    console.log(`Reed returned ${reedJobs.length} jobs, Adzuna returned ${adzunaJobs.length} jobs`);

    // Combine and filter for event industry jobs first
    const allJobs = [...reedJobs, ...adzunaJobs];
    console.log(`Combined total: ${allJobs.length} jobs`);

    const eventJobs = this.filterEventIndustryJobs(allJobs);
    console.log(`After filtering for event industry: ${eventJobs.length} jobs`);

    const uniqueJobs = this.deduplicateJobs(eventJobs);
    console.log(`After deduplication: ${uniqueJobs.length} jobs`);

    const finalJobs = uniqueJobs.slice(0, 50);
    console.log(`Final jobs to return: ${finalJobs.length} jobs`);

    // Cache the results for performance
    this.jobCache = {
      data: finalJobs,
      timestamp: Date.now(),
    };

    return finalJobs;
  }

  /**
   * Store external jobs in the database with configurable options
   */
  async syncExternalJobs(config: JobSearchConfig = DEFAULT_JOB_CONFIG): Promise<{
    totalFetched: number;
    newJobsAdded: number;
    reedJobs: number;
    adzunaJobs: number;
    errors: string[];
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
    const errors: string[] = [];
    let newJobsAdded = 0;
    let reedJobCount = 0;
    let adzunaJobCount = 0;

    try {
      console.log("🔄 Starting external job sync...");

      // Fetch jobs with individual tracking
      const [reedJobs, adzunaJobs] = await Promise.allSettled([
        this.fetchReedJobs(config.reed.keywords, config.reed.location, config.reed.options),
        this.fetchAdzunaJobs(config.adzuna.keywords, config.adzuna.country, config.adzuna.options),
      ]);

      // Process Reed results
      if (reedJobs.status === "fulfilled") {
        reedJobCount = reedJobs.value.length;
        console.log(`📊 Reed: ${reedJobCount} jobs fetched`);
      } else {
        errors.push(`Reed API failed: ${reedJobs.reason}`);
        console.error("❌ Reed API failed:", reedJobs.reason);
      }

      // Process Adzuna results
      if (adzunaJobs.status === "fulfilled") {
        adzunaJobCount = adzunaJobs.value.length;
        console.log(`📊 Adzuna: ${adzunaJobCount} jobs fetched`);
      } else {
        errors.push(`Adzuna API failed: ${adzunaJobs.reason}`);
        console.error("❌ Adzuna API failed:", adzunaJobs.reason);
      }

      // Combine successful results
      const allJobs: ExternalJob[] = [
        ...(reedJobs.status === "fulfilled" ? reedJobs.value : []),
        ...(adzunaJobs.status === "fulfilled" ? adzunaJobs.value : []),
      ];

      console.log(`📋 Combined total: ${allJobs.length} jobs before filtering`);

      // Apply event industry filtering first, then config limits
      const eventFilteredJobs = this.filterEventIndustryJobs(allJobs);
      console.log(`🎯 After event filtering: ${eventFilteredJobs.length} jobs`);

      const limitedJobs = config.general.enableDeduplication
        ? this.deduplicateJobs(eventFilteredJobs)
        : eventFilteredJobs;
      console.log(`🔧 After deduplication: ${limitedJobs.length} jobs`);

      const finalJobs = limitedJobs.slice(0, config.general.maxTotalJobs);
      console.log(`✂️ Final jobs to process: ${finalJobs.length} jobs`);

      // Store jobs in database
      for (const job of finalJobs) {
        // Check if job already exists
        const existingJob = await storage.getJobByExternalId(job.id);

        if (!existingJob) {
          // Convert external job format to internal job format
          const jobData = {
            recruiter_id: null, // Null for external jobs
            title: job.title,
            company: job.company,
            location: job.location,
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
          newJobsAdded++;
        }
      }

      this.lastSyncTime = Date.now();
      const duration = (this.lastSyncTime - startTime) / 1000;

      console.log(`✅ Sync completed in ${duration.toFixed(1)}s: ${newJobsAdded} new jobs added`);

      return {
        totalFetched: allJobs.length,
        newJobsAdded,
        reedJobs: reedJobCount,
        adzunaJobs: adzunaJobCount,
        errors,
      };
    } catch (error) {
      const errorMessage = `Sync failed: ${error instanceof Error ? error.message : error}`;
      errors.push(errorMessage);
      console.error("❌ External job sync failed:", error);

      return {
        totalFetched: 0,
        newJobsAdded: 0,
        reedJobs: reedJobCount,
        adzunaJobs: adzunaJobCount,
        errors,
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

  private formatAdzunaSalary(min?: number, max?: number): string {
    if (!min && !max) return "Salary not specified";

    if (min && max && min !== max) {
      return `£${min.toLocaleString()} - £${max.toLocaleString()}`;
    } else if (min) {
      return `£${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to £${max.toLocaleString()}`;
    }

    return "Salary not specified";
  }

  /**
   * Filter jobs to only include event industry roles
   */
  private filterEventIndustryJobs(jobs: ExternalJob[]): ExternalJob[] {
    console.log(`Filtering ${jobs.length} jobs for event industry roles...`);

    const filteredJobs = jobs.filter(job => {
      const titleLower = job.title.toLowerCase();
      const descriptionLower = job.description.toLowerCase();
      const combinedText = `${titleLower} ${descriptionLower}`;

      // First check if job contains excluded keywords (catering, hospitality, etc.)
      const isExcluded = EXCLUDE_KEYWORDS.some(excludeKeyword =>
        combinedText.includes(excludeKeyword.toLowerCase())
      );

      if (isExcluded) {
        console.log(`✗ Excluding job (catering/hospitality): ${job.title} (${job.company})`);
        return false;
      }

      // Then check if job title or description contains event industry keywords
      const isEventRole = EVENT_ROLE_KEYWORDS.some(keyword =>
        combinedText.includes(keyword.toLowerCase())
      );

      if (isEventRole) {
        console.log(`✓ Keeping job: ${job.title} (${job.company})`);
      } else {
        console.log(`✗ Excluding job (not event industry): ${job.title} (${job.company})`);
      }

      return isEventRole;
    });

    console.log(`Filtered down to ${filteredJobs.length} event industry jobs`);
    return filteredJobs;
  }

  private deduplicateJobs(jobs: ExternalJob[]): ExternalJob[] {
    const seen = new Set<string>();
    const unique: ExternalJob[] = [];

    for (const job of jobs) {
      // Create a key based on title + company + location
      const key = `${job.title.toLowerCase()}_${job.company.toLowerCase()}_${job.location.toLowerCase()}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }
}

export const jobAggregator = new JobAggregator();
