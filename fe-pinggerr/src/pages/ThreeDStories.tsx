import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Crown,
  Monitor,
  Smartphone,
  X,
} from "lucide-react";
import { FlyoverMap, type FlyoverMapHandle } from "@/components/FlyoverMapGG";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import type { StravaActivity, FlyoverState } from "@/types/strava";

// Import Strava logo
import stravaLogoOrange from "@/assets/api_logo_pwrdBy_strava_horiz_orange.png";

// Helper function to detect if activity data is from Strava (vs TCX)
const isStravaData = (activity: StravaActivity): boolean => {
  return activity.source === "strava";
};

interface ThreeDStoriesProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function ThreeDStories({
  activity,
  language,
  onDownload,
}: ThreeDStoriesProps) {
  const { stravaApi } = useStravaAuth();
  const flyoverMapRef = useRef<FlyoverMapHandle>(null);
  const [enhancedActivity, setEnhancedActivity] =
    useState<StravaActivity>(activity);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Orientation state
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape"
  );
  const [resetAnimationTrigger, setResetAnimationTrigger] = useState(0);

  // Export state
  const [exportProgress, setExportProgress] = useState({
    frame: 0,
    totalFrames: 0,
    percentage: 0,
    isExporting: false,
  });
  const [exportError, setExportError] = useState<string | null>(null);

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
      cancelExport: "Cancel Export",
      exportDuration: "Export Duration",
      progress: "Progress",
      error: "Error",
      retry: "Retry",
      seconds: "seconds",
      preview: "Preview: 30fps, optimized for smooth playback",
      hqExport: "High Quality: 60fps, perfect tiles, slow but perfect",
      fastExport: "Fast Export: 24fps, quick processing, good quality",
      landscape: "Landscape (16:9)",
      portrait: "Portrait (9:16)",
      keepTabActive: "Please keep this tab active during export",
      exportComplete: "Export complete! Video downloaded.",
      exportFailed: "Export failed. Please try again.",
      exportingStatus: "Capturing frames...",
      compilingVideo: "Compiling video...",
      capturingFrame: "Capturing frame",
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
      cancelExport: "Batalkan Ekspor",
      exportDuration: "Durasi Ekspor",
      progress: "Progres",
      error: "Error",
      retry: "Coba Lagi",
      seconds: "detik",
      preview: "Preview: 30fps, dioptimalkan untuk pemutaran mulus",
      hqExport: "Kualitas Tinggi: 60fps, tiles sempurna, lambat tapi sempurna",
      fastExport: "Ekspor Cepat: 24fps, pemrosesan cepat, kualitas bagus",
      landscape: "Landscape (16:9)",
      portrait: "Portrait (9:16)",
      keepTabActive: "Harap jaga tab ini tetap aktif selama ekspor",
      exportComplete: "Ekspor selesai! Video telah diunduh.",
      exportFailed: "Ekspor gagal. Silakan coba lagi.",
      exportingStatus: "Menangkap frame...",
      compilingVideo: "Menyusun video...",
      capturingFrame: "Menangkap frame",
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

  // Playback controls
  const togglePlayback = () => {
    if (exportProgress.isExporting) return; // Don't allow playback during export
    setFlyoverState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const resetFlyover = () => {
    if (exportProgress.isExporting) return; // Don't allow reset during export
    setFlyoverState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackpointIndex: 0,
      currentSegment: undefined,
      showingSegmentOverlay: false,
    }));
    setResetAnimationTrigger((prev) => prev + 1);
  };

  const toggleOrientation = () => {
    if (exportProgress.isExporting) return; // Don't allow orientation change during export
    setOrientation((prev) => (prev === "landscape" ? "portrait" : "landscape"));
    setFlyoverState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackpointIndex: 0,
      currentSegment: undefined,
      showingSegmentOverlay: false,
    }));
    setResetAnimationTrigger((prev) => prev + 1);
  };

  // Export handlers
  const handleExportHQ = async () => {
    if (exportProgress.isExporting) return;

    // Stop current playback if running
    if (flyoverState.isPlaying) {
      resetFlyover();
      // Wait a bit for reset to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setExportError(null);
    flyoverMapRef.current?.exportVideo("high");
  };

  const handleExportFast = async () => {
    if (exportProgress.isExporting) return;

    // Stop current playback if running
    if (flyoverState.isPlaying) {
      resetFlyover();
      // Wait a bit for reset to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setExportError(null);
    flyoverMapRef.current?.exportVideo("fast");
  };

  const handleCancelExport = () => {
    flyoverMapRef.current?.cancelExport();
    setExportProgress({
      frame: 0,
      totalFrames: 0,
      percentage: 0,
      isExporting: false,
    });
    setExportError(null);
  };

  const handleExportProgress = (progress: typeof exportProgress) => {
    setExportProgress(progress);
  };

  const handleExportComplete = (videoBlob: Blob) => {
    // Create download link
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flyover-${activity.name || "activity"}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onDownload?.(url);
    setExportProgress({
      frame: 0,
      totalFrames: 0,
      percentage: 0,
      isExporting: false,
    });

    // Show success message briefly
    setTimeout(() => {
      // You could add a toast notification here
      console.log(t.exportComplete);
    }, 100);
  };

  const handleExportError = (error: string) => {
    setExportError(error);
    setExportProgress({
      frame: 0,
      totalFrames: 0,
      percentage: 0,
      isExporting: false,
    });
  };

  // Handle flyover end
  const handleFlyoverEnd = useCallback(() => {
    setFlyoverState((prev) => ({ ...prev, isPlaying: false }));
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

  return (
    <div className="space-y-6">
      {/* Main Flyover Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-brand-green">🎭</span>
              {t.title}
              {/* Show Strava logo only if data is from Strava */}
              {isStravaData(activity) && (
                <img
                  src={stravaLogoOrange}
                  alt="Powered by Strava"
                  className="h-4 w-auto ml-2"
                />
              )}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {!exportProgress.isExporting ? (
                <>
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

                  {/* Orientation Toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleOrientation}
                    title={
                      orientation === "landscape" ? t.landscape : t.portrait
                    }
                  >
                    {orientation === "landscape" ? (
                      <Monitor className="w-4 h-4 mr-1" />
                    ) : (
                      <Smartphone className="w-4 h-4 mr-1" />
                    )}
                    {orientation === "landscape" ? "16:9" : "9:16"}
                  </Button>

                  {/* Export Controls */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportHQ}
                    className="text-purple-600 border-purple-600 hover:bg-purple-50"
                  >
                    <Crown className="w-4 h-4 mr-1" />
                    {t.exportHQ}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportFast}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    {t.exportFast}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancelExport}
                >
                  <X className="w-4 h-4 mr-1" />
                  {t.cancelExport}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Export Progress */}
          {exportProgress.isExporting && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-800">
                  {exportProgress.frame === exportProgress.totalFrames
                    ? t.compilingVideo
                    : t.exportingStatus}
                </span>
                <span className="text-xs text-blue-600">
                  {t.capturingFrame} {exportProgress.frame} /{" "}
                  {exportProgress.totalFrames}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-blue-600">
                <span>{exportProgress.percentage}% complete</span>
                <span>{t.keepTabActive}</span>
              </div>
            </div>
          )}

          {/* Export Error */}
          {exportError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-medium text-red-800 mb-1">
                    Export Error
                  </h4>
                  <p className="text-red-700 text-sm">{exportError}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExportError(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Information Panel */}
          {!exportProgress.isExporting && (
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
          )}

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>
                {exportProgress.isExporting ? "Export Progress" : t.progress}
              </span>
              <span>Path Points: {validTrackpoints.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  exportProgress.isExporting ? "bg-blue-600" : "bg-green-600"
                }`}
                style={{
                  width: exportProgress.isExporting
                    ? `${exportProgress.percentage}%`
                    : `${
                        (flyoverState.currentTrackpointIndex /
                          validTrackpoints.length) *
                        100
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
                {exportProgress.isExporting
                  ? `Exporting frame ${exportProgress.frame}`
                  : flyoverState.isPlaying
                  ? `Playing: ${flyoverState.currentTrackpointIndex}s`
                  : `Flyover: 60s (30fps preview)`}
              </span>
            </div>
          </div>

          {/* 3D Map with Aspect Ratio Container */}
          <div className="mb-4">
            <div
              className="relative w-full bg-gray-100 rounded-lg overflow-hidden"
              style={{
                aspectRatio: orientation === "landscape" ? "16/9" : "9/16",
              }}
            >
              <FlyoverMap
                ref={flyoverMapRef}
                activity={enhancedActivity}
                flyoverState={flyoverState}
                onFlyoverEnd={handleFlyoverEnd}
                orientation={orientation}
                resetSignal={resetAnimationTrigger}
                onExportProgress={handleExportProgress}
                onExportComplete={handleExportComplete}
                onExportError={handleExportError}
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
