import { useEffect } from "react";
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const error = urlParams.get("error");

    if (error) {
      onError(`OAuth Error: ${error}`);
      return;
    }

    if (code) {
      exchangeCode(code)
        .then(() => {
          // Clear URL parameters
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
          onSuccess();
        })
        .catch((err) => {
          onError(err.message);
        });
    } else {
      onError("No authorization code received");
    }
  }, [exchangeCode, onSuccess, onError]);

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
