import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { User, MapPin, Coins, Calendar, Globe, Linkedin, ExternalLink, Mail, Phone, Star } from 'lucide-react';

interface Profile {
  id: string;
  role: 'freelancer' | 'recruiter';
  email: string;
}

interface FreelancerProfile {
  id?: string;
  first_name: string;
  last_name: string;
  title: string;
  bio: string;
  location: string;
  hourly_rate: number | null;
  rate_type: 'hourly' | 'daily';
  experience_years: number | null;
  skills: string[];
  portfolio_url: string;
  linkedin_url: string;
  website_url: string;
  availability_status: 'available' | 'busy' | 'unavailable';
  profile_photo_url?: string;
}

interface RecruiterProfile {
  id?: string;
  company_name: string;
  contact_name: string;
  company_type: string;
  company_description: string;
  location: string;
  website_url: string;
  linkedin_url: string;
  phone: string;
  company_logo_url?: string;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { userId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    console.log('Profile useEffect triggered:', { user, authLoading, userId });
    if (!authLoading) {
      if (userId) {
        // Viewing someone else's profile
        console.log('Fetching other profile for userId:', userId);
        setIsOwnProfile(false);
        fetchOtherProfile(userId);
      } else if (user) {
        // Viewing own profile
        console.log('Fetching own profile for user:', user);
        setIsOwnProfile(true);
        fetchProfile();
      } else {
        // Not logged in and no userId specified
        console.log('No user found, redirecting to auth');
        setLocation('/auth');
      }
    }
  }, [user, authLoading, userId, setLocation]);

  const fetchProfile = async () => {
    try {
      console.log('fetchProfile called with user:', user);
      const userProfile: Profile = {
        id: user!.id.toString(),
        role: user!.role as 'freelancer' | 'recruiter',
        email: user!.email
      };
      console.log('Setting profile:', userProfile);
      setProfile(userProfile);

      if (userProfile.role === 'freelancer') {
        try {
          const data = await apiRequest(`/api/freelancer/${userProfile.id}`);
          console.log('Profile data received:', data);
          if (data) {
            setFreelancerProfile({
              id: data.id,
              first_name: data.first_name || '',
              last_name: data.last_name || '',
              title: data.title || '',
              bio: data.bio || '',
              location: data.location || '',
              hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
              rate_type: data.rate_type || 'hourly',
              experience_years: data.experience_years || null,
              skills: data.skills || [],
              portfolio_url: data.portfolio_url || '',
              linkedin_url: data.linkedin_url || '',
              website_url: data.website_url || '',
              availability_status: data.availability_status || 'available',
              profile_photo_url: data.profile_photo_url || ''
            });
            console.log('Freelancer profile set:', freelancerProfile);
          } else {
            console.log('No data received from API');
          }
        } catch (error) {
          console.log('No freelancer profile found:', error);
        }
      } else if (userProfile.role === 'recruiter') {
        try {
          const data = await apiRequest(`/api/recruiter/${userProfile.id}`);
          if (data) {
            setRecruiterProfile({
              id: data.id,
              company_name: data.company_name || '',
              contact_name: data.contact_name || '',
              company_type: data.company_type || '',
              company_description: data.company_description || '',
              location: data.location || '',
              website_url: data.website_url || '',
              linkedin_url: data.linkedin_url || '',
              phone: data.phone || '',
              company_logo_url: data.company_logo_url || ''
            });
          }
        } catch (error) {
          console.log('No recruiter profile found:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherProfile = async (targetUserId: string) => {
    try {
      // First get the user basic info to determine their role
      const userData = await apiRequest(`/api/users/${targetUserId}`);
      const userProfile: Profile = {
        id: targetUserId,
        role: userData.role as 'freelancer' | 'recruiter',
        email: userData.email
      };
      setProfile(userProfile);

      if (userProfile.role === 'freelancer') {
        try {
          const data = await apiRequest(`/api/freelancer/${targetUserId}`);
          if (data) {
            setFreelancerProfile({
              id: data.id,
              first_name: data.first_name || '',
              last_name: data.last_name || '',
              title: data.title || '',
              bio: data.bio || '',
              location: data.location || '',
              hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
              rate_type: data.rate_type || 'hourly',
              experience_years: data.experience_years || null,
              skills: data.skills || [],
              portfolio_url: data.portfolio_url || '',
              linkedin_url: data.linkedin_url || '',
              website_url: data.website_url || '',
              availability_status: data.availability_status || 'available',
              profile_photo_url: data.profile_photo_url || ''
            });
          }
        } catch (error) {
          console.log('No freelancer profile found for user:', error);
        }
      } else if (userProfile.role === 'recruiter') {
        try {
          const data = await apiRequest(`/api/recruiter/${targetUserId}`);
          if (data) {
            setRecruiterProfile({
              id: data.id,
              company_name: data.company_name || '',
              contact_name: data.contact_name || '',
              company_type: data.company_type || '',
              company_description: data.company_description || '',
              location: data.location || '',
              website_url: data.website_url || '',
              linkedin_url: data.linkedin_url || '',
              phone: data.phone || '',
              company_logo_url: data.company_logo_url || ''
            });
          }
        } catch (error) {
          console.log('No recruiter profile found for user:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching other user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
            <Button onClick={() => setLocation('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (profile?.role === 'freelancer' && !freelancerProfile) {
    console.log('No freelancer profile found, showing create profile message');
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
              <User className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Complete Your Profile</h1>
            <p className="text-muted-foreground">
              Create your freelancer profile to start connecting with event organizers.
            </p>
            <Button 
              onClick={() => setLocation('/dashboard')}
              className="bg-gradient-primary hover:bg-primary-hover"
            >
              Create Profile
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (profile?.role === 'recruiter' && !recruiterProfile) {
    console.log('No recruiter profile found, showing create profile message');
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
              <User className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Complete Your Company Profile</h1>
            <p className="text-muted-foreground">
              Create your company profile to start posting jobs and finding talent.
            </p>
            <Button 
              onClick={() => setLocation('/dashboard')}
              className="bg-gradient-primary hover:bg-primary-hover"
            >
              Create Profile
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleContactClick = () => {
    if (profile?.role === 'freelancer' && freelancerProfile) {
      const subject = encodeURIComponent(`EventCrew Inquiry - ${freelancerProfile?.first_name} ${freelancerProfile?.last_name}`);
      const body = encodeURIComponent(`Hi ${freelancerProfile?.first_name},\n\nI found your profile on EventCrew and I'm interested in discussing a potential collaboration for an upcoming event.\n\nPlease let me know your availability.\n\nBest regards`);
      window.open(`mailto:${profile?.email}?subject=${subject}&body=${body}`, '_blank');
    } else if (profile?.role === 'recruiter' && recruiterProfile) {
      const subject = encodeURIComponent(`EventCrew Inquiry - ${recruiterProfile.company_name}`);
      const body = encodeURIComponent(`Hi ${recruiterProfile.contact_name || 'there'},\n\nI found your company profile on EventCrew and I'm interested in discussing potential opportunities.\n\nPlease let me know if you have any suitable positions available.\n\nBest regards`);
      window.open(`mailto:${profile?.email}?subject=${subject}&body=${body}`, '_blank');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-8">
              {profile?.role === 'freelancer' ? (
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden">
                    {freelancerProfile?.profile_photo_url && 
                     freelancerProfile.profile_photo_url.trim() !== '' && 
                     freelancerProfile.profile_photo_url !== 'null' && 
                     freelancerProfile.profile_photo_url.startsWith('data:') ? (
                      <img 
                        src={freelancerProfile.profile_photo_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-16 h-16 text-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">
                          {freelancerProfile?.first_name} {freelancerProfile?.last_name}
                        </h1>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          VERIFIED
                        </Badge>
                      </div>
                      <p className="text-xl text-primary font-semibold mb-2">
                        {freelancerProfile?.title}
                      </p>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {freelancerProfile?.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {freelancerProfile?.experience_years} years experience
                        </div>
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          £{freelancerProfile?.hourly_rate}/{freelancerProfile?.rate_type}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${
                        freelancerProfile?.availability_status === 'available' ? 'bg-green-500' :
                        freelancerProfile?.availability_status === 'busy' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                      <Badge variant="outline" className="capitalize">
                        {freelancerProfile?.availability_status}
                      </Badge>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button 
                        onClick={handleContactClick}
                        className="bg-gradient-primary hover:bg-primary-hover"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Contact
                      </Button>
                      {isOwnProfile && (
                        <Button 
                          variant="outline"
                          onClick={() => setLocation('/dashboard')}
                        >
                          Edit Profile
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden">
                    {recruiterProfile?.company_logo_url && 
                     recruiterProfile.company_logo_url.trim() !== '' && 
                     recruiterProfile.company_logo_url !== 'null' && 
                     recruiterProfile.company_logo_url.startsWith('data:') ? (
                      <img 
                        src={recruiterProfile.company_logo_url} 
                        alt="Company Logo" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-16 h-16 text-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">
                          {recruiterProfile?.company_name}
                        </h1>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          VERIFIED
                        </Badge>
                      </div>
                      <p className="text-xl text-primary font-semibold mb-2">
                        {recruiterProfile?.company_type}
                      </p>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {recruiterProfile?.contact_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {recruiterProfile?.location}
                        </div>
                        {recruiterProfile?.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {recruiterProfile.phone}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button 
                        onClick={handleContactClick}
                        className="bg-gradient-primary hover:bg-primary-hover"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Contact
                      </Button>
                      {isOwnProfile && (
                        <Button 
                          variant="outline"
                          onClick={() => setLocation('/dashboard')}
                        >
                          Edit Profile
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* About Section */}
          <Card>
            <CardHeader>
              <CardTitle>{profile?.role === 'freelancer' ? 'About' : 'Company Description'}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {profile?.role === 'freelancer' 
                  ? (freelancerProfile?.bio || 'No bio available.')
                  : (recruiterProfile?.company_description || 'No company description available.')
                }
              </p>
            </CardContent>
          </Card>

          {/* Skills Section (Freelancers only) */}
          {profile?.role === 'freelancer' && (
            <Card>
              <CardHeader>
                <CardTitle>Skills & Expertise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {freelancerProfile?.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1">
                      {skill}
                    </Badge>
                  ))}
                  {(!freelancerProfile?.skills || freelancerProfile.skills.length === 0) && (
                    <p className="text-muted-foreground">No skills added yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links Section */}
          {((profile?.role === 'freelancer' && (freelancerProfile?.portfolio_url || freelancerProfile?.linkedin_url || freelancerProfile?.website_url)) ||
            (profile?.role === 'recruiter' && (recruiterProfile?.website_url || recruiterProfile?.linkedin_url))) && (
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile?.role === 'freelancer' ? (
                    <>
                      {freelancerProfile?.portfolio_url && (
                        <a 
                          href={freelancerProfile.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Portfolio
                        </a>
                      )}
                      {freelancerProfile?.linkedin_url && (
                        <a 
                          href={freelancerProfile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Linkedin className="w-4 h-4" />
                          LinkedIn
                        </a>
                      )}
                      {freelancerProfile?.website_url && (
                        <a 
                          href={freelancerProfile.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Website
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {recruiterProfile?.website_url && (
                        <a 
                          href={recruiterProfile.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Company Website
                        </a>
                      )}
                      {recruiterProfile?.linkedin_url && (
                        <a 
                          href={recruiterProfile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Linkedin className="w-4 h-4" />
                          LinkedIn
                        </a>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}