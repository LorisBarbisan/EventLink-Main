import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Star, User, DollarSign, Calendar, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';

export default function Freelancers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [, setLocation] = useLocation();

  // Fetch real freelancer profiles from API
  const { data: realFreelancers = [], isLoading } = useQuery({
    queryKey: ['/api/freelancers'],
    queryFn: async () => {
      const response = await fetch('/api/freelancers');
      if (!response.ok) throw new Error('Failed to fetch freelancers');
      const data = await response.json();
      console.log('API response:', data);
      return data;
    }
  });

  // Transform real freelancer data to match display format
  const transformedRealFreelancers = realFreelancers.map((profile: any) => {
    const transformed = {
      id: `real-${profile.user_id}`,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      title: profile.title || 'Event Professional',
      location: profile.location || 'Location not specified',
      experience: profile.experience_years ? `${profile.experience_years} years` : 'Experience not specified',
      rate: profile.hourly_rate ? `£${profile.hourly_rate}/${profile.rate_type || 'hour'}` : 'Rate on request',
      rating: 5.0, // Default rating for real profiles
      availability: profile.availability_status === 'available' ? 'Available' : 
                   profile.availability_status === 'busy' ? 'Busy' : 'Unavailable',
      skills: profile.skills || [],
      bio: profile.bio || 'Professional event crew member',
      recentProjects: Math.floor(Math.random() * 5) + 1, // Random for display
      avatar: profile.profile_photo_url || null,
      isReal: true // Flag to identify real profiles
    };
    console.log('Transformed profile:', transformed);
    return transformed;
  });

  // Mock freelancer data matching EventCrew design
  const mockFreelancers = [
    {
      id: 1,
      name: 'Sarah Johnson',
      title: 'Senior Audio Engineer',
      location: 'London, UK',
      experience: '8 years',
      rate: '£350/day',
      rating: 4.9,
      availability: 'Available',
      skills: ['Sound Engineering', 'Live Events', 'Mixing Consoles', 'Wireless Systems'],
      bio: 'Experienced audio engineer specializing in large-scale corporate events and conferences. Expert in digital mixing consoles and wireless microphone systems.',
      recentProjects: 3,
      avatar: '👩‍💼'
    },
    {
      id: 2,
      name: 'Michael Chen',
      title: 'Lighting Designer & Technician',
      location: 'Manchester, UK',
      experience: '6 years',
      rate: '£280/day',
      rating: 4.8,
      availability: 'Available',
      skills: ['Lighting Design', 'LED Systems', 'Moving Lights', 'Event Production'],
      bio: 'Creative lighting designer with extensive experience in corporate events, exhibitions, and product launches. Specialist in LED technology.',
      recentProjects: 5,
      avatar: '👨‍💻'
    },
    {
      id: 3,
      name: 'Emma Williams',
      title: 'AV Systems Specialist',
      location: 'Birmingham, UK',
      experience: '10 years',
      rate: '£400/day',
      rating: 5.0,
      availability: 'Busy',
      skills: ['AV Systems', 'Project Management', 'Technical Support', 'Video Production'],
      bio: 'Senior AV specialist with project management experience. Proven track record in managing complex multi-day events and exhibitions.',
      recentProjects: 2,
      avatar: '👩‍🎓'
    },
    {
      id: 4,
      name: 'James Thompson',
      title: 'Video Production Specialist',
      location: 'Edinburgh, UK',
      experience: '5 years',
      rate: '£320/day',
      rating: 4.7,
      availability: 'Available',
      skills: ['Video Production', 'Live Streaming', 'Camera Operation', 'Post Production'],
      bio: 'Video production specialist focusing on live streaming and multi-camera setups for corporate events and webinars.',
      recentProjects: 4,
      avatar: '👨‍🎬'
    }
  ].map(freelancer => ({ ...freelancer, id: `mock-${freelancer.id}`, isReal: false })); // Add isReal flag and unique ID

  // Combine real and mock data, with real profiles first
  const allFreelancers = [...transformedRealFreelancers, ...mockFreelancers];
  console.log('All freelancers:', allFreelancers.length, allFreelancers);

  const filteredFreelancers = allFreelancers.filter(freelancer => {
    const matchesSearch = freelancer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         freelancer.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         freelancer.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLocation = !locationFilter || freelancer.location.toLowerCase().includes(locationFilter.toLowerCase());
    const matchesSkill = !skillFilter || skillFilter === 'all' || freelancer.skills.some(skill => skill.toLowerCase().includes(skillFilter.toLowerCase()));
    
    return matchesSearch && matchesLocation && matchesSkill;
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-primary">Find</span> <span className="text-accent">Crew</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Connect with skilled technical professionals for your events. Browse profiles and hire the best crew for your projects.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search & Filter Freelancers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search freelancers, skills, or specializations..."
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
                <Select value={skillFilter} onValueChange={setSkillFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Skill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Skills</SelectItem>
                    <SelectItem value="sound engineering">Sound Engineering</SelectItem>
                    <SelectItem value="lighting design">Lighting Design</SelectItem>
                    <SelectItem value="av systems">AV Systems</SelectItem>
                    <SelectItem value="video production">Video Production</SelectItem>
                    <SelectItem value="stage management">Stage Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Freelancers Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {filteredFreelancers.length} Freelancer{filteredFreelancers.length !== 1 ? 's' : ''} Found
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sort by: Rating</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredFreelancers.map((freelancer) => (
              <Card key={freelancer.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-accent">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-2xl overflow-hidden">
                      {freelancer.isReal && freelancer.avatar && freelancer.avatar.startsWith('data:') ? (
                        <img 
                          src={freelancer.avatar} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{freelancer.avatar || <User className="w-8 h-8 text-white" />}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">
                        {freelancer.name}
                        {freelancer.isReal && (
                          <Badge variant="default" className="ml-2 bg-green-600 text-white text-xs">
                            VERIFIED
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-muted-foreground font-medium">{freelancer.title}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span>{freelancer.rating}</span>
                        </div>
                        <Badge 
                          variant={freelancer.availability === 'Available' ? 'default' : 'secondary'}
                          className={freelancer.availability === 'Available' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {freelancer.availability}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">{freelancer.bio}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {freelancer.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{freelancer.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{freelancer.rate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{freelancer.experience}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{freelancer.recentProjects} recent projects</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button className="bg-gradient-primary hover:bg-primary-hover">
                        Contact
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          if (freelancer.isReal) {
                            // Extract the real user ID from the prefixed ID
                            const userId = freelancer.id.replace('real-', '');
                            setLocation(`/profile/${userId}`);
                          } else {
                            // For mock profiles, show a message or handle differently
                            alert('This is a demo profile. Only verified profiles have detailed pages.');
                          }
                        }}
                      >
                        View Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {filteredFreelancers.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No freelancers found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or check back later for new profiles.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}