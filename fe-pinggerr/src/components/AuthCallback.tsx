import { useEffect, useRef } from "react";
import { useStravaAuth } from "@/hooks/useStravaAuth";

interface AuthCallbackProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({
  onSuccess,
  onError,
}) => {
  const { exchangeCode, isLoading, error } = useStravaAuth();
  const hasAttemptedExchange = useRef(false);

  useEffect(() => {
    // Prevent multiple attempts to exchange the same code
    if (hasAttemptedExchange.current) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const returnedState = urlParams.get("state");
    const error = urlParams.get("error");
    const storedState = sessionStorage.getItem("oauth_state");

    // Debug logging (can be removed in production)
    // console.log("Processing OAuth callback...");

    if (error) {
      onError(`OAuth Error: ${error}`);
      return;
    }

    // Verify state to prevent CSRF / login mix-up
    if (!returnedState || !storedState || returnedState !== storedState) {
      onError("Invalid or missing OAuth state");
      // Clear any stale state
      sessionStorage.removeItem("oauth_state");
      return;
    }

    if (code) {
      hasAttemptedExchange.current = true;
      // Clear state once validated to prevent reuse
      sessionStorage.removeItem("oauth_state");
      exchangeCode(code)
        .then(() => {
          // Small delay to ensure state is updated
          setTimeout(() => {
            onSuccess();
          }, 100);
        })
        .catch((err) => {
          onError(err.message);
        });
    } else {
      onError("No authorization code received");
    }
  }, []); // Empty dependency array since we only want this to run once

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to Strava...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return null;
};
