/**
 * Job Aggregator Configuration
 * Customize these settings to refine the jobs fetched from Reed and Adzuna
 */

export interface JobSearchConfig {
  reed: {
    keywords: string;
    location: string;
    options: {
      resultsToTake: number;
      minimumSalary?: number;
      maximumSalary?: number;
      employmentType?: 'permanent' | 'contract' | 'temp' | 'parttime';
      graduate?: boolean;
      postedByRecruitmentAgency?: boolean;
    };
  };
  adzuna: {
    keywords: string;
    country: string;
    options: {
      location?: string;
      salary_min?: number;
      salary_max?: number;
      results_per_page: number;
      contract_type?: 'permanent' | 'contract' | 'part_time' | 'temporary';
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
    // Keywords to search for on Reed
    keywords: 'events',
    // Geographic area (can be city, region, or country)
    location: 'UK',
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
    }
  },
  
  adzuna: {
    // Keywords to search for on Adzuna
    keywords: 'events',
    // Country code (gb = UK, us = USA, au = Australia, etc.)
    country: 'gb',
    options: {
      // Specific location within country (optional)
      location: undefined, // e.g., 'London' or 'Manchester'
      
      // Salary filters (annual salary)
      salary_min: 20000,
      salary_max: 80000,
      
      // Number of results per page (max 50)
      results_per_page: 25,
      
      // Contract type filter
      contract_type: undefined, // Remove filter to get all types
    }
  },
  
  general: {
    // Maximum total jobs to store from all sources combined
    maxTotalJobs: 50,
    
    // Remove duplicate jobs (same title + company)
    enableDeduplication: true,
  }
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
      keywords: 'sound engineer audio technician live sound mixing PA system microphone',
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      keywords: 'sound engineer audio technician live sound mixing PA system microphone',
    }
  },
  
  // Lighting focused jobs  
  lighting: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      keywords: 'lighting technician lighting designer LED moving lights stage lighting',
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      keywords: 'lighting technician lighting designer LED moving lights stage lighting',
    }
  },
  
  // Video/AV focused jobs
  video: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      keywords: 'video technician AV engineer projection LED screen camera operator broadcast',
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      keywords: 'video technician AV engineer projection LED screen camera operator broadcast',
    }
  },
  
  // High-paying contract work
  highPaying: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      options: {
        ...DEFAULT_JOB_CONFIG.reed.options,
        minimumSalary: 40000,
        employmentType: 'contract',
      }
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      options: {
        ...DEFAULT_JOB_CONFIG.adzuna.options,
        salary_min: 40000,
        contract_type: 'contract',
      }
    }
  },
  
  // London-specific jobs
  london: {
    ...DEFAULT_JOB_CONFIG,
    reed: {
      ...DEFAULT_JOB_CONFIG.reed,
      location: 'London',
    },
    adzuna: {
      ...DEFAULT_JOB_CONFIG.adzuna,
      options: {
        ...DEFAULT_JOB_CONFIG.adzuna.options,
        location: 'London',
      }
    }
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