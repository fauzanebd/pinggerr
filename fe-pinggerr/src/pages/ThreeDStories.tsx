import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Video,
  Zap,
  Crown,
} from "lucide-react";
import { FlyoverMap } from "@/components/FlyoverMapGG";
import { FinalStatsOverlay } from "@/components/FinalStatsOverlay";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import type { StravaActivity, FlyoverState } from "@/types/strava";

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
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFinalStats, setShowFinalStats] = useState(false);

  // Video export state - now with different types
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [triggerVideoExport, setTriggerVideoExport] = useState(false);
  const [triggerOrdinaryExport, setTriggerOrdinaryExport] = useState(false);
  const [exportDuration, setExportDuration] = useState(30);
  const [exportType, setExportType] = useState<"high-quality" | "ordinary">(
    "high-quality"
  );

  // Flyover state
  const [flyoverState, setFlyoverState] = useState<FlyoverState>({
    isPlaying: false,
    currentTrackpointIndex: 0,
    playbackSpeed: 1,
    currentSegment: undefined,
    showingSegmentOverlay: false,
  });

  const validTrackpoints =
    enhancedActivity.trackpoints?.filter((tp) => tp.latitude && tp.longitude) ||
    [];

  const texts = {
    en: {
      title: "3D Stories Flyover",
      loadingStreams: "Loading detailed GPS data...",
      noGpsData: "No GPS data available for 3D visualization",
      play: "Play Flyover",
      pause: "Pause",
      reset: "Reset",
      exportHQ: "Export HQ Video",
      exportFast: "Export Fast",
      exporting: "Exporting...",
      exportingHQ: "Exporting HQ (60fps)...",
      exportingFast: "Exporting Fast (24fps)...",
      exportDuration: "Export Duration",
      progress: "Progress",
      error: "Error",
      retry: "Retry",
      seconds: "seconds",
      preview: "Preview: 30fps, optimized for smooth playback",
      hqExport: "High Quality: 60fps, perfect tiles, slow but perfect",
      fastExport: "Fast Export: 24fps, quick processing, good quality",
    },
    id: {
      title: "Flyover Cerita 3D",
      loadingStreams: "Memuat data GPS terperinci...",
      noGpsData: "Tidak ada data GPS untuk visualisasi 3D",
      play: "Putar Flyover",
      pause: "Jeda",
      reset: "Reset",
      exportHQ: "Ekspor Video HQ",
      exportFast: "Ekspor Cepat",
      exporting: "Mengekspor...",
      exportingHQ: "Mengekspor HQ (60fps)...",
      exportingFast: "Mengekspor Cepat (24fps)...",
      exportDuration: "Durasi Ekspor",
      progress: "Progres",
      error: "Error",
      retry: "Coba Lagi",
      seconds: "detik",
      preview: "Preview: 30fps, dioptimalkan untuk pemutaran mulus",
      hqExport: "Kualitas Tinggi: 60fps, tiles sempurna, lambat tapi sempurna",
      fastExport: "Ekspor Cepat: 24fps, pemrosesan cepat, kualitas bagus",
    },
  };

  const t = texts[language];

  // Load detailed activity streams
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

  // Video export callbacks
  const handleVideoExportStart = useCallback(() => {
    setIsExporting(true);
    setExportProgress(0);
  }, []);

  const handleVideoExportProgress = useCallback((progress: number) => {
    setExportProgress(progress);
  }, []);

  const handleVideoExportComplete = useCallback(
    (videoBlob: Blob) => {
      setIsExporting(false);
      setTriggerVideoExport(false);
      setTriggerOrdinaryExport(false);
      setExportProgress(0);

      if (videoBlob.size > 0) {
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement("a");
        a.href = url;
        const quality =
          exportType === "high-quality" ? "HQ_60fps" : "Fast_24fps";
        a.download = `${activity.name || "flyover"}_3d_${quality}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert("Video export failed. Please try again.");
      }
    },
    [activity.name, exportType]
  );

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

  // Video export controls
  const startHighQualityExport = () => {
    if (isExporting) return;
    setExportType("high-quality");
    setTriggerVideoExport(true);
  };

  const startOrdinaryExport = () => {
    if (isExporting) return;
    setExportType("ordinary");
    setTriggerOrdinaryExport(true);
  };

  const handleExportDurationChange = (duration: number) => {
    setExportDuration(duration);
  };

  // Handle flyover end
  const handleFlyoverEnd = useCallback(() => {
    setFlyoverState((prev) => ({ ...prev, isPlaying: false }));
    setShowFinalStats(true);
  }, []);

  // Loading state
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

  // Error state
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

  // No GPS data
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

  const getExportingText = () => {
    if (exportType === "high-quality") {
      return t.exportingHQ;
    }
    return t.exportingFast;
  };

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
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={togglePlayback}
                disabled={isExporting}
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

              <Button
                size="sm"
                variant="outline"
                onClick={resetFlyover}
                disabled={isExporting}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {t.reset}
              </Button>

              {/* Export Duration Selector */}
              <select
                value={exportDuration}
                onChange={(e) =>
                  handleExportDurationChange(Number(e.target.value))
                }
                className="px-2 py-1 text-sm border rounded"
                disabled={isExporting}
              >
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>120s</option>
              </select>

              {/* High Quality Export */}
              <Button
                size="sm"
                onClick={startHighQualityExport}
                disabled={isExporting || flyoverState.isPlaying}
                className="bg-purple-600 hover:bg-purple-700"
                title={t.hqExport}
              >
                {isExporting && exportType === "high-quality" ? (
                  <>
                    <Crown className="w-4 h-4 mr-1 animate-pulse" />
                    {t.exporting}
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-1" />
                    {t.exportHQ}
                  </>
                )}
              </Button>

              {/* Fast Export */}
              <Button
                size="sm"
                onClick={startOrdinaryExport}
                disabled={isExporting || flyoverState.isPlaying}
                className="bg-blue-600 hover:bg-blue-700"
                title={t.fastExport}
              >
                {isExporting && exportType === "ordinary" ? (
                  <>
                    <Zap className="w-4 h-4 mr-1 animate-bounce" />
                    {t.exporting}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    {t.exportFast}
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Information Panel */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                {t.preview}
              </div>
              <div className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-purple-600" />
                {t.hqExport}
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-600" />
                {t.fastExport}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>
                {isExporting
                  ? `${getExportingText()} ${Math.round(exportProgress * 100)}%`
                  : t.progress}
              </span>
              {!isExporting && (
                <span>Path Points: {validTrackpoints.length}</span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isExporting
                    ? exportType === "high-quality"
                      ? "bg-purple-600"
                      : "bg-blue-600"
                    : "bg-green-600"
                }`}
                style={{
                  width: `${
                    isExporting
                      ? exportProgress * 100
                      : flyoverState.isPlaying
                      ? 50
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Activity Info */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-1">
              <span>
                Activity:{" "}
                {Math.floor((enhancedActivity.elapsed_time || 0) / 3600)}h{" "}
                {Math.floor(((enhancedActivity.elapsed_time || 0) % 3600) / 60)}
                m
              </span>
              <span>
                {isExporting
                  ? `Export: ${exportDuration}s ${
                      exportType === "high-quality" ? "(60fps)" : "(24fps)"
                    }`
                  : `Flyover: 60s (30fps)`}
              </span>
            </div>
          </div>

          {/* 3D Map */}
          <FlyoverMap
            activity={enhancedActivity}
            flyoverState={flyoverState}
            onFlyoverEnd={handleFlyoverEnd}
            onVideoExportStart={handleVideoExportStart}
            onVideoExportProgress={handleVideoExportProgress}
            onVideoExportComplete={handleVideoExportComplete}
            triggerVideoExport={triggerVideoExport}
            triggerOrdinaryExport={triggerOrdinaryExport}
            isExporting={isExporting}
            exportDuration={exportDuration}
            exportType={exportType}
            className="mb-4"
          />
        </CardContent>
      </Card>

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
