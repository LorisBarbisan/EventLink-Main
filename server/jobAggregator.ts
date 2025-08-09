import { storage } from './storage';
import { DEFAULT_JOB_CONFIG, type JobSearchConfig } from './jobConfig';

// Event industry specific roles to filter for
const EVENT_INDUSTRY_ROLES = [
  'AV technician',
  'lighting technician', 
  'lighting engineer',
  'Camera operator',
  'photographer',
  'video mixer',
  'streaming engineer',
  'Powerpoint technician',
  'Stage manager'
];

// Keywords that indicate event industry roles
const EVENT_ROLE_KEYWORDS = [
  // Core specified roles
  'av technician', 'audio visual technician', 'audiovisual technician',
  'lighting technician', 'lighting engineer', 'lighting operator',
  'camera operator', 'cameraman', 'video operator',
  'photographer', 'photography', 'photo',
  'video mixer', 'video engineer', 'video technician',
  'streaming engineer', 'stream', 'broadcast engineer',
  'powerpoint technician', 'presentation technician', 'slides technician',
  'stage manager', 'stage management', 'production manager',
  
  // Related technical roles
  'sound engineer', 'audio engineer', 'sound technician', 'audio technician',
  'event technician', 'event crew', 'event staff', 'technical crew',
  'live events', 'live streaming', 'live production',
  'event production', 'production crew', 'production assistant',
  'technical support', 'technical coordinator',
  
  // Equipment and venue specific
  'rigging', 'staging', 'set up', 'audio visual',
  'conference technician', 'exhibition', 'trade show',
  'corporate events', 'wedding photographer', 'event photographer',
  
  // Broadcasting and media
  'vision mixer', 'video production', 'live broadcast',
  'streaming technician', 'media technician', 'broadcast technician'
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
  source: 'reed' | 'adzuna';
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

  constructor() {
    this.reedApiKey = process.env.REED_API_KEY;
    this.adzunaApiKey = process.env.ADZUNA_API_KEY;
    this.adzunaAppId = process.env.ADZUNA_APP_ID;
    
    console.log('JobAggregator initialized:');
    console.log(`Reed API key: ${this.reedApiKey ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`Adzuna API key: ${this.adzunaApiKey ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`Adzuna App ID: ${this.adzunaAppId ? 'CONFIGURED' : 'MISSING'}`);
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
    keywords = 'AV technician OR lighting technician OR camera operator OR photographer OR video mixer OR streaming engineer OR stage manager OR sound engineer', 
    location = 'UK',
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
      console.log('Reed API key not configured');
      return [];
    }

    try {
      // Build query parameters
      const params = new URLSearchParams({
        keywords: keywords,
        locationName: location,
        resultsToTake: (options.resultsToTake || 20).toString()
      });
      
      // Add optional filters
      if (options.minimumSalary) params.append('minimumSalary', options.minimumSalary.toString());
      if (options.maximumSalary) params.append('maximumSalary', options.maximumSalary.toString());
      if (options.employmentType) params.append('employmentType', options.employmentType);
      if (options.graduate !== undefined) params.append('graduate', options.graduate.toString());
      if (options.postedByRecruitmentAgency !== undefined) params.append('postedByRecruitmentAgency', options.postedByRecruitmentAgency.toString());

      console.log(`Reed API URL: https://www.reed.co.uk/api/1.0/search?${params.toString()}`);

      const response = await fetch(
        `https://www.reed.co.uk/api/1.0/search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(this.reedApiKey + ':').toString('base64')}`,
            'User-Agent': 'EventCrew/1.0'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reed API error:', response.status, response.statusText, errorText);
        return [];
      }

      const data = await response.json();
      console.log(`Reed API returned ${data.results?.length || 0} jobs`);
      console.log('Reed API response sample:', JSON.stringify(data, null, 2));
      const jobs = data.results || [];

      return jobs.map((job: ReedJobResponse): ExternalJob => ({
        id: `reed_${job.jobId}`,
        title: job.jobTitle,
        company: job.employerName,
        location: job.locationName,
        description: job.jobDescription,
        salary: this.formatReedSalary(job.minimumSalary, job.maximumSalary, job.currency),
        jobUrl: job.jobUrl,
        postedDate: job.date,
        source: 'reed',
        employmentType: job.employmentType
      }));
    } catch (error) {
      console.error('Error fetching Reed jobs:', error);
      return [];
    }
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
    keywords = 'AV technician lighting technician camera operator photographer video mixer streaming engineer stage manager sound engineer',
    country = 'gb',
    options: {
      location?: string;
      salary_min?: number;
      salary_max?: number;
      results_per_page?: number;
      contract_type?: string;
    } = {}
  ): Promise<ExternalJob[]> {
    if (!this.adzunaApiKey || !this.adzunaAppId) {
      console.log('Adzuna API credentials not configured');
      return [];
    }

    try {
      // Build query parameters  
      const params = new URLSearchParams({
        app_id: this.adzunaAppId!,
        app_key: this.adzunaApiKey!,
        what: keywords,
        results_per_page: (options.results_per_page || 20).toString(),
        'content-type': 'application/json'
      });

      // Add optional filters
      if (options.location) params.append('where', options.location);
      if (options.salary_min) params.append('salary_min', options.salary_min.toString());
      if (options.salary_max) params.append('salary_max', options.salary_max.toString());
      if (options.contract_type) params.append('category', options.contract_type);

      console.log(`Adzuna API URL: https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`);

      const response = await fetch(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Adzuna API error:', response.status, response.statusText, errorText);
        return [];
      }

      const data = await response.json();
      console.log(`Adzuna API returned ${data.results?.length || 0} jobs`);
      console.log('Adzuna API response sample:', JSON.stringify(data, null, 2));
      const jobs = data.results || [];

      return jobs.map((job: AdzunaJobResponse): ExternalJob => ({
        id: `adzuna_${job.id}`,
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name,
        description: job.description,
        salary: this.formatAdzunaSalary(job.salary_min, job.salary_max),
        jobUrl: job.redirect_url,
        postedDate: job.created,
        source: 'adzuna',
        employmentType: job.contract_type
      }));
    } catch (error) {
      console.error('Error fetching Adzuna jobs:', error);
      return [];
    }
  }

  /**
   * Fetch jobs from all configured sources with customizable parameters
   */
  async fetchAllExternalJobs(
    reedOptions?: Parameters<typeof this.fetchReedJobs>[2],
    adzunaOptions?: Parameters<typeof this.fetchAdzunaJobs>[2]
  ): Promise<ExternalJob[]> {
    console.log('Starting fetchAllExternalJobs...');
    
    const [reedJobs, adzunaJobs] = await Promise.all([
      this.fetchReedJobs(undefined, undefined, reedOptions),
      this.fetchAdzunaJobs(undefined, undefined, adzunaOptions)
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
    
    return finalJobs;
  }

  /**
   * Store external jobs in the database with configurable options
   */
  async syncExternalJobs(config: JobSearchConfig = DEFAULT_JOB_CONFIG): Promise<void> {
    try {
      const externalJobs = await this.fetchAllExternalJobs();
      // Apply event industry filtering first, then config limits
      const eventFilteredJobs = this.filterEventIndustryJobs(externalJobs);
      const limitedJobs = config.general.enableDeduplication 
        ? this.deduplicateJobs(eventFilteredJobs)
        : eventFilteredJobs;
      
      const finalJobs = limitedJobs.slice(0, config.general.maxTotalJobs);
      console.log(`Synced ${finalJobs.length} external jobs`);

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
            type: 'external' as const,
            rate: job.salary || 'Not specified',
            description: job.description,
            status: 'active' as const,
            external_id: job.id,
            external_source: job.source,
            external_url: job.jobUrl,
            posted_date: job.postedDate
          };

          await storage.createExternalJob(jobData);
        }
      }

      console.log(`Synced ${externalJobs.length} external jobs`);
    } catch (error) {
      console.error('Error syncing external jobs:', error);
    }
  }

  private formatReedSalary(min?: number, max?: number, currency?: string): string {
    if (!min && !max) return 'Salary not specified';
    
    const symbol = currency === 'GBP' ? '£' : '¤';
    
    if (min && max && min !== max) {
      return `${symbol}${min.toLocaleString()} - ${symbol}${max.toLocaleString()}`;
    } else if (min) {
      return `${symbol}${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to ${symbol}${max.toLocaleString()}`;
    }
    
    return 'Salary not specified';
  }

  private formatAdzunaSalary(min?: number, max?: number): string {
    if (!min && !max) return 'Salary not specified';
    
    if (min && max && min !== max) {
      return `£${min.toLocaleString()} - £${max.toLocaleString()}`;
    } else if (min) {
      return `£${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to £${max.toLocaleString()}`;
    }
    
    return 'Salary not specified';
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
      
      // Check if job title or description contains event industry keywords
      const isEventRole = EVENT_ROLE_KEYWORDS.some(keyword => 
        combinedText.includes(keyword.toLowerCase())
      );
      
      if (isEventRole) {
        console.log(`✓ Keeping job: ${job.title} (${job.company})`);
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