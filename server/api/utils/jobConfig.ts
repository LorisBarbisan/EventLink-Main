/**
 * Job Aggregator Configuration
 * Customize these settings to refine the jobs fetched from Reed and Adzuna
 */

export interface AdzunaCountryConfig {
  code: string; // Adzuna's ISO country code, e.g. "gb", "us"
  currency: string; // ISO currency code stored on the job, e.g. "GBP"
  currencySymbol: string; // e.g. "£", "$", "R"
  displayName: string; // e.g. "United Kingdom" — joined into job.location for display
  salaryMin?: number; // local-currency annual salary; omit to skip salary filtering
  salaryMax?: number;
  enabled: boolean; // easy on/off switch per country without deleting config
}

/**
 * Adzuna officially supports these English-speaking markets (confirmed against
 * Adzuna's own API: at, au, be, br, ca, ch, de, es, fr, gb, in, it, mx, nl, nz,
 * pl, sg, us, za — Ireland has no separate country API, it's folded into gb).
 *
 * No salaryMin/salaryMax for the 5 non-UK countries: the UK's £20k-80k band
 * was tuned through real testing, and guessing equivalent bands in 5 other
 * currencies risks silently zeroing out a country's results the same way an
 * earlier bug (Adzuna's `what` param not supporting literal "OR") silently
 * zeroed everything — that failure mode is hard to diagnose. Add bounds later
 * once real per-country results are visible.
 */
export const ADZUNA_COUNTRIES: AdzunaCountryConfig[] = [
  {
    code: "gb",
    currency: "GBP",
    currencySymbol: "£",
    displayName: "United Kingdom",
    salaryMin: 20000,
    salaryMax: 80000,
    enabled: true,
  },
  { code: "us", currency: "USD", currencySymbol: "$", displayName: "United States", enabled: true },
  { code: "au", currency: "AUD", currencySymbol: "$", displayName: "Australia", enabled: true },
  { code: "nz", currency: "NZD", currencySymbol: "$", displayName: "New Zealand", enabled: true },
  { code: "ca", currency: "CAD", currencySymbol: "$", displayName: "Canada", enabled: true },
  { code: "za", currency: "ZAR", currencySymbol: "R", displayName: "South Africa", enabled: true },
];

export interface JoobleCountryConfig {
  location: string; // Free-text location string Jooble expects, e.g. "United Kingdom"
  countryCode: string; // ISO country code stored on the job, e.g. "gb"
  currency: string;
  currencySymbol: string;
  displayName: string;
  enabled: boolean;
}

/**
 * Jooble's `location` param is free text with no ISO country scoping, and
 * live testing showed it's unreliable outside the UK/US (a "South Africa"
 * search returned Pennsylvania/Maryland USA jobs) — so unlike Adzuna and
 * Careerjet, Jooble is intentionally limited to these two markets only.
 */
export const JOOBLE_COUNTRIES: JoobleCountryConfig[] = [
  {
    location: "United Kingdom",
    countryCode: "gb",
    currency: "GBP",
    currencySymbol: "£",
    displayName: "United Kingdom",
    enabled: true,
  },
  {
    location: "United States",
    countryCode: "us",
    currency: "USD",
    currencySymbol: "$",
    displayName: "United States",
    enabled: true,
  },
];

export interface CareerjetCountryConfig {
  localeCode: string; // Careerjet's locale param, e.g. "en_GB"
  countryCode: string; // ISO country code stored on the job, e.g. "gb"
  currency: string;
  currencySymbol: string;
  displayName: string;
  enabled: boolean;
}

/**
 * Careerjet's `locale_code` reliably scopes results by country (confirmed via
 * live testing), so it gets the same 6-country coverage as Adzuna.
 */
export const CAREERJET_COUNTRIES: CareerjetCountryConfig[] = [
  {
    localeCode: "en_GB",
    countryCode: "gb",
    currency: "GBP",
    currencySymbol: "£",
    displayName: "United Kingdom",
    enabled: true,
  },
  {
    localeCode: "en_US",
    countryCode: "us",
    currency: "USD",
    currencySymbol: "$",
    displayName: "United States",
    enabled: true,
  },
  {
    localeCode: "en_AU",
    countryCode: "au",
    currency: "AUD",
    currencySymbol: "$",
    displayName: "Australia",
    enabled: true,
  },
  {
    localeCode: "en_NZ",
    countryCode: "nz",
    currency: "NZD",
    currencySymbol: "$",
    displayName: "New Zealand",
    enabled: true,
  },
  {
    localeCode: "en_CA",
    countryCode: "ca",
    currency: "CAD",
    currencySymbol: "$",
    displayName: "Canada",
    enabled: true,
  },
  {
    localeCode: "en_ZA",
    countryCode: "za",
    currency: "ZAR",
    currencySymbol: "R",
    displayName: "South Africa",
    enabled: true,
  },
];

export interface JobSearchConfig {
  reed: {
    keywords: string;
    location: string;
    options: {
      resultsToTake: number;
      minimumSalary?: number;
      maximumSalary?: number;
      employmentType?: "permanent" | "contract" | "temp" | "parttime";
      graduate?: boolean;
      postedByRecruitmentAgency?: boolean;
    };
  };
  adzuna: {
    keywords: string;
    // Country and salary bounds now live in ADZUNA_COUNTRIES (per-country
    // currency makes a single global salary range meaningless).
    options: {
      location?: string;
      results_per_page: number;
      contract_type?: "permanent" | "contract" | "part_time" | "temporary";
    };
  };
  jooble: {
    // Jooble's keyword matching is erratic for multi-word/OR-joined queries
    // (confirmed via live testing: some 2-word phrases return 0 results while
    // longer OR-joined strings collapse to 0 entirely, with no discoverable
    // AND/OR rule). Each entry here is called separately as its own query and
    // the results are merged, rather than joining them into one string.
    keywords: string[];
    // Countries live in JOOBLE_COUNTRIES (UK + US only, see comment there).
    options: {
      page?: number;
    };
  };
  careerjet: {
    keywords: string;
    // Countries live in CAREERJET_COUNTRIES.
    options: {
      pagesize?: number;
    };
  };
  general: {
    maxTotalJobs: number;
    enableDeduplication: boolean;
  };
}

/**
 * Default job search configuration
 * Modify these values to customize your job searches
 */
export const DEFAULT_JOB_CONFIG: JobSearchConfig = {
  reed: {
    // Keywords to search for on Reed - specific event industry roles
    keywords:
      "AV Technician OR Audio Visual OR Event Technician OR Event Production OR Production Technician OR Sound Engineer OR Audio Engineer OR Lighting Technician OR Video Technician OR Vision Mixer OR vMix OR Broadcast Technician OR Live Events Technician OR Conference AV OR Technical Crew OR Stage Technician OR LED Technician OR Projection Technician",
    // Geographic area (can be city, region, or country)
    location: "UK",
    options: {
      // Number of jobs to fetch (max 100)
      resultsToTake: 25,

      // Salary filters (annual salary in GBP)
      minimumSalary: 20000,
      maximumSalary: 80000,

      // Employment type filter
      employmentType: undefined, // Remove filter to get all types

      // Graduate roles only
      graduate: false,

      // Posted by recruitment agency
      postedByRecruitmentAgency: undefined, // Remove filter to get all
    },
  },

  adzuna: {
    // Keywords to search for on Adzuna - event industry roles
    keywords:
      "AV technician OR event production OR sound engineer OR lighting technician OR video technician OR broadcast technician OR live events",
    options: {
      // Specific location within country (optional)
      location: undefined, // e.g., 'London' or 'Manchester'

      // Number of results per page (max 50)
      results_per_page: 25,

      // Contract type filter
      contract_type: undefined, // Remove filter to get all types
    },
  },

  jooble: {
    // Broad single-word terms for Jooble, called separately (see the
    // JobSearchConfig.jooble.keywords comment for why). Each was confirmed
    // via live testing to return a non-zero, event-industry-relevant result
    // set on its own; precision is handled downstream by filterEventIndustryJobs.
    keywords: [
      "technician",
      "engineer",
      "production",
      "lighting",
      "broadcast",
      "video",
      "sound",
      "events",
      "AV",
    ],
    options: {
      page: undefined,
    },
  },

  careerjet: {
    // Keywords to search for on Careerjet - event industry roles
    keywords:
      "AV technician OR event production OR sound engineer OR lighting technician OR video technician OR broadcast technician OR live events",
    options: {
      pagesize: 25,
    },
  },

  general: {
    // Maximum total jobs to store from all sources combined
    maxTotalJobs: 50,

    // Remove duplicate jobs (same title + company)
    enableDeduplication: true,
  },
};
/**
 * Pre-defined job search configurations for different use cases
 */
export const PRESET_CONFIGS = {
  // Audio/Sound focused jobs
  audio: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      keywords: "sound engineer audio technician live sound mixing PA system microphone",
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      keywords: "sound engineer audio technician live sound mixing PA system microphone",
    },
  },

  // Lighting focused jobs
  lighting: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      keywords: "lighting technician lighting designer LED moving lights stage lighting",
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      keywords: "lighting technician lighting designer LED moving lights stage lighting",
    },
  },

  // Video/AV focused jobs
  video: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      keywords: "video technician AV engineer projection LED screen camera operator broadcast",
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      keywords: "video technician AV engineer projection LED screen camera operator broadcast",
    },
  },

  // High-paying contract work
  highPaying: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      options: {
        ...DEFAULT_JOB_CONFIG.reed.options,
        minimumSalary: 40000,
        employmentType: "contract",
      },
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      options: {
        ...DEFAULT_JOB_CONFIG.adzuna.options,
        contract_type: "contract",
      },
    },
  },

  // London-specific jobs
  london: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      location: "London",
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      options: {
        ...DEFAULT_JOB_CONFIG.adzuna.options,
        location: "London",
      },
    },
  },
};

/**
 * Get job configuration by preset name or return default
 */
export function getJobConfig(preset?: keyof typeof PRESET_CONFIGS): JobSearchConfig {
  if (preset && PRESET_CONFIGS[preset]) {
    return PRESET_CONFIGS[preset];
  }
  return DEFAULT_JOB_CONFIG;
}
