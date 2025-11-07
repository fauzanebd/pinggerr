/**
 * TanStack Query hooks for Strava API with smart caching
 * This provides an optimized layer on top of useStravaAuth to reduce API calls
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStravaAuth } from "./useStravaAuth";
import type { StravaActivity } from "@/types/strava";
import { isRateLimitError, parseRateLimitError } from "@/lib/stravaApi";
import {
  CACHE_KEYS,
  persistActivityToLocalStorage,
  loadActivityFromLocalStorage,
} from "@/lib/queryClient";
import { useState, useCallback } from "react";

export interface RateLimitInfo {
  isLimited: boolean;
  limit?: string;
  usage?: string;
  message?: string;
}

/**
 * Hook to fetch activities with caching
 * Cache for 5 minutes to balance fresh data with API rate limits
 */
export function useStravaActivities(page = 1, perPage = 10) {
  const { fetchActivities, isAuthenticated } = useStravaAuth();
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    isLimited: false,
  });

  const query = useQuery({
    queryKey: [CACHE_KEYS.activities, page, perPage],
    queryFn: async () => {
      try {
        setRateLimitInfo({ isLimited: false });
        return await fetchActivities(page, perPage);
      } catch (error) {
        if (error instanceof Error && isRateLimitError(error)) {
          const { limit, usage } = parseRateLimitError(error);
          setRateLimitInfo({
            isLimited: true,
            limit,
            usage,
            message: `Rate limit exceeded. Limit: ${limit}, Usage: ${usage}`,
          });
        }
        throw error;
      }
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 60, // 60 minutes - show recent activities but cache to reduce calls
    gcTime: 1000 * 60 * 60 * 2, // Keep in cache for 2 hours (or page refresh)
    retry: (failureCount, error) => {
      if (error instanceof Error && isRateLimitError(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  return {
    ...query,
    rateLimitInfo,
  };
}

/**
 * Hook to fetch activity details with aggressive caching
 * Cache for 1 hour since activity details rarely change
 * Also uses localStorage for persistent cross-session caching
 */
export function useStravaActivityDetails(activityId: number | null) {
  const { fetchActivityDetails, isAuthenticated } = useStravaAuth();
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    isLimited: false,
  });

  const query = useQuery({
    queryKey: [CACHE_KEYS.activityDetails(activityId || 0)],
    queryFn: async () => {
      if (!activityId) return null;

      // Try to load from localStorage first
      const cached = loadActivityFromLocalStorage(activityId);
      if (cached) {
        console.log(`Using cached activity ${activityId} from localStorage`);
        return cached as StravaActivity;
      }

      // Fetch from API if not in localStorage
      try {
        setRateLimitInfo({ isLimited: false });
        const activity = await fetchActivityDetails(activityId);

        // Persist to localStorage for future use
        persistActivityToLocalStorage(activityId, activity);

        return activity;
      } catch (error) {
        if (error instanceof Error && isRateLimitError(error)) {
          const { limit, usage } = parseRateLimitError(error);
          setRateLimitInfo({
            isLimited: true,
            limit,
            usage,
            message: `Rate limit exceeded. Limit: ${limit}, Usage: ${usage}`,
          });
        }
        throw error;
      }
    },
    enabled: isAuthenticated && !!activityId,
    staleTime: 1000 * 60 * 60, // 1 hour - activity details rarely change
    gcTime: 1000 * 60 * 60 * 2, // Keep in memory cache for 2 hours
    retry: (failureCount, error) => {
      if (error instanceof Error && isRateLimitError(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  return {
    ...query,
    rateLimitInfo,
  };
}

/**
 * Hook to prefetch activity details (useful for hover states)
 * This allows loading data before user clicks, improving UX
 */
export function useStravaActivityPrefetch() {
  const queryClient = useQueryClient();
  const { fetchActivityDetails, isAuthenticated } = useStravaAuth();

  const prefetchActivity = useCallback(
    async (activityId: number) => {
      if (!isAuthenticated) return;

      // Check if already in cache
      const cached = queryClient.getQueryData([
        CACHE_KEYS.activityDetails(activityId),
      ]);
      if (cached) return; // Already cached, no need to prefetch

      // Check localStorage
      const localCached = loadActivityFromLocalStorage(activityId);
      if (localCached) {
        // Put in query cache
        queryClient.setQueryData(
          [CACHE_KEYS.activityDetails(activityId)],
          localCached
        );
        return;
      }

      // Prefetch from API
      await queryClient.prefetchQuery({
        queryKey: [CACHE_KEYS.activityDetails(activityId)],
        queryFn: async () => {
          const activity = await fetchActivityDetails(activityId);
          persistActivityToLocalStorage(activityId, activity);
          return activity;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
      });
    },
    [queryClient, fetchActivityDetails, isAuthenticated]
  );

  return { prefetchActivity };
}

/**
 * Hook to invalidate activity queries (useful after data changes)
 */
export function useInvalidateActivities() {
  const queryClient = useQueryClient();

  const invalidateActivities = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.activities] });
  }, [queryClient]);

  const invalidateActivity = useCallback(
    (activityId: number) => {
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.activityDetails(activityId)],
      });
    },
    [queryClient]
  );

  return {
    invalidateActivities,
    invalidateActivity,
  };
}

/**
 * Combined hook that provides all rate limit information across queries
 */
export function useRateLimitStatus() {
  const [globalRateLimit, setGlobalRateLimit] = useState<RateLimitInfo>({
    isLimited: false,
  });

  const updateRateLimitStatus = useCallback((info: RateLimitInfo) => {
    setGlobalRateLimit(info);
  }, []);

  return {
    rateLimitInfo: globalRateLimit,
    updateRateLimitStatus,
  };
}
