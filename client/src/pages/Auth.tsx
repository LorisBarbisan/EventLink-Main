import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { CheckCircle, Eye, EyeOff, Mail, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SiGoogle, SiLinkedin } from "react-icons/si";
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

  const [signUpData, setSignUpData, clearSignUpData] = usePersistentState("auth_signup", {
    email: "",
    password: "",
    confirmPassword: "",
    role: "freelancer" as "freelancer" | "recruiter",
    acceptedTerms: false,
  });
  const [signInData, setSignInData] = usePersistentState("auth_signin", {
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
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
        clearSignUpData();
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-2xl">
          <Card className="border-border/50 shadow-2xl">
            <CardContent className="p-12">
              <div className="space-y-6 text-center">
                {/* Success Icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                      <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-500" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                      <Mail className="h-7 w-7 text-blue-600 dark:text-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Success Title */}
                <div>
                  <h2 className="mb-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Registration Successful!
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    We&apos;ve sent a verification email to
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {pendingVerificationEmail}
                  </p>
                </div>

                {/* Instructions */}
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
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
                    className="w-full px-8 sm:w-auto"
                    data-testid="button-resend-verification"
                  >
                    {loading ? "Sending..." : "Resend Verification Email"}
                  </Button>
                </div>

                {/* Back to Sign In */}
                <div className="border-t border-border pt-6">
                  <p className="mb-3 text-sm text-muted-foreground">Already verified your email?</p>
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Sticky Flash Banner */}
      {showRateBanner && (
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-yellow-200 bg-yellow-50/95 px-4 py-3 shadow-md backdrop-blur-sm duration-300 animate-in slide-in-from-top-full dark:border-yellow-800 dark:bg-yellow-950/90">
          <div className="container relative mx-auto flex max-w-5xl items-start justify-center gap-3">
            <div className="mt-0.5 hidden shrink-0 sm:block">
              <Star className="h-5 w-5 fill-yellow-600/20 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="max-w-2xl flex-1 text-center sm:text-left">
              <h3 className="mr-2 inline-block text-sm font-semibold text-yellow-900 dark:text-yellow-300 sm:text-base">
                Please sign in to rate
              </h3>
              <p className="inline text-sm text-yellow-800 dark:text-yellow-400 sm:block">
                You need to log in or create an <strong>employer</strong> account to submit a rating
                for this freelancer.
              </p>
            </div>
            <button
              onClick={() => setShowRateBanner(false)}
              className="absolute right-0 top-0 shrink-0 text-yellow-600 transition-colors hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 sm:static"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      )}

      <div className="mt-12 w-full max-w-md sm:mt-0">
        <div className="mb-8 text-center">
          <Button variant="outline" onClick={() => setLocation("/")} className="mb-4">
            ← Back to Home Page
          </Button>
          <p className="text-lg text-muted-foreground">Join the professional events community</p>
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
                      onChange={(e) =>
                        setSignInData((prev) => ({ ...prev, email: e.target.value }))
                      }
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
                        onChange={(e) =>
                          setSignInData((prev) => ({ ...prev, password: e.target.value }))
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
                    className="bg-gradient-primary hover:bg-primary-hover mt-4 w-full py-2 font-semibold text-white"
                    disabled={loading}
                    data-testid="button-signin"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => { window.location.href = "/api/auth/google"; }}
                      data-testid="button-signin-google"
                    >
                      <SiGoogle className="mr-2 h-4 w-4" />
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => { window.location.href = "/api/auth/linkedin"; }}
                      data-testid="button-signin-linkedin"
                    >
                      <SiLinkedin className="mr-2 h-4 w-4 text-[#0A66C2]" />
                      LinkedIn
                    </Button>
                  </div>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setLocation("/forgot-password")}
                      className="hover:text-primary-hover text-sm text-primary underline"
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
                      onValueChange={(value) =>
                        setSignUpData((prev) => ({
                          ...prev,
                          role: value as "freelancer" | "recruiter",
                        }))
                      }
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                        <RadioGroupItem value="freelancer" id="freelancer" />
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-primary">👤</span>
                          <Label htmlFor="freelancer" className="cursor-pointer">
                            Freelancer
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                        <RadioGroupItem value="recruiter" id="recruiter" />
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-primary">🏢</span>
                          <Label htmlFor="recruiter" className="cursor-pointer">
                            Employer
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
                      onChange={(e) =>
                        setSignUpData((prev) => ({ ...prev, email: e.target.value }))
                      }
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
                        onChange={(e) =>
                          setSignUpData((prev) => ({ ...prev, password: e.target.value }))
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
                        onChange={(e) =>
                          setSignUpData((prev) => ({ ...prev, confirmPassword: e.target.value }))
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
                        <p className="text-success text-sm">Passwords match</p>
                      )}
                  </div>

                  {/* Terms and Conditions */}
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={signUpData.acceptedTerms}
                      onCheckedChange={(checked) =>
                        setSignUpData((prev) => ({ ...prev, acceptedTerms: !!checked }))
                      }
                      data-testid="checkbox-terms"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="terms"
                        className="cursor-pointer text-sm font-normal leading-5"
                      >
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => window.open("/terms-of-use.pdf", "_blank")}
                          className="text-primary underline hover:text-primary/80"
                          data-testid="link-terms"
                        >
                          Terms and Conditions
                        </button>
                      </Label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="bg-gradient-primary hover:bg-primary-hover mt-4 w-full py-2 font-semibold text-white"
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

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or sign up with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => { window.location.href = `/api/auth/google?role=${signUpData.role}`; }}
                      data-testid="button-signup-google"
                    >
                      <SiGoogle className="mr-2 h-4 w-4" />
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => { window.location.href = `/api/auth/linkedin?role=${signUpData.role}`; }}
                      data-testid="button-signup-linkedin"
                    >
                      <SiLinkedin className="mr-2 h-4 w-4 text-[#0A66C2]" />
                      LinkedIn
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
                <p className="mb-3 text-sm text-blue-800">
                  Click the verification link below to verify your account:
                </p>
                <div className="mb-4 rounded border border-blue-200 bg-white p-3">
                  <a
                    href={showDirectLink}
                    className="break-all text-sm text-blue-600 underline hover:text-blue-800"
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
                  className="ml-2 text-sm text-blue-600 underline hover:text-blue-800"
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
                <h3 className="mb-2 text-lg font-semibold text-red-800">
                  Email Verification Required
                </h3>
                <p className="mb-3 text-sm text-red-700">
                  Please check your email and click the verification link before signing in.
                </p>
                <p className="mb-3 text-sm text-red-700">
                  Didn&apos;t receive the email? We can resend it to:
                </p>
                <p className="mb-4 font-medium text-red-900">{pendingVerificationEmail}</p>
                <Button
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="bg-red-600 text-white hover:bg-red-700"
                  data-testid="button-resend-verification"
                >
                  {loading ? "Sending..." : "Resend Verification Email"}
                </Button>
                <button
                  onClick={() => setShowResendOption(false)}
                  className="ml-2 text-sm text-yellow-600 underline hover:text-yellow-800"
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
