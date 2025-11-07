/**
 * Strava API service
 * Handles all interactions with Strava's REST API
 */

import type {
  StravaTokens,
  StravaActivity,
  ActivityLap,
  ActivityTrackpoint,
} from "@/types/strava";

export class StravaApi {
  private baseUrl = "https://www.strava.com/api/v3";
  private tokens: StravaTokens;

  constructor(tokens: StravaTokens) {
    this.tokens = tokens;
  }

  /**
   * Update tokens (for token refresh scenarios)
   */
  updateTokens(tokens: StravaTokens) {
    this.tokens = tokens;
  }

  /**
   * Make authenticated request to Strava API
   */
  private async makeRequest<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED"); // Special error for token refresh
      }
      if (response.status === 429) {
        // Rate limit exceeded - extract limit info from headers if available
        const rateLimitLimit = response.headers.get("X-RateLimit-Limit");
        const rateLimitUsage = response.headers.get("X-RateLimit-Usage");
        throw new Error(
          `RATE_LIMIT_EXCEEDED|${rateLimitLimit || "unknown"}|${
            rateLimitUsage || "unknown"
          }`
        );
      }
      throw new Error(`Strava API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch athlete's activities
   */
  async getActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    const activities = await this.makeRequest<StravaActivity[]>(
      `/athlete/activities?page=${page}&per_page=${perPage}`
    );

    // Add source field to indicate data is from Strava API
    return activities.map((activity) => ({
      ...activity,
      source: "strava" as const,
    }));
  }

  /**
   * Get detailed activity data (includes full polyline)
   */
  async getActivityDetails(activityId: number): Promise<StravaActivity> {
    const activity = await this.makeRequest<StravaActivity>(
      `/activities/${activityId}`
    );

    // Add source field to indicate data is from Strava API
    return {
      ...activity,
      source: "strava" as const,
    };
  }

  /**
   * Fetch lap data for a specific activity
   */
  async getActivityLaps(activityId: number): Promise<ActivityLap[]> {
    interface StravaLapResponse {
      id: number;
      resource_state: number;
      name: string;
      activity: {
        id: number;
        resource_state: number;
      };
      athlete: {
        id: number;
        resource_state: number;
      };
      elapsed_time: number;
      moving_time: number;
      start_date: string;
      start_date_local: string;
      distance: number;
      start_index: number;
      end_index: number;
      total_elevation_gain: number;
      average_speed: number;
      max_speed: number;
      average_cadence?: number;
      device_watts?: boolean;
      average_watts?: number;
      average_heartrate?: number;
      max_heartrate?: number;
      lap_index: number;
    }

    const stravaLaps = await this.makeRequest<StravaLapResponse[]>(
      `/activities/${activityId}/laps`
    );

    // Convert Strava lap format to our common ActivityLap format
    return stravaLaps.map(
      (lap): ActivityLap => ({
        id: lap.id,
        startTime: lap.start_date,
        elapsedTime: lap.elapsed_time,
        movingTime: lap.moving_time,
        distance: lap.distance,
        averageSpeed: lap.average_speed,
        maxSpeed: lap.max_speed,
        averageHeartrate: lap.average_heartrate,
        maxHeartrate: lap.max_heartrate,
        averageCadence: lap.average_cadence,
        averageWatts: lap.average_watts,
        totalElevationGain: lap.total_elevation_gain,
        startIndex: lap.start_index,
        endIndex: lap.end_index,
        lapIndex: lap.lap_index,
      })
    );
  }

  /**
   * Fetch activity streams (trackpoint data)
   */
  async getActivityStreams(
    activityId: number,
    types: string[] = [
      "time",
      "latlng",
      "altitude",
      "heartrate",
      "velocity_smooth",
      "cadence",
      "watts",
      "distance",
      "moving",
      "grade_smooth",
      "temp",
    ]
  ): Promise<ActivityTrackpoint[]> {
    interface StravaStreamResponse {
      type: string;
      data: number[] | number[][];
      series_type: string;
      original_size: number;
      resolution: string;
    }

    const streamsParam = types.join(",");
    const streams = await this.makeRequest<
      StravaStreamResponse[] | Record<string, StravaStreamResponse>
    >(
      `/activities/${activityId}/streams?keys=${streamsParam}&key_by_type=true`
    );

    // Convert Strava streams to our trackpoint format
    let streamsByType: Record<string, number[] | number[][]>;

    if (Array.isArray(streams)) {
      // Handle array response format (key_by_type=false)
      streamsByType = streams.reduce((acc, stream) => {
        acc[stream.type] = stream.data;
        return acc;
      }, {} as Record<string, number[] | number[][]>);
    } else {
      // Handle object response format (key_by_type=true)
      streamsByType = Object.entries(streams).reduce((acc, [type, stream]) => {
        acc[type] = stream.data;
        return acc;
      }, {} as Record<string, number[] | number[][]>);
    }

    const timeData = (streamsByType.time as number[]) || [];
    const latlngData = (streamsByType.latlng as number[][]) || [];
    const altitudeData = (streamsByType.altitude as number[]) || [];
    const heartrateData = (streamsByType.heartrate as number[]) || [];
    const velocityData = (streamsByType.velocity_smooth as number[]) || [];
    const cadenceData = (streamsByType.cadence as number[]) || [];
    const wattsData = (streamsByType.watts as number[]) || [];
    const distanceData = (streamsByType.distance as number[]) || [];
    const movingData = (streamsByType.moving as number[]) || [];
    const gradeData = (streamsByType.grade_smooth as number[]) || [];
    const tempData = (streamsByType.temp as number[]) || [];

    // Determine the length based on the longest available stream
    const maxLength = Math.max(
      timeData.length,
      latlngData.length,
      altitudeData.length,
      heartrateData.length,
      velocityData.length,
      cadenceData.length,
      wattsData.length,
      distanceData.length,
      movingData.length,
      gradeData.length,
      tempData.length
    );

    const trackpoints: ActivityTrackpoint[] = [];

    for (let i = 0; i < maxLength; i++) {
      const trackpoint: ActivityTrackpoint = {};

      if (timeData[i] !== undefined) trackpoint.timeOffset = timeData[i];
      if (latlngData[i]) {
        trackpoint.latitude = latlngData[i][0];
        trackpoint.longitude = latlngData[i][1];
      }
      if (altitudeData[i] !== undefined) trackpoint.altitude = altitudeData[i];
      if (heartrateData[i] !== undefined)
        trackpoint.heartRate = heartrateData[i];
      if (velocityData[i] !== undefined) trackpoint.speed = velocityData[i];
      if (cadenceData[i] !== undefined) trackpoint.cadence = cadenceData[i];
      if (wattsData[i] !== undefined) trackpoint.watts = wattsData[i];
      if (distanceData[i] !== undefined) trackpoint.distance = distanceData[i];
      if (movingData[i] !== undefined) trackpoint.moving = movingData[i] === 1;
      if (gradeData[i] !== undefined) trackpoint.grade = gradeData[i];
      if (tempData[i] !== undefined) trackpoint.temperature = tempData[i];

      trackpoints.push(trackpoint);
    }

    return trackpoints;
  }

  /**
   * Fetch activity with its lap data
   */
  async getActivityWithLaps(activityId: number): Promise<StravaActivity> {
    const [activity, laps] = await Promise.all([
      this.getActivityDetails(activityId),
      this.getActivityLaps(activityId),
    ]);

    return {
      ...activity,
      laps,
    };
  }

  /**
   * Fetch activity with trackpoint data (streams)
   */
  async getActivityWithStreams(activityId: number): Promise<StravaActivity> {
    const [activity, trackpoints] = await Promise.all([
      this.getActivityDetails(activityId),
      this.getActivityStreams(activityId),
    ]);

    return {
      ...activity,
      trackpoints,
    };
  }

  /**
   * Fetch activity with both laps and trackpoint data
   */
  async getActivityWithLapsAndStreams(
    activityId: number
  ): Promise<StravaActivity> {
    const [activity, laps, trackpoints] = await Promise.all([
      this.getActivityDetails(activityId),
      this.getActivityLaps(activityId),
      this.getActivityStreams(activityId),
    ]);

    return {
      ...activity,
      laps,
      trackpoints,
    };
  }
}

/**
 * Utility functions for working with Strava API
 */

/**
 * Create StravaApi instance with token validation
 */
export function createStravaApi(tokens: StravaTokens | null): StravaApi | null {
  if (!tokens?.access_token) {
    return null;
  }

  // Check if token is still valid (with 5 minute buffer)
  const expirationTime = tokens.expires_at * 1000;
  const currentTime = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (currentTime >= expirationTime - bufferTime) {
    return null; // Token expired or about to expire
  }

  return new StravaApi(tokens);
}

/**
 * Check if error indicates need for token refresh
 */
export function isTokenRefreshNeeded(error: Error): boolean {
  return error.message === "UNAUTHORIZED";
}

/**
 * Check if error indicates rate limit exceeded
 */
export function isRateLimitError(error: Error): boolean {
  return error.message.startsWith("RATE_LIMIT_EXCEEDED");
}

/**
 * Parse rate limit error message to extract details
 */
export function parseRateLimitError(error: Error): {
  limit: string;
  usage: string;
} {
  const parts = error.message.split("|");
  return {
    limit: parts[1] || "unknown",
    usage: parts[2] || "unknown",
  };
}
