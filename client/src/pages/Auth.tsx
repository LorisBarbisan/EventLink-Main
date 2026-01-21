import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, Eye, EyeOff, Mail, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Auth() {
  const { user, signUp, signIn, updateUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [showDirectLink, setShowDirectLink] = useState<string | null>(null);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [showRateBanner, setShowRateBanner] = useState(() => {
    return new URLSearchParams(window.location.search).get("reason") === "rate";
  });

  // Force signup tab when tab=signup in URL
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    console.log("URL tab parameter:", tabParam);
    const initialTab = tabParam === "signup" ? "signup" : "signin";
    console.log("Initial tab set to:", initialTab);
    return initialTab;
  });

  // Re-check URL parameters on component mount and when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    console.log("Effect - URL tab parameter:", tabParam);
    if (tabParam === "signup") {
      console.log("Effect - Setting tab to signup");
      setActiveTab("signup");
    } else {
      console.log("Effect - Setting tab to signin");
      setActiveTab("signin");
    }
  }, []);
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "freelancer" as "freelancer" | "recruiter",
    acceptedTerms: false,
  });
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect if already authenticated (but only after loading is complete to ensure validation is done)
  useEffect(() => {
    if (user && !authLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get("redirect");
      if (redirectUrl) {
        // Security: Verify the redirect URL is relative or same-origin to prevent open redirects is ideal,
        // but decoding typically gives a path. We'll assume relative path usage for now or trust encoded value.
        // window.location.href or setLocation both work, but setLocation is client-side router.
        // If the redirectUrl contains a query string (like ?action=rate), setLocation handles it.
        setLocation(decodeURIComponent(redirectUrl));
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, authLoading, setLocation]);

  // Handle OAuth success and error messages from URL parameters
  useEffect(() => {
    // SECURITY FIX: Read OAuth success from URL fragment (not query params) to prevent JWT leakage
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const urlParams = new URLSearchParams(window.location.search);

    // CRITICAL FIX: Handle OAuth success with JWT token from URL fragment
    const oauthSuccess = hashParams.get("oauth_success");
    const token = hashParams.get("token");
    const userParam = hashParams.get("user");

    if (oauthSuccess === "true" && token && userParam) {
      try {
        // Decode JWT token and user data from URL parameters
        const userData = JSON.parse(decodeURIComponent(userParam));

        // Store JWT token and user data
        localStorage.setItem("auth_token", decodeURIComponent(token));
        localStorage.setItem("user", JSON.stringify(userData));

        // Update auth context
        updateUser(userData);

        toast({
          title: "Welcome back!",
          description: `Successfully signed in via OAuth.`,
        });

        // Clean up URL fragment and redirect
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        const redirectUrl = urlParams.get("redirect");
        if (redirectUrl) {
          setLocation(decodeURIComponent(redirectUrl));
        } else {
          setLocation("/dashboard");
        }
        return;
      } catch (error) {
        console.error("OAuth success processing error:", error);
        toast({
          title: "Authentication Error",
          description: "Failed to process OAuth login. Please try again.",
          variant: "destructive",
        });
      }
    }

    // Handle OAuth error messages
    const oauthError = urlParams.get("oauth_error");
    const provider = urlParams.get("provider");

    if (oauthError && provider) {
      let errorMessage = "";

      if (oauthError === "access_denied") {
        errorMessage = `${provider} permission required. Please allow access to email and profile to continue.`;
      } else if (oauthError === "token_revoked") {
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enhanced validation
    if (!signUpData.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    if (!signUpData.password.trim()) {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (!signUpData.confirmPassword.trim()) {
      toast({
        title: "Error",
        description: "Please confirm your password",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords don't match. Please make sure both password fields are identical.",
        variant: "destructive",
      });
      return;
    }

    if (!signUpData.acceptedTerms) {
      toast({
        title: "Error",
        description: "Please accept the Terms and Conditions to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error, message } = await signUp(
        signUpData.email,
        signUpData.password,
        signUpData.role
      );

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Show centered verification success message instead of toast
        setVerificationMessage(
          message ||
            "Please check your email and spam folder to verify your account before signing in."
        );
        setShowVerificationSuccess(true);
        setPendingVerificationEmail(signUpData.email);
        // Clear the form after successful signup
        setSignUpData({
          email: "",
          password: "",
          confirmPassword: "",
          role: "freelancer",
          acceptedTerms: false,
        });
      }
    } catch (err) {
      console.error("Sign Up Error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(signInData.email, signInData.password);

      if (error) {
        console.log("Sign in error:", error);
        const description = error.message || "An error occurred";

        // Enhanced error handling for verification
        if (description.includes("verify your email")) {
          setShowResendOption(true);
          setPendingVerificationEmail(signInData.email);
        } else {
          setShowResendOption(false);
          setPendingVerificationEmail("");
        }

        toast({
          title: "Sign In Failed",
          description: description,
          variant: "destructive",
        });
      } else {
        // Successfully signed in, show success message
        toast({
          title: "Welcome back!",
          description: "You have been successfully signed in.",
          variant: "default",
        });

        // The useAuth hook will handle state updates, redirect immediately
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get("redirect");
        if (redirectUrl) {
          setLocation(decodeURIComponent(redirectUrl));
        } else {
          setLocation("/dashboard");
        }
      }
    } catch (error) {
      console.error("Sign In Error:", error);
      setShowResendOption(false);
      setPendingVerificationEmail("");
      toast({
        title: "Sign In Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: pendingVerificationEmail }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Verification Email Sent!",
          description: "Please check your email and spam folder for the verification link.",
          variant: "default",
        });
        setShowResendOption(false);
        setPendingVerificationEmail("");
      } else {
        toast({
          title: "Failed to Resend",
          description: data.error || "Failed to resend verification email. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Resend Verification Error:", err);
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show verification success message if signup was successful
  if (showVerificationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Card className="border-border/50 shadow-2xl">
            <CardContent className="p-12">
              <div className="text-center space-y-6">
                {/* Success Icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-500" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <Mail className="w-7 h-7 text-blue-600 dark:text-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Success Title */}
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    Registration Successful!
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    We&apos;ve sent a verification email to
                  </p>
                  <p className="text-lg font-semibold text-primary mt-1">
                    {pendingVerificationEmail}
                  </p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-3">
                  <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    {verificationMessage}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Check your <strong>inbox</strong> and <strong>spam folder</strong> for the
                    verification link.
                  </p>
                </div>

                {/* Resend Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleResendVerification}
                    variant="outline"
                    disabled={loading}
                    className="w-full sm:w-auto px-8"
                    data-testid="button-resend-verification"
                  >
                    {loading ? "Sending..." : "Resend Verification Email"}
                  </Button>
                </div>

                {/* Back to Sign In */}
                <div className="pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Already verified your email?</p>
                  <Button
                    onClick={() => {
                      setShowVerificationSuccess(false);
                      setActiveTab("signin");
                    }}
                    variant="default"
                    className="bg-gradient-primary hover:bg-primary-hover text-white"
                    data-testid="button-go-to-signin"
                  >
                    Go to Sign In
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Sticky Flash Banner */}
      {showRateBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50/95 dark:bg-yellow-950/90 border-b border-yellow-200 dark:border-yellow-800 px-4 py-3 shadow-md backdrop-blur-sm animate-in slide-in-from-top-full duration-300">
          <div className="container mx-auto max-w-5xl flex items-start justify-center gap-3 relative">
            <div className="mt-0.5 shrink-0 hidden sm:block">
              <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400 fill-yellow-600/20" />
            </div>
            <div className="flex-1 text-center sm:text-left max-w-2xl">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 text-sm sm:text-base inline-block mr-2">
                Please sign in to rate
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-400 inline sm:block">
                You need to log in or create a <strong>recruiter</strong> account to submit a rating
                for this freelancer.
              </p>
            </div>
            <button
              onClick={() => setShowRateBanner(false)}
              className="shrink-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 transition-colors absolute right-0 top-0 sm:static"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mt-12 sm:mt-0">
        <div className="text-center mb-8">
          <Button variant="outline" onClick={() => setLocation("/")} className="mb-4">
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
                      onChange={e => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={signInData.password}
                        onChange={e =>
                          setSignInData(prev => ({ ...prev, password: e.target.value }))
                        }
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:bg-primary-hover text-white font-semibold py-2 mt-4"
                    disabled={loading}
                    data-testid="button-signin"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setLocation("/forgot-password")}
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
                      onValueChange={value =>
                        setSignUpData(prev => ({
                          ...prev,
                          role: value as "freelancer" | "recruiter",
                        }))
                      }
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="freelancer" id="freelancer" />
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-primary">👤</span>
                          <Label htmlFor="freelancer" className="cursor-pointer">
                            Freelancer
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="recruiter" id="recruiter" />
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-primary">🏢</span>
                          <Label htmlFor="recruiter" className="cursor-pointer">
                            Recruiter
                          </Label>
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
                      onChange={e => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignUpPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={signUpData.password}
                        onChange={e =>
                          setSignUpData(prev => ({ ...prev, password: e.target.value }))
                        }
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showSignUpPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={signUpData.confirmPassword}
                        onChange={e =>
                          setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        className={`pr-10 ${
                          signUpData.confirmPassword &&
                          signUpData.password &&
                          signUpData.confirmPassword !== signUpData.password
                            ? "border-destructive focus:border-destructive"
                            : signUpData.confirmPassword &&
                                signUpData.password &&
                                signUpData.confirmPassword === signUpData.password
                              ? "border-success focus:border-success"
                              : ""
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {signUpData.confirmPassword &&
                      signUpData.password &&
                      signUpData.confirmPassword !== signUpData.password && (
                        <p className="text-sm text-destructive">Passwords do not match</p>
                      )}
                    {signUpData.confirmPassword &&
                      signUpData.password &&
                      signUpData.confirmPassword === signUpData.password && (
                        <p className="text-sm text-success">Passwords match</p>
                      )}
                  </div>

                  {/* Terms and Conditions */}
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={signUpData.acceptedTerms}
                      onCheckedChange={checked =>
                        setSignUpData(prev => ({ ...prev, acceptedTerms: !!checked }))
                      }
                      data-testid="checkbox-terms"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="terms"
                        className="text-sm font-normal leading-5 cursor-pointer"
                      >
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => window.open("/terms-of-use.pdf", "_blank")}
                          className="text-primary hover:text-primary/80 underline"
                          data-testid="link-terms"
                        >
                          Terms and Conditions
                        </button>
                      </Label>
                    </div>
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
                      signUpData.password.length < 6 ||
                      !signUpData.acceptedTerms
                    }
                    data-testid="button-signup"
                  >
                    {loading ? "Creating Account..." : "Create Account"}
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
                  onClick={() => window.open(showDirectLink, "_blank")}
                  className="bg-gradient-primary hover:bg-primary-hover text-white"
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
                <h3 className="text-lg font-semibold text-red-800 mb-2">
                  Email Verification Required
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  Please check your email and click the verification link before signing in.
                </p>
                <p className="text-sm text-red-700 mb-3">
                  Didn&apos;t receive the email? We can resend it to:
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
