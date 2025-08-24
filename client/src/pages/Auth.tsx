import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Building2 } from 'lucide-react';

export default function Auth() {
  const { user, signUp, signIn, resendVerificationEmail } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [showDirectLink, setShowDirectLink] = useState<string | null>(null);
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

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  if (user) {
    return <div>Redirecting...</div>;
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
      const { error, message, emailSent, devVerificationUrl } = await signUp(signUpData.email, signUpData.password, signUpData.role);
      
      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Show different messages based on email delivery status
        if (emailSent) {
          toast({
            title: "Registration Successful!",
            description: message || "Please check your email to verify your account before signing in."
          });
        } else {
          toast({
            title: "Registration Successful!",
            description: "Email service is temporarily unavailable. Your verification link will appear below.",
            variant: "default"
          });
          // Log the dev URL for easy access
          if (devVerificationUrl) {
            console.log('🔗 VERIFICATION LINK:', devVerificationUrl);
            console.log('👆 Click the link above to verify your email');
            // Also show it in the UI
            setShowDirectLink(devVerificationUrl);
          }
        }
        
        // Store email for potential resend verification
        setPendingVerificationEmail(signUpData.email);
        setShowResendOption(!emailSent); // Only show resend option if email failed
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
    const { error } = await signIn(signInData.email, signInData.password);
    
    if (error) {
      let description = error.message;
      // Check if it's an email verification error
      if (error.message.includes("verify your email")) {
        description = "Please verify your email address before signing in. Check your email for the verification link.";
        setPendingVerificationEmail(signInData.email);
        setShowResendOption(true);
      }
      toast({
        title: "Sign In Failed",
        description: description,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    
    setLoading(true);
    try {
      const { error, message } = await resendVerificationEmail(pendingVerificationEmail);
      
      if (error) {
        toast({
          title: "Failed to Resend",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Verification Email Sent",
          description: message || "Please check your email for the verification link."
        });
        setShowResendOption(false);
      }
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
            <Tabs defaultValue="signin" className="w-full">
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
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
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
                          <UserCheck className="h-4 w-4 text-primary" />
                          <Label htmlFor="freelancer" className="cursor-pointer">Freelancer</Label>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="recruiter" id="recruiter" />
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-primary" />
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
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
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
          <Card className="mt-4 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-yellow-800 mb-3">
                  Need to verify your email? We can resend the verification link to:
                </p>
                <p className="font-medium text-yellow-900 mb-4">{pendingVerificationEmail}</p>
                <Button 
                  onClick={handleResendVerification}
                  disabled={loading}
                  variant="outline"
                  className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
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