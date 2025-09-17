import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import type { StravaActivity } from "@/types/strava";

interface FinalStatsOverlayProps {
  activity: StravaActivity;
  isVisible: boolean;
  onClose: () => void;
  language: "en" | "id";
}

export const FinalStatsOverlay: React.FC<FinalStatsOverlayProps> = ({
  activity,
  isVisible,
  onClose,
  language,
}) => {
  if (!isVisible) return null;

  const texts = {
    en: {
      title: "Activity Complete!",
      distance: "Distance",
      duration: "Duration",
      pace: "Average Pace",
      speed: "Average Speed",
      elevation: "Elevation Gain",
      heartRate: "Average Heart Rate",
      close: "Close",
    },
    id: {
      title: "Aktivitas Selesai!",
      distance: "Jarak",
      duration: "Durasi",
      pace: "Kecepatan Rata-rata",
      speed: "Kecepatan Rata-rata",
      elevation: "Naik Elevasi",
      heartRate: "Detak Jantung Rata-rata",
      close: "Tutup",
    },
  };

  const t = texts[language];

  // Format functions
  const formatDistance = (meters: number): string => {
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatPace = (distanceMeters: number, timeSeconds: number): string => {
    const minutes = timeSeconds / 60;
    const km = distanceMeters / 1000;
    const paceMinPerKm = minutes / km;
    const paceMin = Math.floor(paceMinPerKm);
    const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
    return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
  };

  const formatSpeed = (distanceMeters: number, timeSeconds: number): string => {
    const kmh = distanceMeters / 1000 / (timeSeconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatElevation = (meters: number): string => {
    return `${meters.toFixed(0)} m`;
  };

  const formatHeartRate = (bpm: number): string => {
    return `${Math.round(bpm)} BPM`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-green-600">{t.title}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-600 mb-1">
                  {t.distance}
                </div>
                <div className="text-lg font-bold text-blue-800">
                  {formatDistance(activity.distance)}
                </div>
              </div>

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-sm font-medium text-green-600 mb-1">
                  {t.duration}
                </div>
                <div className="text-lg font-bold text-green-800">
                  {formatDuration(activity.moving_time)}
                </div>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-sm font-medium text-purple-600 mb-1">
                  {t.pace}
                </div>
                <div className="text-lg font-bold text-purple-800">
                  {formatPace(activity.distance, activity.moving_time)}
                </div>
              </div>

              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-sm font-medium text-orange-600 mb-1">
                  {t.speed}
                </div>
                <div className="text-lg font-bold text-orange-800">
                  {formatSpeed(activity.distance, activity.moving_time)}
                </div>
              </div>

              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-sm font-medium text-yellow-600 mb-1">
                  {t.elevation}
                </div>
                <div className="text-lg font-bold text-yellow-800">
                  {formatElevation(activity.total_elevation_gain)}
                </div>
              </div>

              {activity.has_heartrate && activity.average_heartrate && (
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-sm font-medium text-red-600 mb-1">
                    {t.heartRate}
                  </div>
                  <div className="text-lg font-bold text-red-800">
                    {formatHeartRate(activity.average_heartrate)}
                  </div>
                </div>
              )}
            </div>

            <div className="text-center mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {activity.name}
              </h3>
              <p className="text-sm text-gray-600">
                {new Date(activity.start_date).toLocaleDateString(
                  language === "en" ? "en-US" : "id-ID",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
