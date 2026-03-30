import { useLocation } from "wouter";
import { CheckCircle, XCircle, AlertTriangle, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReferenceVerified() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const method = params.get("method");

  if (status === "success") {
    const isLinkedIn = method === "linkedin";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isLinkedIn ? "LinkedIn Verified!" : "Email Verified!"}
          </h1>
          <p className="text-gray-600 mb-4">
            {isLinkedIn ? (
              <>
                Your LinkedIn profile has been verified. The reference now carries a
                <span className="inline-flex items-center gap-1 text-[#0A66C2] font-medium ml-1">
                  <Linkedin className="w-3.5 h-3.5" /> LinkedIn Verified
                </span> badge.
              </>
            ) : (
              <>
                Your email has been verified. The reference now carries an
                <span className="inline-flex items-center gap-1 text-blue-600 font-medium ml-1">
                  Email Verified
                </span> badge.
              </>
            )}
          </p>
          <div className={`${isLinkedIn ? "bg-blue-50 border-blue-200" : "bg-blue-50 border-blue-200"} border rounded-lg p-4 mb-6`}>
            <p className="text-sm text-blue-800">
              Your reference is now more credible and will stand out to potential employers viewing this freelancer's profile.
            </p>
          </div>
          <div className="border-t pt-6 mt-4">
            <p className="text-gray-600 mb-3 text-sm">
              You're already helping build trust in the events industry. EventLink helps companies find verified crew faster.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setLocation("/about")}
                variant="outline"
                className="w-full"
              >
                Learn About EventLink
              </Button>
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              >
                Sign Up as an Employer
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-4">
            This verification link is invalid or has already been used.
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
          >
            Go to EventLink
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
        <p className="text-gray-600 mb-4">
          We couldn't verify your email. Please try clicking the link again or contact support.
        </p>
        <Button
          onClick={() => setLocation("/")}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
        >
          Go to EventLink
        </Button>
      </div>
    </div>
  );
}
