import { useState, useEffect } from "react";
import { config } from "@/config/env";

interface MapLoadStatus {
  canLoadMap: boolean;
  mapLoadsThisMonth: number;
  monthlyLimit: number;
  remainingLoads: number;
  monthKey: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to manage map load limits and track usage
 */
export const useMapLoadGuard = () => {
  const [status, setStatus] = useState<MapLoadStatus>({
    canLoadMap: false,
    mapLoadsThisMonth: 0,
    monthlyLimit: 50000,
    remainingLoads: 50000,
    monthKey: "",
    isLoading: true,
    error: null,
  });

  // Check current map load status
  const checkMapLimit = async () => {
    setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${config.workerUrl}/check-map-limit`);

      if (!response.ok) {
        throw new Error("Failed to check map limit");
      }

      const data = await response.json();

      setStatus({
        canLoadMap: data.can_load_map,
        mapLoadsThisMonth: data.map_loads_this_month,
        monthlyLimit: data.monthly_limit,
        remainingLoads: data.remaining_loads,
        monthKey: data.month_key,
        isLoading: false,
        error: null,
      });

      return data.can_load_map;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  };

  // Track a map load (call this when initializing a map)
  const trackMapLoad = async () => {
    try {
      const response = await fetch(`${config.workerUrl}/count-map-load`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to track map load");
      }

      const data = await response.json();

      // Update local status
      setStatus((prev) => ({
        ...prev,
        mapLoadsThisMonth: data.map_loads_this_month,
        remainingLoads: Math.max(
          0,
          prev.monthlyLimit - data.map_loads_this_month
        ),
        canLoadMap: data.map_loads_this_month < prev.monthlyLimit,
      }));

      return data;
    } catch (error) {
      console.error("Failed to track map load:", error);
      return null;
    }
  };

  // Check limit on mount
  useEffect(() => {
    checkMapLimit();
  }, []);

  return {
    ...status,
    checkMapLimit,
    trackMapLoad,
  };
};
