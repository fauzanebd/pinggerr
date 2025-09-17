const getRedirectUri = () => {
  // For local development, always use localhost
  if (window.location.hostname === "localhost") {
    console.log("Local development");
    return `${window.location.origin}/auth/callback`;
  }

  // For production, use the environment variable or fallback to current origin
  return (
    import.meta.env.VITE_STRAVA_REDIRECT_URI ||
    `${window.location.origin}/auth/callback`
  );
};

export const config = {
  // Cloudflare Worker URL for OAuth handling
  workerUrl: import.meta.env.VITE_WORKER_URL || "http://localhost:8787",

  // Strava OAuth Configuration
  strava: {
    clientId: import.meta.env.VITE_STRAVA_CLIENT_ID || "",
    redirectUri: getRedirectUri(),
    authUrl: "https://www.strava.com/oauth/authorize",
    scope: "read,activity:read_all",
  },

  // Mapbox Configuration
  mapbox: {
    accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "",
  },
} as const;
