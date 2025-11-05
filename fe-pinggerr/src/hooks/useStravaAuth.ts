import { useState, useEffect, useMemo } from "react";
import { config } from "@/config/env";
import type { StravaTokens, StravaActivity } from "@/types/strava";
import {
  StravaApi,
  createStravaApi,
  isTokenRefreshNeeded,
} from "@/lib/stravaApi";

export const useStravaAuth = () => {
  const [tokens, setTokens] = useState<StravaTokens | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create StravaApi instance when tokens are available
  const stravaApi = useMemo(() => createStravaApi(tokens), [tokens]);

  // Function to load tokens from localStorage
  const loadTokensFromStorage = () => {
    const storedTokens = localStorage.getItem("strava_tokens");
    if (storedTokens) {
      try {
        const parsed: StravaTokens = JSON.parse(storedTokens);
        // Check if token is still valid (with 5 minute buffer)
        const expirationTime = parsed.expires_at * 1000;
        const currentTime = Date.now();
        const bufferTime = 5 * 60 * 1000; // 5 minutes

        if (currentTime < expirationTime - bufferTime) {
          setTokens(parsed);
          return true;
        } else {
          // Token expired, try to refresh
          refreshToken(parsed.refresh_token);
          return false;
        }
      } catch (err) {
        console.error("Error parsing stored tokens:", err);
        localStorage.removeItem("strava_tokens");
        return false;
      }
    }
    return false;
  };

  // Check for stored tokens on mount and when localStorage changes
  useEffect(() => {
    loadTokensFromStorage();

    // Listen for storage changes (when tokens are stored in other tabs/components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "strava_tokens") {
        loadTokensFromStorage();
      }
    };

    // Listen for custom auth success event
    const handleAuthSuccess = () => {
      loadTokensFromStorage();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("strava-auth-success", handleAuthSuccess);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("strava-auth-success", handleAuthSuccess);
    };
  }, []);

  // Start OAuth flow
  const login = () => {
    if (!config.strava.clientId) {
      setError("Strava Client ID not configured");
      return;
    }

    const authUrl = new URL(config.strava.authUrl);
    authUrl.searchParams.append("client_id", config.strava.clientId);
    authUrl.searchParams.append("redirect_uri", config.strava.redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", config.strava.scope);
    authUrl.searchParams.append("approval_prompt", "force");
    // CSRF protection: include state parameter
    try {
      const random = crypto.getRandomValues(new Uint8Array(32));
      const state = Array.from(random)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      sessionStorage.setItem("oauth_state", state);
      authUrl.searchParams.append("state", state);
    } catch {
      // If crypto is unavailable for some reason, fall back to a timestamp-based state
      const fallbackState = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      sessionStorage.setItem("oauth_state", fallbackState);
      authUrl.searchParams.append("state", fallbackState);
    }

    console.log("Redirecting to Strava for authentication...");

    window.location.href = authUrl.toString();
  };

  // Exchange authorization code for tokens
  const exchangeCode = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.workerUrl}/exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Token exchange failed");
      }

      const tokenData: StravaTokens = await response.json();
      setTokens(tokenData);
      localStorage.setItem("strava_tokens", JSON.stringify(tokenData));

      // Trigger a custom event to notify other components
      window.dispatchEvent(new CustomEvent("strava-auth-success"));
      // console.log("Authentication successful");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Token exchange error details:", {
        error: err,
        message: errorMessage,
        type: typeof err,
      });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh expired token
  const refreshToken = async (refresh_token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.workerUrl}/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Token refresh failed");
      }

      const tokenData: StravaTokens = await response.json();
      setTokens(tokenData);
      localStorage.setItem("strava_tokens", JSON.stringify(tokenData));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Token refresh error:", err);
      // Clear invalid tokens
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setTokens(null);
    setError(null);
    localStorage.removeItem("strava_tokens");
  };

  // Helper function to handle API calls with automatic token refresh
  const callApiWithRetry = async <T>(
    apiCall: (api: StravaApi) => Promise<T>
  ): Promise<T> => {
    if (!stravaApi) {
      throw new Error("Not authenticated");
    }

    try {
      return await apiCall(stravaApi);
    } catch (error) {
      // If unauthorized and we have a refresh token, try to refresh
      if (
        error instanceof Error &&
        isTokenRefreshNeeded(error) &&
        tokens?.refresh_token
      ) {
        await refreshToken(tokens.refresh_token);

        // Create new API instance with refreshed tokens and retry
        const newTokens = JSON.parse(
          localStorage.getItem("strava_tokens") || "{}"
        );
        const refreshedApi = createStravaApi(newTokens);
        if (!refreshedApi) {
          throw new Error("Failed to refresh authentication");
        }

        return await apiCall(refreshedApi);
      }
      throw error;
    }
  };

  // Fetch recent activities
  const fetchActivities = async (
    page = 1,
    perPage = 10
  ): Promise<StravaActivity[]> => {
    return callApiWithRetry((api) => api.getActivities(page, perPage));
  };

  // Get detailed activity (includes full polyline)
  const fetchActivityDetails = async (
    activityId: number
  ): Promise<StravaActivity> => {
    return callApiWithRetry((api) => api.getActivityDetails(activityId));
  };

  // Fetch lap data for a specific activity
  const fetchActivityLaps = async (activityId: number) => {
    return callApiWithRetry((api) => api.getActivityLaps(activityId));
  };

  // Fetch activity with its lap data
  const fetchActivityWithLaps = async (
    activityId: number
  ): Promise<StravaActivity> => {
    return callApiWithRetry((api) => api.getActivityWithLaps(activityId));
  };

  // Fetch activity streams (trackpoint data)
  const fetchActivityStreams = async (activityId: number) => {
    return callApiWithRetry((api) => api.getActivityStreams(activityId));
  };

  // Fetch activity with trackpoint data
  const fetchActivityWithStreams = async (
    activityId: number
  ): Promise<StravaActivity> => {
    return callApiWithRetry((api) => api.getActivityWithStreams(activityId));
  };

  // Fetch activity with both laps and trackpoint data
  const fetchActivityWithLapsAndStreams = async (
    activityId: number
  ): Promise<StravaActivity> => {
    return callApiWithRetry((api) =>
      api.getActivityWithLapsAndStreams(activityId)
    );
  };

  return {
    tokens,
    isAuthenticated: !!tokens,
    isLoading,
    error,
    login,
    exchangeCode,
    logout,
    fetchActivities,
    fetchActivityDetails,
    fetchActivityLaps,
    fetchActivityWithLaps,
    fetchActivityStreams,
    fetchActivityWithStreams,
    fetchActivityWithLapsAndStreams,
    // Expose the StravaApi instance for advanced usage
    stravaApi,
  };
};
