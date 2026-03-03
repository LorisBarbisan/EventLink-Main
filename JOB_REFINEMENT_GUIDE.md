# How to Refine External Job Searches

This guide explains how to customize and refine the jobs fetched from Reed and Adzuna APIs to better match your requirements.

## Quick Start - Using Presets

The easiest way to refine your job searches is to use the built-in presets:

### Available Presets

- **Audio**: Sound engineers, audio technicians, live sound mixing roles
- **Lighting**: Lighting technicians, designers, LED and stage lighting work
- **Video**: Video technicians, AV engineers, projection and broadcast roles
- **High Paying**: Contract positions with £40k+ minimum salary
- **London**: Jobs specifically in the London area

### Using Presets via API

```bash
# Sync jobs with audio preset
curl -X POST http://localhost:3000/api/jobs/sync-preset/audio

# Sync jobs with high-paying preset
curl -X POST http://localhost:3000/api/jobs/sync-preset/highPaying

# Get all available presets
curl http://localhost:3000/api/jobs/presets
```

## Advanced Configuration

For more control, you can customize the job search parameters by editing `server/jobConfig.ts`:

### Reed API Parameters

```typescript
reed: {
  keywords: 'your search terms here',
  location: 'UK', // or specific city like 'London'
  options: {
    resultsToTake: 25, // Max 100
    minimumSalary: 20000, // Annual salary in GBP
    maximumSalary: 80000,
    employmentType: 'contract', // 'permanent', 'contract', 'temp', 'parttime'
    graduate: false, // true for graduate roles only
    postedByRecruitmentAgency: undefined // true/false to filter agencies
  }
}
```

### Adzuna API Parameters

```typescript
adzuna: {
  keywords: 'your search terms here',
  country: 'gb', // Country code (gb=UK, us=USA, au=Australia)
  options: {
    location: 'London', // Optional specific location
    salary_min: 20000, // Annual salary
    salary_max: 80000,
    results_per_page: 25, // Max 50
    contract_type: 'contract' // 'permanent', 'contract', 'part_time', 'temporary'
  }
}
```

### General Settings

```typescript
general: {
  maxTotalJobs: 50, // Total jobs from all sources combined
  enableDeduplication: true // Remove duplicate jobs (same title + company)
}
```

## Effective Search Keywords

### Events Industry Keywords

- **Audio**: `sound engineer`, `audio technician`, `live sound`, `mixing`, `PA system`, `microphone`
- **Lighting**: `lighting technician`, `lighting designer`, `LED`, `moving lights`, `stage lighting`
- **Video/AV**: `video technician`, `AV engineer`, `projection`, `LED screen`, `camera operator`, `broadcast`
- **General**: `events`, `technical crew`, `stage`, `production`, `venue`, `concert`, `conference`

### Combining Keywords

Use specific terms for better results:

```typescript
// Good - specific terms
keywords: "live sound engineer mixing console events";

// Better - industry-specific terms
keywords: "sound engineer live events PA system mixing FOH";

// Best - multiple related terms
keywords: "audio technician sound engineer live events mixing console PA system microphone setup";
```

## Location Targeting

### Reed API Locations

- `UK` - All of United Kingdom
- `London` - London area only
- `Manchester` - Manchester area only
- `Birmingham` - Birmingham area only
- Can use any UK city/region name

### Adzuna API Locations

- Country codes: `gb` (UK), `us` (USA), `au` (Australia), `ca` (Canada)
- Specific locations: `London`, `Manchester`, `Edinburgh`, etc.

## Salary Filtering

### Setting Salary Ranges

```typescript
// Reed API (annual salary in GBP)
minimumSalary: 25000,
maximumSalary: 60000,

// Adzuna API (annual salary)
salary_min: 25000,
salary_max: 60000,
```

### Salary Guidelines by Role

- **Junior Technician**: £18,000 - £25,000
- **Experienced Technician**: £25,000 - £35,000
- **Senior/Lead Tech**: £35,000 - £50,000
- **Specialist/Engineer**: £40,000 - £65,000
- **Contract/Freelance**: £200 - £500+ per day

## Employment Type Filtering

### Reed API Options

- `permanent` - Full-time permanent roles
- `contract` - Fixed-term contracts
- `temp` - Temporary positions
- `parttime` - Part-time work

### Adzuna API Options

- `permanent` - Permanent full-time
- `contract` - Contract work
- `part_time` - Part-time positions
- `temporary` - Temporary roles

## Custom API Requests

You can also send custom configurations via API:

```javascript
// Custom configuration example
const customConfig = {
  reed: {
    keywords: "sound engineer live events",
    location: "London",
    options: {
      resultsToTake: 30,
      minimumSalary: 30000,
      employmentType: "contract",
    },
  },
  adzuna: {
    keywords: "sound engineer live events",
    country: "gb",
    options: {
      location: "London",
      salary_min: 30000,
      results_per_page: 30,
      contract_type: "contract",
    },
  },
  general: {
    maxTotalJobs: 40,
    enableDeduplication: true,
  },
};

// Send to sync endpoint
fetch("/api/jobs/sync-external", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ config: customConfig }),
});
```

## Testing Your Configuration

1. **Edit Configuration**: Modify `server/jobConfig.ts` with your desired settings
2. **Test Sync**: Use the "Sync Jobs" button in the Jobs page or call the API
3. **Review Results**: Check the Jobs page to see if the results match your expectations
4. **Refine**: Adjust keywords, salary ranges, or locations as needed

## API Rate Limits

- **Reed API**: 1,000 requests per day
- **Adzuna API**: 3+ million jobs available, rate limits vary by plan

## Troubleshooting

### No Results Returned

- Check if keywords are too specific
- Try broader location settings (e.g., 'UK' instead of specific city)
- Remove salary filters temporarily
- Verify API keys are configured correctly

### Too Many Irrelevant Results

- Use more specific keywords
- Add employment type filters
- Set appropriate salary ranges
- Enable deduplication
- Reduce `maxTotalJobs` limit

### Duplicate Jobs

- Ensure `enableDeduplication: true` in general settings
- Check if same jobs are coming from both Reed and Adzuna
- Consider filtering by `postedByRecruitmentAgency: false` to reduce agency duplicates

## Example Configurations

### High-End Audio Engineering Jobs

```typescript
{
  reed: {
    keywords: 'senior sound engineer live music touring FOH monitor',
    location: 'UK',
    options: {
      resultsToTake: 20,
      minimumSalary: 35000,
      employmentType: 'permanent'
    }
  }
}
```

### London Contract Lighting Work

```typescript
{
  reed: {
    keywords: 'lighting technician designer LED moving lights',
    location: 'London',
    options: {
      resultsToTake: 25,
      minimumSalary: 40000,
      employmentType: 'contract'
    }
  }
}
```

### Entry-Level AV Positions

```typescript
{
  adzuna: {
    keywords: 'AV technician assistant video projection trainee',
    country: 'gb',
    options: {
      salary_max: 28000,
      results_per_page: 30
    }
  }
}
```
