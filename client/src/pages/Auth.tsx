import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
// Removed unused imports: UserCheck, Building2
import { FaGoogle, FaFacebook, FaLinkedin } from 'react-icons/fa';

export default function Auth() {
  const { user, signUp, signIn, loading: authLoading } = useOptimizedAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [showDirectLink, setShowDirectLink] = useState<string | null>(null);
  
  // Force signup tab when tab=signup in URL
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    console.log('URL tab parameter:', tabParam);
    const initialTab = tabParam === 'signup' ? 'signup' : 'signin';
    console.log('Initial tab set to:', initialTab);
    return initialTab;
  });

  // Re-check URL parameters on component mount and when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    console.log('Effect - URL tab parameter:', tabParam);
    if (tabParam === 'signup') {
      console.log('Effect - Setting tab to signup');
      setActiveTab('signup');
    } else {
      console.log('Effect - Setting tab to signin');
      setActiveTab('signin');
    }
  }, []);
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'freelancer' as 'freelancer' | 'recruiter'
  });
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  // Redirect if already authenticated (but only after loading is complete to ensure validation is done)
  useEffect(() => {
    if (user && !authLoading) {
      setLocation('/dashboard');
    }
  }, [user, authLoading, setLocation]);

  // Handle OAuth error messages from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('oauth_error');
    const provider = urlParams.get('provider');
    const message = urlParams.get('message');

    if (oauthError && provider) {
      let errorMessage = '';
      
      if (oauthError === 'access_denied') {
        errorMessage = `${provider} permission required. Please allow access to email and profile to continue.`;
      } else if (oauthError === 'token_revoked') {
        errorMessage = `${provider} session expired. Please sign in again.`;
      } else {
        errorMessage = `${provider} authentication failed. Please try again.`;
      }

      toast({
        title: "Authentication Notice",
        description: errorMessage,
        variant: "destructive",
      });

      // Clean up URL parameters
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [toast]);

  // Show loading during validation to prevent premature redirects
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading...</p>
      </div>
    </div>;
  }

  if (user) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Redirecting to dashboard...</p>
      </div>
    </div>;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!signUpData.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive"
      });
      return;
    }
    
    if (!signUpData.password.trim()) {
      toast({
        title: "Error", 
        description: "Password is required",
        variant: "destructive"
      });
      return;
    }
    
    if (signUpData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }
    
    if (!signUpData.confirmPassword.trim()) {
      toast({
        title: "Error",
        description: "Please confirm your password",
        variant: "destructive"
      });
      return;
    }
    
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords don't match. Please make sure both password fields are identical.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error, message } = await signUp(signUpData.email, signUpData.password, signUpData.role);
      
      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Registration Successful!",
          description: message || "Please check your email to verify your account before signing in."
        });
        // Clear the form after successful signup
        setSignUpData({
          email: '',
          password: '',
          confirmPassword: '',
          role: 'freelancer'
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Use the useAuth hook's signIn method instead of direct fetch
      const { error } = await signIn(signInData.email, signInData.password);
      
      if (error) {
        console.log('Sign in error:', error);
        const description = error.message || 'An error occurred';
        
        // Enhanced error handling for verification
        if (description.includes('verify your email')) {
          setShowResendOption(true);
          setPendingVerificationEmail(signInData.email);
        } else {
          setShowResendOption(false);
          setPendingVerificationEmail('');
        }
        
        toast({
          title: "Sign In Failed",
          description: description,
          variant: "destructive"
        });
      } else {
        // Successfully signed in, show success message
        toast({
          title: "Welcome back!",
          description: "You have been successfully signed in.",
          variant: "default"
        });
        
        // The useAuth hook will handle state updates, redirect immediately
        setLocation('/dashboard');
      }
    } catch (error) {
      setShowResendOption(false);
      setPendingVerificationEmail('');
      toast({
        title: "Sign In Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive"
      });
    }
    
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    
    setLoading(true);
    try {
      // For now, just show a message since resendVerificationEmail is not in optimized auth
      toast({
        title: "Feature Unavailable",
        description: "Please try signing up again to get a new verification email.",
        variant: "default"
      });
      setShowResendOption(false);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/')}
            className="mb-4"
          >
            ← Back to Home Page
          </Button>
          <p className="text-muted-foreground text-lg">Join the professional events community</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">Get Started</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signInData.email}
                      onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:bg-primary-hover text-white font-semibold py-2 mt-4" 
                    disabled={loading}
                    data-testid="button-signin"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>

                  {/* Social Login Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  {/* Social Login Buttons */}
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-3 py-2"
                      onClick={() => window.location.href = '/api/auth/google'}
                      disabled={loading}
                      data-testid="button-google-signin"
                    >
                      <FaGoogle className="text-red-500" />
                      Continue with Google
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-3 py-2"
                      onClick={() => {
                        // Show configuration message for Facebook
                        toast({
                          title: "Facebook Configuration Required",
                          description: "Please configure your Facebook app domains first. Check console for details.",
                          variant: "destructive",
                        });
                        console.log("Facebook OAuth Configuration Needed:");
                        console.log("1. Go to https://developers.facebook.com/apps/");
                        console.log("2. Select your app → Settings → Basic");
                        console.log("3. Add this domain to 'App Domains':", window.location.hostname);
                        console.log("4. Add this URL to 'Valid OAuth Redirect URIs':", window.location.origin + '/api/auth/facebook/callback');
                        console.log("5. Then try Facebook login again");
                        // Still attempt the OAuth for testing
                        setTimeout(() => {
                          window.location.href = '/api/auth/facebook';
                        }, 3000);
                      }}
                      disabled={loading}
                      data-testid="button-facebook-signin"
                    >
                      <FaFacebook className="text-blue-600" />
                      Continue with Facebook (Configure First)
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-3 py-2"
                      onClick={() => window.location.href = '/api/auth/linkedin'}
                      disabled={loading}
                      data-testid="button-linkedin-signin"
                    >
                      <FaLinkedin className="text-blue-600" />
                      Continue with LinkedIn
                    </Button>

                  </div>
                  
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setLocation('/forgot-password')}
                      className="text-primary hover:text-primary-hover underline text-sm"
                      data-testid="link-forgot-password"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-4">
                    <Label>I want to join as:</Label>
                    <RadioGroup
                      value={signUpData.role}
                      onValueChange={(value) => setSignUpData(prev => ({ ...prev, role: value as 'freelancer' | 'recruiter' }))}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="freelancer" id="freelancer" />
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-primary">👤</span>
                          <Label htmlFor="freelancer" className="cursor-pointer">Freelancer</Label>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="recruiter" id="recruiter" />
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-primary">🏢</span>
                          <Label htmlFor="recruiter" className="cursor-pointer">Recruiter</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className={
                        signUpData.confirmPassword && signUpData.password && signUpData.confirmPassword !== signUpData.password
                          ? "border-destructive focus:border-destructive"
                          : signUpData.confirmPassword && signUpData.password && signUpData.confirmPassword === signUpData.password
                          ? "border-success focus:border-success"
                          : ""
                      }
                      required
                    />
                    {signUpData.confirmPassword && signUpData.password && signUpData.confirmPassword !== signUpData.password && (
                      <p className="text-sm text-destructive">Passwords do not match</p>
                    )}
                    {signUpData.confirmPassword && signUpData.password && signUpData.confirmPassword === signUpData.password && (
                      <p className="text-sm text-success">Passwords match</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:bg-primary-hover text-white font-semibold py-2 mt-4" 
                    disabled={
                      loading || 
                      !signUpData.email.trim() || 
                      !signUpData.password.trim() || 
                      !signUpData.confirmPassword.trim() || 
                      signUpData.password !== signUpData.confirmPassword ||
                      signUpData.password.length < 6
                    }
                    data-testid="button-signup"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>

                  {/* Social Login Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  {/* Social Login Buttons */}
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-3 py-2"
                      onClick={() => window.location.href = '/api/auth/google'}
                      disabled={loading}
                      data-testid="button-google-signup"
                    >
                      <FaGoogle className="text-red-500" />
                      Continue with Google
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-3 py-2"
                      onClick={() => {
                        // Show configuration message for Facebook
                        toast({
                          title: "Facebook Configuration Required",
                          description: "Please configure your Facebook app domains first. Check console for details.",
                          variant: "destructive",
                        });
                        console.log("Facebook OAuth Configuration Needed:");
                        console.log("1. Go to https://developers.facebook.com/apps/");
                        console.log("2. Select your app → Settings → Basic");
                        console.log("3. Add this domain to 'App Domains':", window.location.hostname);
                        console.log("4. Add this URL to 'Valid OAuth Redirect URIs':", window.location.origin + '/api/auth/facebook/callback');
                        console.log("5. Then try Facebook login again");
                        // Still attempt the OAuth for testing
                        setTimeout(() => {
                          window.location.href = '/api/auth/facebook';
                        }, 3000);
                      }}
                      disabled={loading}
                      data-testid="button-facebook-signup"
                    >
                      <FaFacebook className="text-blue-600" />
                      Continue with Facebook (Configure First)
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-3 py-2"
                      onClick={() => window.location.href = '/api/auth/linkedin'}
                      disabled={loading}
                      data-testid="button-linkedin-signup"
                    >
                      <FaLinkedin className="text-blue-600" />
                      Continue with LinkedIn
                    </Button>

                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Direct Verification Link (when email fails) */}
        {showDirectLink && (
          <Card className="mt-4 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-blue-800 mb-3">
                  Click the verification link below to verify your account:
                </p>
                <div className="bg-white p-3 rounded border border-blue-200 mb-4">
                  <a 
                    href={showDirectLink} 
                    className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                    data-testid="link-direct-verification"
                  >
                    {showDirectLink}
                  </a>
                </div>
                <Button 
                  onClick={() => window.open(showDirectLink, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-open-verification"
                >
                  Open Verification Link
                </Button>
                <button
                  onClick={() => setShowDirectLink(null)}
                  className="ml-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  data-testid="button-dismiss-link"
                >
                  Dismiss
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resend Verification Email Option */}
        {showResendOption && pendingVerificationEmail && !showDirectLink && (
          <Card className="mt-4 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Email Verification Required</h3>
                <p className="text-sm text-red-700 mb-3">
                  Please check your email and click the verification link before signing in.
                </p>
                <p className="text-sm text-red-700 mb-3">
                  Didn't receive the email? We can resend it to:
                </p>
                <p className="font-medium text-red-900 mb-4">{pendingVerificationEmail}</p>
                <Button 
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="button-resend-verification"
                >
                  {loading ? "Sending..." : "Resend Verification Email"}
                </Button>
                <button
                  onClick={() => setShowResendOption(false)}
                  className="ml-2 text-sm text-yellow-600 hover:text-yellow-800 underline"
                  data-testid="button-dismiss-resend"
                >
                  Dismiss
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}