/**
 * TanStack Query Client Configuration
 * Optimized for Strava API rate limits with aggressive caching
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Create a Query Client with optimized caching settings for Strava API
 *
 * Strategy:
 * - Activity details are cached for 1 hour (they rarely change)
 * - Activity list is cached for 5 minutes (to show recent activities)
 * - Use stale-while-revalidate pattern for better UX
 * - Persist cache to localStorage for cross-session caching
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data in cache even when no components are using it
      gcTime: 1000 * 60 * 60 * 2, // 2 hours
      // How long before data is considered stale
      staleTime: 1000 * 60 * 5, // 5 minutes default
      // Retry on failure (but not for rate limit errors)
      retry: (failureCount, error) => {
        // Don't retry rate limit errors
        if (
          error instanceof Error &&
          error.message.startsWith("RATE_LIMIT_EXCEEDED")
        ) {
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
      // Refetch in background when window regains focus
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data is still fresh
      refetchOnMount: false,
      // Refetch on reconnect
      refetchOnReconnect: "always",
    },
  },
});

/**
 * Persist cache keys to localStorage for long-term caching
 */
export const CACHE_KEYS = {
  activities: "strava_activities",
  activityDetails: (id: number) => `strava_activity_${id}`,
} as const;

/**
 * Save activity to localStorage for persistent caching
 */
export function persistActivityToLocalStorage(
  activityId: number,
  data: unknown
) {
  try {
    const key = CACHE_KEYS.activityDetails(activityId);
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.warn("Failed to persist activity to localStorage:", error);
  }
}

/**
 * Load activity from localStorage
 * Returns null if not found or if data is older than maxAge
 */
export function loadActivityFromLocalStorage(
  activityId: number,
  maxAge = 1000 * 60 * 60 * 24
): unknown | null {
  try {
    const key = CACHE_KEYS.activityDetails(activityId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const age = Date.now() - parsed.timestamp;

    // Return null if data is too old
    if (age > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn("Failed to load activity from localStorage:", error);
    return null;
  }
}

/**
 * Check if cached activity details are stale by comparing with activity list entry
 * This handles cases where user updates activity on Strava (title, distance, etc.)
 *
 * @param cachedActivity - The cached activity details
 * @param listActivity - The activity from the activity list (fresher data)
 * @returns true if cached data is stale and should be refetched
 */
export function isCachedActivityStale(
  cachedActivity: any,
  listActivity: any
): boolean {
  if (!cachedActivity || !listActivity) return true;

  // Compare key fields that users commonly update
  const titleChanged = cachedActivity.name !== listActivity.name;
  const distanceChanged = cachedActivity.distance !== listActivity.distance;
  const timeChanged = cachedActivity.moving_time !== listActivity.moving_time;

  // If any of these changed, the cache is stale
  if (titleChanged || distanceChanged || timeChanged) {
    console.log("Cached activity is stale:", {
      titleChanged,
      distanceChanged,
      timeChanged,
      cached: {
        name: cachedActivity.name,
        distance: cachedActivity.distance,
        moving_time: cachedActivity.moving_time,
      },
      fresh: {
        name: listActivity.name,
        distance: listActivity.distance,
        moving_time: listActivity.moving_time,
      },
    });
    return true;
  }

  return false;
}

/**
 * Clear old cached activities from localStorage (cleanup utility)
 */
export function clearOldActivityCache(maxAge = 1000 * 60 * 60 * 24 * 7) {
  try {
    const keys = Object.keys(localStorage);
    const activityKeys = keys.filter((key) =>
      key.startsWith("strava_activity_")
    );

    for (const key of activityKeys) {
      const stored = localStorage.getItem(key);
      if (!stored) continue;

      try {
        const parsed = JSON.parse(stored);
        const age = Date.now() - parsed.timestamp;

        if (age > maxAge) {
          localStorage.removeItem(key);
        }
      } catch {
        // Remove corrupted entries
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Failed to clear old activity cache:", error);
  }
}
