export const config = {
  // Cloudflare Worker URL for OAuth handling
  workerUrl: import.meta.env.VITE_WORKER_URL || "http://localhost:8787",

  // Strava OAuth Configuration
  strava: {
    clientId: import.meta.env.VITE_STRAVA_CLIENT_ID || "",
    redirectUri:
      import.meta.env.VITE_STRAVA_REDIRECT_URI ||
      `${window.location.origin}/auth/callback`,
    authUrl: "https://www.strava.com/oauth/authorize",
    scope: "read,activity:read_all",
  },
} as const;
