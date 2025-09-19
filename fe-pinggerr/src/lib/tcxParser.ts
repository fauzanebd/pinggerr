/**
 * TCX (Training Center XML) Parser
 * Converts TCX data to Strava activity format
 */

import type {
  StravaActivity,
  ActivityLap,
  ActivityTrackpoint,
} from "@/types/strava";
import { encode } from "@mapbox/polyline";

export interface TcxTrackpoint {
  time: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  distance?: number;
  heartRate?: number;
  speed?: number;
  cadence?: number;
  watts?: number;
}

export interface TcxLap {
  startTime: string;
  totalTimeSeconds: number;
  distanceMeters: number;
  maximumSpeed?: number;
  calories?: number;
  averageHeartRate?: number;
  maximumHeartRate?: number;
  averageCadence?: number;
  trackpoints: TcxTrackpoint[];
}

export interface TcxActivity {
  sport: string;
  id: string;
  laps: TcxLap[];
}

/**
 * Parse TCX XML content and extract activity data
 */
export function parseTcxContent(xmlContent: string): TcxActivity {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  // Check for parsing errors
  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid TCX file format");
  }

  const activity = xmlDoc.querySelector("Activity");
  if (!activity) {
    throw new Error("No activity found in TCX file");
  }

  const sport = activity.getAttribute("Sport") || "Unknown";
  const id = activity.querySelector("Id")?.textContent || "";

  const laps: TcxLap[] = [];
  const lapElements = activity.querySelectorAll("Lap");

  lapElements.forEach((lapElement) => {
    const startTime = lapElement.getAttribute("StartTime") || "";
    const totalTimeSeconds = parseFloat(
      lapElement.querySelector("TotalTimeSeconds")?.textContent || "0"
    );
    const distanceMeters = parseFloat(
      lapElement.querySelector("DistanceMeters")?.textContent || "0"
    );
    const maximumSpeed =
      parseFloat(
        lapElement.querySelector("MaximumSpeed")?.textContent || "0"
      ) || undefined;
    const calories =
      parseInt(lapElement.querySelector("Calories")?.textContent || "0") ||
      undefined;
    const averageHeartRate =
      parseFloat(
        lapElement.querySelector("AverageHeartRateBpm Value")?.textContent ||
          "0"
      ) || undefined;
    const maximumHeartRate =
      parseFloat(
        lapElement.querySelector("MaximumHeartRateBpm Value")?.textContent ||
          "0"
      ) || undefined;
    const averageCadence =
      parseFloat(lapElement.querySelector("Cadence")?.textContent || "0") ||
      undefined;

    const trackpoints: TcxTrackpoint[] = [];
    const trackpointElements = lapElement.querySelectorAll("Trackpoint");

    trackpointElements.forEach((tpElement) => {
      const time = tpElement.querySelector("Time")?.textContent || "";
      const latitude =
        parseFloat(
          tpElement.querySelector("Position LatitudeDegrees")?.textContent ||
            "0"
        ) || undefined;
      const longitude =
        parseFloat(
          tpElement.querySelector("Position LongitudeDegrees")?.textContent ||
            "0"
        ) || undefined;
      const altitude =
        parseFloat(
          tpElement.querySelector("AltitudeMeters")?.textContent || "0"
        ) || undefined;
      const distance =
        parseFloat(
          tpElement.querySelector("DistanceMeters")?.textContent || "0"
        ) || undefined;
      const heartRate =
        parseFloat(
          tpElement.querySelector("HeartRateBpm Value")?.textContent || "0"
        ) || undefined;
      const speed =
        parseFloat(tpElement.querySelector("TPX Speed")?.textContent || "0") ||
        undefined;
      const cadence =
        parseFloat(
          tpElement.querySelector("TPX RunCadence")?.textContent || "0"
        ) || undefined;
      const watts =
        parseFloat(tpElement.querySelector("TPX Watts")?.textContent || "0") ||
        undefined;

      trackpoints.push({
        time,
        latitude,
        longitude,
        altitude,
        distance,
        heartRate,
        speed,
        cadence,
        watts,
      });
    });

    laps.push({
      startTime,
      totalTimeSeconds,
      distanceMeters,
      maximumSpeed,
      calories,
      averageHeartRate,
      maximumHeartRate,
      averageCadence,
      trackpoints,
    });
  });

  return {
    sport,
    id,
    laps,
  };
}

/**
 * Convert TCX trackpoints to common ActivityTrackpoint format
 */
function convertTcxTrackpointsToActivityTrackpoints(
  tcxLaps: TcxLap[]
): ActivityTrackpoint[] {
  const allTrackpoints = tcxLaps.flatMap((lap) => lap.trackpoints);

  return allTrackpoints.map(
    (tp): ActivityTrackpoint => ({
      time: tp.time,
      latitude: tp.latitude,
      longitude: tp.longitude,
      altitude: tp.altitude,
      distance: tp.distance,
      heartRate: tp.heartRate,
      speed: tp.speed,
      cadence: tp.cadence,
      watts: tp.watts,
    })
  );
}

/**
 * Convert TCX lap data to common ActivityLap format
 */
function convertTcxLapsToActivityLaps(tcxLaps: TcxLap[]): ActivityLap[] {
  let currentTrackpointIndex = 0;

  return tcxLaps.map((lap, index) => {
    const startIndex = currentTrackpointIndex;
    const endIndex = currentTrackpointIndex + lap.trackpoints.length - 1;
    currentTrackpointIndex += lap.trackpoints.length;

    // Calculate elevation gain for this lap
    const altitudes = lap.trackpoints
      .filter((tp) => tp.altitude !== undefined)
      .map((tp) => tp.altitude!);

    let lapElevationGain = 0;
    for (let i = 1; i < altitudes.length; i++) {
      const gain = altitudes[i] - altitudes[i - 1];
      if (gain > 0) {
        lapElevationGain += gain;
      }
    }

    // Calculate average watts from trackpoints
    const watts = lap.trackpoints
      .filter((tp) => tp.watts && tp.watts > 0)
      .map((tp) => tp.watts!);
    const averageWatts =
      watts.length > 0
        ? watts.reduce((sum, w) => sum + w, 0) / watts.length
        : undefined;
    const maxWatts = watts.length > 0 ? Math.max(...watts) : undefined;

    return {
      startTime: lap.startTime,
      elapsedTime: lap.totalTimeSeconds,
      distance: lap.distanceMeters,
      averageSpeed: lap.distanceMeters / lap.totalTimeSeconds, // m/s
      maxSpeed: lap.maximumSpeed,
      averageHeartrate: lap.averageHeartRate,
      maxHeartrate: lap.maximumHeartRate,
      averageCadence: lap.averageCadence,
      averageWatts,
      maxWatts,
      calories: lap.calories,
      totalElevationGain: lapElevationGain,
      startIndex,
      endIndex,
      lapIndex: index + 1, // 1-based lap number
    };
  });
}

/**
 * Convert TCX activity data to Strava activity format
 */
export function convertTcxToStravaActivity(
  tcxActivity: TcxActivity
): StravaActivity {
  // Calculate totals from all laps
  const totalDistance = tcxActivity.laps.reduce(
    (sum, lap) => sum + lap.distanceMeters,
    0
  );
  const totalTime = tcxActivity.laps.reduce(
    (sum, lap) => sum + lap.totalTimeSeconds,
    0
  );
  const totalElevationGain = calculateElevationGain(tcxActivity.laps);

  // Convert lap data to common format
  const laps = convertTcxLapsToActivityLaps(tcxActivity.laps);

  // Convert trackpoint data to common format
  const trackpoints = convertTcxTrackpointsToActivityTrackpoints(
    tcxActivity.laps
  );

  // Get all trackpoints for polyline generation
  const allTrackpoints = tcxActivity.laps.flatMap((lap) => lap.trackpoints);
  const hasGpsData = allTrackpoints.some((tp) => tp.latitude && tp.longitude);

  // Generate polyline if GPS data is available
  let polyline: string | undefined;
  if (hasGpsData) {
    const coordinates: [number, number][] = allTrackpoints
      .filter((tp) => tp.latitude && tp.longitude)
      .map((tp) => [tp.latitude!, tp.longitude!] as [number, number]);
    polyline = encode(coordinates, 5);
  }

  // Calculate heart rate stats
  const heartRates = allTrackpoints
    .filter((tp) => tp.heartRate && tp.heartRate > 0)
    .map((tp) => tp.heartRate!);

  const hasHeartRate = heartRates.length > 0;
  const averageHeartRate = hasHeartRate
    ? heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length
    : undefined;
  const maxHeartRate = hasHeartRate ? Math.max(...heartRates) : undefined;

  // Calculate speed stats
  const speeds = allTrackpoints
    .filter((tp) => tp.speed && tp.speed > 0)
    .map((tp) => tp.speed!);

  const averageSpeed = totalDistance / totalTime; // m/s
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : undefined;

  // Calculate cadence
  const cadences = allTrackpoints
    .filter((tp) => tp.cadence && tp.cadence > 0)
    .map((tp) => tp.cadence!);

  const averageCadence =
    cadences.length > 0
      ? cadences.reduce((sum, c) => sum + c, 0) / cadences.length
      : undefined;

  // Get start date from first trackpoint or activity ID
  const startDate = allTrackpoints[0]?.time || tcxActivity.id;

  // Create activity name based on sport and date
  const activityName = `${tcxActivity.sport} Activity`;

  return {
    resource_state: 2,
    athlete: {
      id: 0, // Unknown athlete
      resource_state: 1,
    },
    name: activityName,
    distance: totalDistance,
    moving_time: totalTime,
    elapsed_time: totalTime,
    total_elevation_gain: totalElevationGain,
    type: tcxActivity.sport,
    sport_type: tcxActivity.sport,
    id: Math.floor(Math.random() * 1000000), // Generate random ID
    start_date: startDate,
    start_date_local: startDate,
    timezone: "UTC",
    utc_offset: 0,
    achievement_count: 0,
    kudos_count: 0,
    comment_count: 0,
    athlete_count: 1,
    photo_count: 0,
    map: polyline
      ? {
          id: "tcx_map",
          polyline: polyline,
          summary_polyline: polyline,
          resource_state: 2,
        }
      : undefined,
    trainer: false,
    commute: false,
    manual: false,
    private: false,
    flagged: false,
    average_speed: averageSpeed,
    max_speed: maxSpeed,
    average_cadence: averageCadence,
    has_heartrate: hasHeartRate,
    average_heartrate: averageHeartRate,
    max_heartrate: maxHeartRate,
    pr_count: 0,
    total_photo_count: 0,
    has_kudoed: false,
    source: "tcx", // Mark as TCX data source
    laps, // Include the converted lap data
    trackpoints, // Include the converted trackpoint data
  };
}

/**
 * Calculate total elevation gain from trackpoints
 */
function calculateElevationGain(laps: TcxLap[]): number {
  let totalGain = 0;

  for (const lap of laps) {
    const altitudes = lap.trackpoints
      .filter((tp) => tp.altitude !== undefined)
      .map((tp) => tp.altitude!);

    for (let i = 1; i < altitudes.length; i++) {
      const gain = altitudes[i] - altitudes[i - 1];
      if (gain > 0) {
        totalGain += gain;
      }
    }
  }

  return totalGain;
}

/**
 * Process uploaded TCX file
 */
export async function processTcxFromFile(file: File): Promise<StravaActivity> {
  try {
    // Validate file type
    if (!file.name.toLowerCase().endsWith(".tcx")) {
      throw new Error("Please select a TCX file (.tcx extension)");
    }

    // Check file size (50MB limit)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      throw new Error(
        `File too large (${fileSizeMB.toFixed(
          1
        )}MB). Maximum supported size is 50MB.`
      );
    }

    // Read file content
    const xmlContent = await file.text();

    if (!xmlContent.trim()) {
      throw new Error("Empty TCX file");
    }

    // Parse TCX content
    const tcxActivity = parseTcxContent(xmlContent);

    // Convert to Strava format
    const stravaActivity = convertTcxToStravaActivity(tcxActivity);

    return stravaActivity;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to process TCX file");
  }
}
