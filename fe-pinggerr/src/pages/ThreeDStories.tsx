import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { FlyoverMap } from "@/components/FlyoverMap";
import { SegmentCreator } from "@/components/SegmentCreator";
import { SegmentManager } from "@/components/SegmentManager";
import { FinalStatsOverlay } from "@/components/FinalStatsOverlay";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import type {
  StravaActivity,
  ActivityTrackpoint,
  ActivitySegment,
  FlyoverState,
} from "@/types/strava";

interface ThreeDStoriesProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function ThreeDStories({
  activity,
  language,
  onDownload: _onDownload,
}: ThreeDStoriesProps) {
  const { stravaApi } = useStravaAuth();
  const [enhancedActivity, setEnhancedActivity] =
    useState<StravaActivity>(activity);
  const [segments, setSegments] = useState<ActivitySegment[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFinalStats, setShowFinalStats] = useState(false);
  const [segmentCreatorRef, setSegmentCreatorRef] = useState<{
    handleTrackpointClick: (
      index: number,
      trackpoint: ActivityTrackpoint
    ) => void;
  } | null>(null);

  // Flyover state
  const [flyoverState, setFlyoverState] = useState<FlyoverState>({
    isPlaying: false,
    currentTrackpointIndex: 0,
    playbackSpeed: 1,
    currentSegment: undefined,
    showingSegmentOverlay: false,
  });

  const texts = {
    en: {
      title: "3D Stories Flyover",
      loadingStreams: "Loading detailed GPS data...",
      noGpsData: "No GPS data available for 3D visualization",
      play: "Play Flyover",
      pause: "Pause",
      reset: "Reset",
      settings: "Settings",
      speed: "Speed",
      progress: "Progress",
      segments: "Segments",
      createSegment: "Create Segment",
      manageSegments: "Manage Segments",
      error: "Error",
      retry: "Retry",
    },
    id: {
      title: "Flyover Cerita 3D",
      loadingStreams: "Memuat data GPS terperinci...",
      noGpsData: "Tidak ada data GPS untuk visualisasi 3D",
      play: "Putar Flyover",
      pause: "Jeda",
      reset: "Reset",
      settings: "Pengaturan",
      speed: "Kecepatan",
      progress: "Progres",
      segments: "Segmen",
      createSegment: "Buat Segmen",
      manageSegments: "Kelola Segmen",
      error: "Error",
      retry: "Coba Lagi",
    },
  };

  const t = texts[language];

  // Load detailed activity streams on component mount
  useEffect(() => {
    const loadStreams = async () => {
      if (!activity.id || !stravaApi || enhancedActivity.trackpoints) return;

      setIsLoadingStreams(true);
      setError(null);

      try {
        if (!stravaApi) throw new Error("Not authenticated");
        const activityWithStreams = await stravaApi.getActivityWithStreams(
          activity.id
        );
        setEnhancedActivity(activityWithStreams);
      } catch (err) {
        console.error("Failed to load activity streams:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load GPS data"
        );
      } finally {
        setIsLoadingStreams(false);
      }
    };

    loadStreams();
  }, [activity.id, stravaApi, enhancedActivity.trackpoints]);

  // Flyover animation loop
  useEffect(() => {
    if (!flyoverState.isPlaying || !enhancedActivity.trackpoints) return;

    const trackpoints = enhancedActivity.trackpoints.filter(
      (tp) => tp.latitude && tp.longitude
    );
    if (trackpoints.length === 0) return;

    const interval = setInterval(() => {
      setFlyoverState((prev) => {
        const nextIndex = prev.currentTrackpointIndex + 1;

        // Stop at end
        if (nextIndex >= trackpoints.length) {
          return {
            ...prev,
            isPlaying: false,
            currentTrackpointIndex: trackpoints.length - 1,
          };
        }

        return { ...prev, currentTrackpointIndex: nextIndex };
      });
    }, 1000 / flyoverState.playbackSpeed); // Adjust speed

    return () => clearInterval(interval);
  }, [
    flyoverState.isPlaying,
    flyoverState.playbackSpeed,
    enhancedActivity.trackpoints,
  ]);

  // Handle segment creation
  const handleSegmentCreate = useCallback(
    (segmentData: Omit<ActivitySegment, "id" | "createdAt">) => {
      const newSegment: ActivitySegment = {
        ...segmentData,
        id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
      };
      setSegments((prev) => [...prev, newSegment]);
    },
    []
  );

  // Handle segment update
  const handleSegmentUpdate = useCallback(
    (segmentId: string, updates: Partial<ActivitySegment>) => {
      setSegments((prev) =>
        prev.map((segment) =>
          segment.id === segmentId ? { ...segment, ...updates } : segment
        )
      );
    },
    []
  );

  // Handle segment deletion
  const handleSegmentDelete = useCallback((segmentId: string) => {
    setSegments((prev) => prev.filter((segment) => segment.id !== segmentId));
  }, []);

  // Handle segment playback
  const handleSegmentPlay = useCallback((segment: ActivitySegment) => {
    setFlyoverState((prev) => ({
      ...prev,
      currentTrackpointIndex: segment.startIndex,
      currentSegment: segment,
      isPlaying: true,
    }));
  }, []);

  // Handle video upload
  const handleVideoUpload = useCallback(
    (segmentId: string, file: File) => {
      // Create object URL for the video file
      const videoUrl = URL.createObjectURL(file);
      handleSegmentUpdate(segmentId, { videoFile: file, videoUrl });
    },
    [handleSegmentUpdate]
  );

  // Handle segment reach during flyover
  const handleSegmentReach = useCallback((segment: ActivitySegment) => {
    setFlyoverState((prev) => ({
      ...prev,
      currentSegment: segment,
      showingSegmentOverlay: true,
    }));
  }, []);

  // Playback controls
  const togglePlayback = () => {
    setFlyoverState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const resetFlyover = () => {
    setFlyoverState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackpointIndex: 0,
      currentSegment: undefined,
      showingSegmentOverlay: false,
    }));
  };

  const handleSpeedChange = (speed: number) => {
    setFlyoverState((prev) => ({ ...prev, playbackSpeed: speed }));
  };

  // Handle flyover end
  const handleFlyoverEnd = useCallback(() => {
    setFlyoverState((prev) => ({ ...prev, isPlaying: false }));
    setShowFinalStats(true);
  }, []);

  // Handle trackpoint click for segment creation
  const handleTrackpointClick = useCallback(
    (index: number, trackpoint: ActivityTrackpoint) => {
      // Forward to SegmentCreator component if it's in creation mode
      if (segmentCreatorRef?.handleTrackpointClick) {
        segmentCreatorRef.handleTrackpointClick(index, trackpoint);
      }
    },
    [segmentCreatorRef]
  );

  // Render loading state
  if (isLoadingStreams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-brand-green">🎭</span>
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">{t.loadingStreams}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-brand-green">🎭</span>
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {t.error}
            </h3>
            <p className="text-red-700 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>{t.retry}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if we have GPS data
  const trackpoints =
    enhancedActivity.trackpoints?.filter((tp) => tp.latitude && tp.longitude) ||
    [];
  if (trackpoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-brand-green">🎭</span>
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-orange-600 text-4xl mb-4">📍</div>
            <h3 className="text-lg font-semibold text-orange-800 mb-2">
              {t.noGpsData}
            </h3>
            <p className="text-orange-700">
              This activity doesn't have GPS tracking data required for 3D
              visualization.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Flyover Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-brand-green">🎭</span>
              {t.title}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={togglePlayback}
                className={
                  flyoverState.isPlaying
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-green-600 hover:bg-green-700"
                }
              >
                {flyoverState.isPlaying ? (
                  <Pause className="w-4 h-4 mr-1" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                {flyoverState.isPlaying ? t.pause : t.play}
              </Button>

              <Button size="sm" variant="outline" onClick={resetFlyover}>
                <RotateCcw className="w-4 h-4 mr-1" />
                {t.reset}
              </Button>

              {/* Speed Control */}
              <select
                value={flyoverState.playbackSpeed}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border rounded"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{t.progress}</span>
              <span>
                {flyoverState.currentTrackpointIndex} / {trackpoints.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (flyoverState.currentTrackpointIndex / trackpoints.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>

          {/* 3D Map */}
          <FlyoverMap
            activity={enhancedActivity}
            segments={segments}
            flyoverState={flyoverState}
            onTrackpointClick={handleTrackpointClick}
            onSegmentReach={handleSegmentReach}
            onFlyoverEnd={handleFlyoverEnd}
            className="mb-4"
          />
        </CardContent>
      </Card>

      {/* Segment Creation */}
      <SegmentCreator
        trackpoints={trackpoints}
        segments={segments}
        onSegmentCreate={handleSegmentCreate}
        language={language}
        onRefUpdate={setSegmentCreatorRef}
      />

      {/* Segment Management */}
      {segments.length > 0 && (
        <SegmentManager
          segments={segments}
          trackpoints={trackpoints}
          onSegmentUpdate={handleSegmentUpdate}
          onSegmentDelete={handleSegmentDelete}
          onSegmentPlay={handleSegmentPlay}
          onVideoUpload={handleVideoUpload}
          language={language}
        />
      )}

      {/* Final Stats Overlay */}
      <FinalStatsOverlay
        activity={enhancedActivity}
        isVisible={showFinalStats}
        onClose={() => setShowFinalStats(false)}
        language={language}
      />
    </div>
  );
}
