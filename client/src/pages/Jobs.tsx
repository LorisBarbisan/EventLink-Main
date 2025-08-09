import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Search, MapPin, Clock, Coins, Calendar, Filter, RefreshCw } from 'lucide-react';

export default function Jobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Fetch real jobs data from API
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      return data;
    }
  });

  // Sync external jobs mutation
  const syncExternalJobsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/jobs/sync-external', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: 'Jobs synced',
        description: 'Latest jobs from Reed and Adzuna have been fetched.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync external jobs.',
        variant: 'destructive',
      });
    },
  });

  // Mock jobs data as fallback for demonstration  
  const mockJobs = [
    {
      id: 'mock-1',
      title: 'Audio Engineer - Tech Conference',
      company: 'EventTech Solutions',
      location: 'London, UK',
      type: 'Freelance',
      contract_type: 'Gig',
      duration: '3 days',
      rate: '£350/day',
      posted: '2 days ago',
      category: 'Audio',
      description: 'Seeking experienced audio engineer for major tech conference. Must have experience with large venue sound systems.',
      skills: ['Sound Engineering', 'Live Events', 'Mixing Consoles']
    },
    {
      id: 'mock-2',
      title: 'Lighting Technician - Corporate Event',
      company: 'Bright Events Ltd',
      location: 'Manchester, UK',
      type: 'Contract', 
      contract_type: 'Fixed term',
      duration: '1 week',
      rate: '£280/day',
      posted: '1 day ago',
      category: 'Lighting',
      description: 'Corporate event lighting setup and operation. Experience with LED systems required.',
      skills: ['Lighting Design', 'LED Systems', 'Event Production']
    },
    {
      id: 'mock-3',
      title: 'AV Specialist - Exhibition',
      company: 'ExpoTech Events',
      location: 'Birmingham, UK',
      type: 'Freelance',
      contract_type: 'Temporary',
      duration: '5 days',
      rate: '£400/day',
      posted: '3 hours ago',
      category: 'AV',
      description: 'Multi-day exhibition requiring AV setup, monitoring, and breakdown. Leadership experience preferred.',
      skills: ['AV Systems', 'Project Management', 'Technical Support']
    }
  ];

  // Transform real jobs to ensure unique IDs and consistent format
  const transformedRealJobs = jobs.map((job: any) => ({
    ...job,
    id: `real-${job.id}`,
    posted: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recently posted'
  }));

  // Use real jobs data first, then mock data for demonstration
  const jobsToShow = [...transformedRealJobs, ...mockJobs];
  
  // Debug: Force render with known data if API data exists
  const displayJobs = isLoading ? [] : jobsToShow;
  
  const filteredJobs = displayJobs.filter((job: any) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase());
    // Filter by contract type instead of job type
    const jobContractType = job.contract_type || job.employmentType || job.type || 'Gig';
    const matchesCategory = !categoryFilter || categoryFilter === 'all' || jobContractType === categoryFilter;
    
    return matchesSearch && matchesLocation && matchesCategory;
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-primary">Find</span> <span className="text-accent">Jobs</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Discover exciting opportunities in the events industry. Connect with top companies looking for technical crew.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search & Filter Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search jobs, companies, or skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Input
                  placeholder="Location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>
              <div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Contract Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contract Types</SelectItem>
                    <SelectItem value="Full-Time">Full-Time</SelectItem>
                    <SelectItem value="Part-Time">Part-Time</SelectItem>
                    <SelectItem value="Fixed term">Fixed term</SelectItem>
                    <SelectItem value="Temporary">Temporary</SelectItem>
                    <SelectItem value="Gig">Gig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {filteredJobs.length} Job{filteredJobs.length !== 1 ? 's' : ''} Found
            </h2>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => syncExternalJobsMutation.mutate()}
                disabled={syncExternalJobsMutation.isPending}
                size="sm"
                variant="outline"
                data-testid="button-sync-jobs"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncExternalJobsMutation.isPending ? 'animate-spin' : ''}`} />
                {syncExternalJobsMutation.isPending ? 'Syncing...' : 'Sync Jobs'}
              </Button>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sort by: Most Recent</span>
              </div>
            </div>
          </div>

          {filteredJobs.map((job: any) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{job.title}</CardTitle>
                    <p className="text-muted-foreground font-medium">{job.company}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {job.type}
                    </Badge>
                    {job.external_source && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        {job.external_source}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">{job.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <span>{job.rate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : job.posted}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    {job.external_url ? (
                      <Button asChild className="bg-gradient-primary hover:bg-primary-hover">
                        <a href={job.external_url} target="_blank" rel="noopener noreferrer">
                          Apply on {job.external_source}
                        </a>
                      </Button>
                    ) : (
                      <Button className="bg-gradient-primary hover:bg-primary-hover">
                        Apply Now
                      </Button>
                    )}
                    <Button variant="outline">
                      Save Job
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            ))
          }


        </div>
      </div>
    </Layout>
  );
}