import { useState, useEffect } from "react";
import { config } from "@/config/env";

interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  average_speed: number;
  max_speed: number;
  map?: {
    polyline?: string;
    summary_polyline?: string;
  };
}

export const useStravaAuth = () => {
  const [tokens, setTokens] = useState<StravaTokens | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for stored tokens on mount
  useEffect(() => {
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
        } else {
          // Token expired, try to refresh
          refreshToken(parsed.refresh_token);
        }
      } catch (err) {
        console.error("Error parsing stored tokens:", err);
        localStorage.removeItem("strava_tokens");
      }
    }
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Token exchange error:", err);
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

  // Fetch recent activities
  const fetchActivities = async (
    page = 1,
    perPage = 10
  ): Promise<StravaActivity[]> => {
    if (!tokens?.access_token) {
      throw new Error("No access token available");
    }

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!response.ok) {
      // If unauthorized, try to refresh token
      if (response.status === 401 && tokens.refresh_token) {
        await refreshToken(tokens.refresh_token);
        // Retry after refresh
        return fetchActivities(page, perPage);
      }
      throw new Error("Failed to fetch activities");
    }

    return response.json();
  };

  // Get detailed activity (includes full polyline)
  const fetchActivityDetails = async (
    activityId: number
  ): Promise<StravaActivity> => {
    if (!tokens?.access_token) {
      throw new Error("No access token available");
    }

    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!response.ok) {
      // If unauthorized, try to refresh token
      if (response.status === 401 && tokens.refresh_token) {
        await refreshToken(tokens.refresh_token);
        // Retry after refresh
        return fetchActivityDetails(activityId);
      }
      throw new Error("Failed to fetch activity details");
    }

    return response.json();
  };

  return {
    tokens,
    isAuthenticated: !!tokens,
    isLoading,
    error,
    login,
    logout,
    exchangeCode,
    fetchActivities,
    fetchActivityDetails,
  };
};
