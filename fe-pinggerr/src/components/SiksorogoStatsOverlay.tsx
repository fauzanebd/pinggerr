// components/SiksorogoStatsOverlay.tsx
import React from "react";
import { MapPin, Zap, Clock, Mountain } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StravaActivity, ActivityTrackpoint } from "@/types/strava";

interface SiksorogoStatsOverlayProps {
  activity: StravaActivity;
  currentTrackpoint?: ActivityTrackpoint;
  currentIndex: number;
  isInFinalView: boolean;
  className?: string;
}

interface StatTitleProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

interface StatValueProps {
  children: React.ReactNode;
  className?: string;
}

const StatTitle: React.FC<StatTitleProps> = ({
  children,
  icon: Icon,
  className = "",
}) => {
  return (
    <span
      className={`text-gray-300 lg:text-lg text-md flex items-center gap-2 ${className}`}
      style={{ fontFamily: '"The Seasons", sans-serif' }}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </span>
  );
};

const StatValue: React.FC<StatValueProps> = ({ children, className = "" }) => {
  return (
    <span
      className={`text-white-400 font-medium lg:text-lg text-md ${className}`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {children}
    </span>
  );
};

export const SiksorogoStatsOverlay: React.FC<SiksorogoStatsOverlayProps> = ({
  activity,
  currentTrackpoint,
  currentIndex,
  isInFinalView,
  className = "",
}) => {
  console.log("currentTrackpoint", currentTrackpoint);
  console.log("currentIndex", currentIndex);
  console.log("isInFinalView", isInFinalView);
  console.log("activity", activity);

  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatPace = (distanceMeters: number, timeSeconds: number) => {
    if (timeSeconds === 0 || distanceMeters === 0) return "0:00/km";

    const minutes = timeSeconds / 60;
    const km = distanceMeters / 1000;
    const paceMinPerKm = minutes / km;
    const paceMin = Math.floor(paceMinPerKm);
    const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
    return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
  };

  const formatAveragePace = (activity: StravaActivity) => {
    if (activity.average_speed && activity.average_speed > 0) {
      const paceMinPerKm = 1000 / (activity.average_speed * 60);
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
    } else {
      const minutes = activity.moving_time / 60;
      const km = activity.distance / 1000;
      const paceMinPerKm = minutes / km;
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
    }
  };

  const formatElevation = (meters: number) => `${meters.toFixed(0)}m`;

  // Calculate timeOffset from ISO timestamps if not provided
  const calculateTimeOffset = (
    currentTrackpoint: ActivityTrackpoint,
    activity: StravaActivity
  ): number => {
    // If timeOffset is already provided, use it
    if (currentTrackpoint.timeOffset !== undefined) {
      return currentTrackpoint.timeOffset;
    }

    // If we have time as ISO string, calculate offset from activity start
    if (currentTrackpoint.time && activity.start_date) {
      const currentTime = new Date(currentTrackpoint.time).getTime();
      const startTime = new Date(activity.start_date).getTime();
      return Math.floor((currentTime - startTime) / 1000); // Convert to seconds
    }

    // If we have trackpoints array, calculate from first trackpoint
    if (
      currentTrackpoint.time &&
      activity.trackpoints &&
      activity.trackpoints.length > 0
    ) {
      const firstTrackpoint = activity.trackpoints[0];
      if (firstTrackpoint.time) {
        const currentTime = new Date(currentTrackpoint.time).getTime();
        const startTime = new Date(firstTrackpoint.time).getTime();
        return Math.floor((currentTime - startTime) / 1000); // Convert to seconds
      }
    }

    // Fallback: estimate based on index and total activity time
    if (
      activity.trackpoints &&
      activity.trackpoints.length > 0 &&
      currentIndex > 0
    ) {
      const progressRatio = currentIndex / (activity.trackpoints.length - 1);
      return Math.floor(activity.elapsed_time * progressRatio);
    }

    return 0;
  };

  // Calculate current stats based on trackpoint
  const getCurrentStats = () => {
    if (!currentTrackpoint || !activity.trackpoints) {
      return {
        pace: "0:00/km",
        distance: "0.0 km",
        elevationGain: "0m",
        time: "0s",
      };
    }

    const distance = currentTrackpoint.distance || 0;
    const timeOffset = calculateTimeOffset(currentTrackpoint, activity);

    console.log("Distance:", distance, "TimeOffset:", timeOffset); // Debug log

    // Calculate elevation gain up to current point
    let elevationGain = 0;
    if (activity.trackpoints && currentIndex > 0) {
      let lastElevation = activity.trackpoints[0].altitude || 0;
      for (
        let i = 1;
        i <= currentIndex && i < activity.trackpoints.length;
        i++
      ) {
        const currentElevation =
          activity.trackpoints[i].altitude || lastElevation;
        if (currentElevation > lastElevation) {
          elevationGain += currentElevation - lastElevation;
        }
        lastElevation = currentElevation;
      }
    }

    return {
      pace: formatPace(distance, timeOffset),
      distance: formatDistance(distance),
      elevationGain: formatElevation(elevationGain),
      time: formatTime(timeOffset),
    };
  };

  const getFinalStats = () => {
    return {
      avgPace: formatAveragePace(activity),
      totalDistance: formatDistance(activity.distance),
      totalElevationGain: formatElevation(activity.total_elevation_gain),
      elapsedTime: formatTime(activity.elapsed_time),
    };
  };

  const currentStats = getCurrentStats();
  const finalStats = getFinalStats();

  return (
    <div
      className={`absolute bg-black bg-opacity-75 text-white p-3 rounded-lg text-sm ${className}`}
      style={{ bottom: "50px", left: "50px" }}
    >
      {isInFinalView ? (
        <div className="lg:space-y-1 space-y-2 lg:min-w-64 min-w-48">
          <div className="flex justify-between items-center gap-4">
            <StatTitle className="font-bold">{activity.name}</StatTitle>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={Zap}>Avg Pace</StatTitle>
            <StatValue>{finalStats.avgPace}</StatValue>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={MapPin}>Distance</StatTitle>
            <StatValue className="font-bold">
              {finalStats.totalDistance}
            </StatValue>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={Mountain}>Elevation</StatTitle>
            <StatValue className="font-bold">
              {finalStats.totalElevationGain}
            </StatValue>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={Clock}>Time</StatTitle>
            <StatValue className="font-bold">
              {finalStats.elapsedTime}
            </StatValue>
          </div>
        </div>
      ) : (
        <div className="lg:space-y-1 space-y-2 lg:min-w-64 min-w-48">
          <div className="flex justify-between items-center gap-4">
            <StatTitle className="font-bold">{activity.name}</StatTitle>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={Zap}>Pace</StatTitle>
            <StatValue className="font-bold">{currentStats.pace}</StatValue>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={MapPin}>Distance</StatTitle>
            <StatValue className="font-bold">{currentStats.distance}</StatValue>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={Mountain}>Elevation</StatTitle>
            <StatValue className="font-bold">
              {currentStats.elevationGain}
            </StatValue>
          </div>
          <div className="flex justify-between items-center gap-4">
            <StatTitle icon={Clock}>Time</StatTitle>
            <StatValue className="font-bold">{currentStats.time}</StatValue>
          </div>
        </div>
      )}
    </div>
  );
};
