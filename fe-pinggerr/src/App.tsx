import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthCallback } from "@/components/AuthCallback";
import { ActivityList } from "@/components/ActivityList";
import { PinggerrLayout } from "@/components/PinggerrLayout";
import { Footer } from "@/components/Footer";
import { PinkGreenActivity } from "@/pages/PinkGreenActivity";
// import { ThreeDStories } from "@/pages/ThreeDStories";
import { StravaDefaultStyle } from "@/pages/StravaDefaultStyle";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import { useStravaActivityDetails } from "@/hooks/useStravaQueries";
import { processTcxFromFile } from "@/lib/tcxParser";
import {
  loadActivityFromLocalStorage,
  isCachedActivityStale,
  clearOldActivityCache,
} from "@/lib/queryClient";
import type { StravaActivity } from "@/types/strava";
import { useQueryClient } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/queryClient";

// Import Connect with Strava SVG
import StravaConnectButton from "@/assets/btn_strava_connect_with_orange_x2.svg";
import { LiquidGlassActivity } from "./pages/LiquidGlassActivity";
import { ModernMinimalistActivity } from "./pages/ModernMinimalistActivity";
import { MinimalistSerifWithRoute } from "./pages/MinimalistSerifWithRoute";
import { MinimalistSerifWithNoRoute } from "./pages/MinimalistSerifWithNoRoute";

function MainApp() {
  const { isAuthenticated, login, logout, error } = useStravaAuth();
  const queryClient = useQueryClient();
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] =
    useState<StravaActivity | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingTcx, setIsProcessingTcx] = useState<boolean>(false);
  const [tcxError, setTcxError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [showDisconnectNotice, setShowDisconnectNotice] =
    useState<boolean>(false);
  const [language, setLanguage] = useState<"en" | "id">("en");
  const location = useLocation();
  const navigate = useNavigate();

  // Clean up old localStorage cache on app startup
  useEffect(() => {
    // Clean up activities older than 7 days
    clearOldActivityCache();
  }, []);

  // Use cached query for activity details
  const { data: cachedActivityDetails, rateLimitInfo } =
    useStravaActivityDetails(selectedActivityId);

  // Handle OAuth callback
  const isCallbackRoute = location.pathname === "/auth/callback";

  const handleAuthSuccess = () => {
    setAuthError(null);
    // Navigate to main app without reloading
    navigate("/", { replace: true });
  };

  const handleAuthError = (error: string) => {
    setAuthError(error);
  };

  const handleSelectActivity = async (activity: StravaActivity) => {
    if (activity.source === "strava") {
      // Try to load from cache first (localStorage or query cache)
      const cached = loadActivityFromLocalStorage(activity.id);

      if (cached) {
        // Check if cached data is stale by comparing with activity list entry
        const isStale = isCachedActivityStale(cached, activity);

        if (isStale) {
          console.log(
            `Cached activity ${activity.id} is stale, invalidating cache and refetching`
          );

          // Remove from both query cache and localStorage to force fresh fetch
          queryClient.removeQueries({
            queryKey: [CACHE_KEYS.activityDetails(activity.id)],
          });
          localStorage.removeItem(CACHE_KEYS.activityDetails(activity.id));

          // Show summary while loading fresh details
          setSelectedActivity(activity);
          setSelectedActivityId(activity.id);
          navigate("/visualization/pinkgreen-activity");

          // The query hook will fetch fresh details automatically
          // Since we removed the query, it will treat it as a new query and fetch immediately
        } else {
          console.log(`Using cached activity ${activity.id} (verified fresh)`);
          setSelectedActivity(cached as StravaActivity);
          setSelectedActivityId(activity.id);
          navigate("/visualization/pinkgreen-activity");
        }
      } else {
        // No cache, show summary while loading details
        setSelectedActivity(activity);
        setSelectedActivityId(activity.id);
        navigate("/visualization/pinkgreen-activity");

        // The query hook will fetch details automatically
        // and update cachedActivityDetails
      }
    } else {
      // For TCX or other sources, use provided activity as-is
      setSelectedActivity(activity);
      setSelectedActivityId(null);
      navigate("/visualization/pinkgreen-activity");
    }
  };

  const handleBackToList = () => {
    setSelectedActivity(null);
    setSelectedActivityId(null);
    setSelectedFile(null);
    setTcxError(null);
    setShowInstructions(false);
  };

  const handleLogoClick = () => {
    // for now, just go back to the list
    handleBackToList();
  };

  const handleDisconnect = () => {
    setShowDisconnectNotice(true);
    logout();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTcxError(null);
    }
  };

  const handleProcessTcx = async () => {
    if (!selectedFile) return;
    console.log("Processing TCX file:", selectedFile);

    setIsProcessingTcx(true);
    setTcxError(null);

    try {
      const stravaActivity = await processTcxFromFile(selectedFile);
      console.log("Processed TCX file:", stravaActivity);
      setSelectedActivity(stravaActivity);
      // Navigate to default visualization (pinkgreen-activity)
      navigate("/visualization/pinkgreen-activity");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to process activity";
      setTcxError(errorMessage);
    } finally {
      setIsProcessingTcx(false);
    }
  };

  if (isCallbackRoute) {
    return (
      <AuthCallback onSuccess={handleAuthSuccess} onError={handleAuthError} />
    );
  }

  // If an activity is selected, show the visualization layout
  if (selectedActivity) {
    // Use cached details if available, otherwise use the selected activity
    const activityToShow = cachedActivityDetails || selectedActivity;

    // Determine current visualization type based on pathname
    const getVisualizationType = (
      pathname: string,
      lang: "en" | "id"
    ): string => {
      if (pathname.includes("3d-stories")) {
        return lang === "en" ? "3D Stories" : "Cerita 3D";
      }
      if (pathname.includes("liquid-glass-activity")) {
        return lang === "en" ? "Liquid Glass Activity" : "Aktivitas Kaca Cair";
      }
      if (pathname.includes("modern-minimalist-activity")) {
        return lang === "en"
          ? "Modern Minimalist Activity"
          : "Aktivitas Minimalist Modern";
      }
      if (pathname.includes("strava-default-style")) {
        return lang === "en"
          ? "White Orange Activity"
          : "Aktivitas Orange Putih";
      }
      if (pathname.includes("pinkgreen-activity")) {
        return lang === "en" ? "PinkGreen Activity" : "Aktivitas PinkGreen";
      }
      if (pathname.includes("minimalist-serif-with-route")) {
        return lang === "en"
          ? "Minimalist Serif With Route"
          : "Serif Minimalis Dengan Rute";
      }
      if (pathname.includes("minimalist-serif-no-route")) {
        return lang === "en"
          ? "Minimalist Serif No Route"
          : "Serif Minimalis Tanpa Rute";
      }
      // Default fallback
      return lang === "en" ? "PinkGreen Activity" : "Aktivitas PinkGreen";
    };

    const currentVisualizationType = getVisualizationType(
      location.pathname,
      language
    );

    return (
      <>
        {/* Rate Limit Warning Banner */}
        {rateLimitInfo.isLimited && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 shadow-lg">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <p className="text-sm font-medium">
                  {language === "en"
                    ? "Strava API rate limit reached. Showing cached data."
                    : "Batas API Strava tercapai. Menampilkan data cache."}
                </p>
              </div>
              {rateLimitInfo.usage && (
                <p className="text-xs opacity-90">
                  Usage: {rateLimitInfo.usage}
                </p>
              )}
            </div>
          </div>
        )}
        <PinggerrLayout
          activity={activityToShow}
          language={language}
          isAuthenticated={isAuthenticated}
          onBackToList={handleBackToList}
          onLanguageChange={setLanguage}
          currentVisualizationType={currentVisualizationType}
          onLogoClick={handleLogoClick}
          // isLoadingActivity={isLoadingActivity}
        >
          <Routes>
            <Route
              path="/visualization/pinkgreen-activity"
              element={
                <PinkGreenActivity
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
            <Route
              path="/visualization/strava-default-style"
              element={
                <StravaDefaultStyle
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
            {/* <Route
              path="/visualization/3d-stories"
              element={
                <ThreeDStories
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            /> */}
            <Route
              path="/visualization/liquid-glass-activity"
              element={
                <LiquidGlassActivity
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
            <Route
              path="/visualization/modern-minimalist-activity"
              element={
                <ModernMinimalistActivity
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
            <Route
              path="/visualization/minimalist-serif-with-route"
              element={
                <MinimalistSerifWithRoute
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
            <Route
              path="/visualization/minimalist-serif-no-route"
              element={
                <MinimalistSerifWithNoRoute
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
            {/* Default redirect to pinkgreen activity */}
            <Route
              path="*"
              element={
                <PinkGreenActivity
                  activity={activityToShow}
                  language={language}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              }
            />
          </Routes>
        </PinggerrLayout>
      </>
    );
  }

  // Main page layout
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setLanguage(language === "en" ? "id" : "en")}
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
            >
              {language === "en" ? "🇺🇸 EN (English)" : "🇮🇩 ID (Indonesia)"}
            </Button>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            {language === "en"
              ? "Pinggerr: Visualize and Share Your Activity"
              : "Pinggerr: Visualisasikan dan Bagikan Aktivitas Anda"}
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg px-4">
            {language === "en"
              ? "Create beautiful, shareable graphics of your activities"
              : "Buat grafik aktivitas yang indah dan dapat dibagikan"}
          </p>
        </div>

        {/* Error Display */}
        {(error || authError) && (
          <div className="max-w-2xl mx-auto mb-6">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-600 text-center">{error || authError}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {!isAuthenticated ? (
            <div className="space-y-6">
              {showDisconnectNotice && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowDisconnectNotice(false)}
                        aria-label={
                          language === "en"
                            ? "Dismiss notice"
                            : "Tutup pemberitahuan"
                        }
                        className="text-amber-800/70 hover:text-amber-900 text-xs px-2 py-1 rounded hover:bg-amber-100 border border-transparent hover:border-amber-200"
                      >
                        {language === "en" ? "Close" : "Tutup"}
                      </button>
                    </div>
                    <div className="space-y-2 text-amber-900 text-m">
                      <p className="font-medium">
                        {language === "en"
                          ? "You’re signed out of Pinggerr, but still connected on Strava."
                          : "Anda sudah keluar dari Pinggerr, tetapi masih terhubung di Strava."}
                      </p>
                      <p>
                        {language === "en"
                          ? "To fully revoke access: open Strava (desktop) → Settings → My Apps, find ‘Pinggerr’, then click Revoke Access."
                          : "Untuk mencabut akses sepenuhnya: buka Strava (desktop) → Settings → My Apps, cari ‘Pinggerr’, lalu klik Revoke Access."}
                      </p>
                      <p className="text-amber-800/80 text-sm">
                        {language === "en"
                          ? "Note: Strava doesn’t provide apps a way to remotely disconnect your Strava account — revocation must be done in Strava."
                          : "Catatan: Strava tidak menyediakan cara bagi aplikasi untuk memutuskan akun Strava Anda dari jarak jauh — pencabutan harus dilakukan di Strava."}
                      </p>
                      <div className="pt-1">
                        <a
                          href="https://www.strava.com/settings/apps"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-amber-300 text-amber-900 hover:bg-amber-100"
                        >
                          {language === "en"
                            ? "Open Strava My Apps"
                            : "Buka Strava My Apps"}
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Upload Options Header */}
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    {language === "en"
                      ? "How do you want to upload your activities?"
                      : "Bagaimana Anda ingin mengunggah aktivitas Anda?"}
                  </CardTitle>
                  <CardDescription>
                    {language === "en"
                      ? "Choose your preferred method to create beautiful visualizations"
                      : "Pilih metode yang Anda sukai untuk membuat visualisasi yang indah"}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Option 1: Connect with Strava */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="text-center">
                  <CardTitle className="text-green-800">
                    {language === "en"
                      ? "1. Connect with Strava"
                      : "1. Hubungkan dengan Strava"}
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    {language === "en"
                      ? "Access your recent activities directly from your Strava account"
                      : "Akses aktivitas terbaru Anda langsung dari akun Strava"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <button
                    onClick={login}
                    className="transition-transform hover:scale-105 active:scale-95"
                  >
                    <img
                      src={StravaConnectButton}
                      alt="Connect with Strava"
                      className="h-12 w-auto mx-auto"
                    />
                  </button>
                </CardContent>
              </Card>

              {/* Option 2: Upload TCX */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="text-center">
                  <CardTitle className="text-orange-800">
                    {language === "en"
                      ? "2. Upload TCX File"
                      : "2. Unggah File TCX"}
                  </CardTitle>
                  <CardDescription className="text-orange-700">
                    {language === "en"
                      ? "Upload your activity's TCX file for complete privacy and control"
                      : "Unggah file TCX aktivitas Anda untuk privasi dan kontrol penuh"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    {/* <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                      <strong>
                        🔒{" "}
                        {language === "en"
                          ? "Privacy First:"
                          : "Privasi Utama:"}
                      </strong>{" "}
                      {language === "en"
                        ? "TCX files contain your activity data (GPS, heart rate, etc.) and are processed completely locally in your browser. Your data never leaves your device - no uploads to servers!"
                        : "File TCX berisi data aktivitas Anda (GPS, detak jantung, dll.) dan diproses sepenuhnya secara lokal di browser Anda. Data Anda tidak pernah meninggalkan perangkat - tidak ada unggahan ke server!"}
                    </p> */}
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>
                        {language === "en" ? "What's TCX?" : "Apa itu TCX?"}
                      </strong>{" "}
                      {language === "en"
                        ? "Training Center XML - Strava's export format containing all your workout details like route, pace, elevation, and heart rate data."
                        : "Training Center XML - format ekspor Strava yang berisi semua detail latihan seperti rute, kecepatan, elevasi, dan data detak jantung."}
                    </p>
                  </div>

                  {/* Instructions Button */}
                  <div className="mb-3">
                    <Button
                      onClick={() => setShowInstructions(!showInstructions)}
                      variant="outline"
                      size="sm"
                      className="text-orange-700 border-orange-300 hover:bg-orange-100 w-full sm:w-auto h-auto py-2 px-3"
                    >
                      <span className="flex flex-col sm:flex-row sm:items-center gap-1 text-center sm:text-left">
                        <span>
                          {language === "en"
                            ? `${
                                showInstructions ? "📋 Hide" : "📋 Show"
                              } Instructions`
                            : `${
                                showInstructions
                                  ? "📋 Sembunyikan"
                                  : "📋 Tampilkan"
                              } Instruksi`}
                        </span>
                        <span className="hidden sm:inline">
                          {language === "en"
                            ? "for Downloading TCX File"
                            : "Untuk Mengunduh File TCX"}
                        </span>
                        <span className="sm:hidden">
                          {language === "en"
                            ? "for Downloading"
                            : "Untuk Mengunduh"}
                        </span>
                        <span className="sm:hidden">
                          {language === "en" ? "TCX File" : "File TCX"}
                        </span>
                      </span>
                    </Button>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file"
                        accept=".tcx"
                        onChange={handleFileSelect}
                        className="w-full px-3 py-2 border border-orange-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent"
                        disabled={isProcessingTcx}
                      />
                      <Button
                        onClick={handleProcessTcx}
                        disabled={!selectedFile || isProcessingTcx}
                        className="bg-brand-green hover:bg-brand-pink/90 text-white text-sm px-4 py-2 w-full sm:w-auto sm:min-w-[140px]"
                      >
                        {isProcessingTcx
                          ? language === "en"
                            ? "Processing..."
                            : "Memproses..."
                          : language === "en"
                          ? "Create Graphic"
                          : "Buat Grafik"}
                      </Button>
                    </div>

                    {selectedFile && (
                      <div className="text-sm text-orange-700">
                        📁 {language === "en" ? "Selected:" : "Terpilih:"}{" "}
                        {selectedFile.name} (
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                      </div>
                    )}

                    {tcxError && (
                      <div className="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">
                        {tcxError}
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  {showInstructions && (
                    <div className="text-left mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-3 text-sm sm:text-base">
                        📱{" "}
                        {language === "en"
                          ? "How to Download TCX File"
                          : "Cara Download File TCX"}
                      </h3>

                      {/* Video Tutorial */}
                      <div className="mb-4 flex justify-center">
                        <div className="w-full max-w-sm">
                          <iframe
                            width="100%"
                            height="315"
                            src="https://www.youtube.com/embed/M_HG8T7v_7c"
                            title="TCX Download Tutorial"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="rounded-lg"
                          ></iframe>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-blue-700 mb-3 text-center italic">
                        {language === "en"
                          ? "📺 Watch the video tutorial above, or follow the written steps below"
                          : "📺 Tonton tutorial video di atas, atau ikuti langkah tertulis di bawah"}
                      </p>

                      <div className="text-xs sm:text-sm text-blue-700 space-y-3">
                        {language === "en" ? (
                          // English Instructions
                          <>
                            <div>
                              <strong>Desktop:</strong>
                              <ol className="list-decimal list-inside ml-2 sm:ml-4 mt-1 space-y-2">
                                <li>Log in to Strava on your browser</li>
                                <li>
                                  Open your activity page (e.g.,{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/12345678901
                                  </code>
                                  )
                                </li>
                                <li>
                                  Add{" "}
                                  <code className="bg-blue-100 px-1 rounded">
                                    /export_tcx
                                  </code>{" "}
                                  to the end of the URL
                                </li>
                                <li>
                                  Final URL:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/12345678901/export_tcx
                                  </code>
                                </li>
                                <li>
                                  Put final URL in your browser's address bar
                                  and press Enter. TCX file will download
                                  automatically
                                </li>
                              </ol>
                            </div>
                            <div>
                              <strong>Mobile:</strong>
                              <ol className="list-decimal list-inside ml-2 sm:ml-4 mt-1 space-y-2">
                                <li>Share your activity and copy the link</li>
                                <li>
                                  Shared link looks like:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://strava.app.link/abc123xyz
                                  </code>
                                </li>
                                <li>
                                  Open the link in browser incognito mode and
                                  log in to Strava
                                </li>
                                <li>
                                  Clean the URL (remove everything after the
                                  activity ID):{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/98765432109
                                  </code>
                                </li>
                                <li>
                                  Add{" "}
                                  <code className="bg-blue-100 px-1 rounded">
                                    /export_tcx
                                  </code>{" "}
                                  to the end
                                </li>
                                <li>
                                  Final URL:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/98765432109/export_tcx
                                  </code>
                                </li>
                                <li>
                                  Put final URL in your browser's address bar
                                  and press Enter. TCX file will download
                                  automatically
                                </li>
                              </ol>
                            </div>
                          </>
                        ) : (
                          // Indonesian Instructions
                          <>
                            <div>
                              <strong>Desktop:</strong>
                              <ol className="list-decimal list-inside ml-2 sm:ml-4 mt-1 space-y-2">
                                <li>Login ke Strava di browser</li>
                                <li>
                                  Buka halaman aktivitas Anda (contoh:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/12345678901
                                  </code>
                                  )
                                </li>
                                <li>
                                  Tambahkan{" "}
                                  <code className="bg-blue-100 px-1 rounded">
                                    /export_tcx
                                  </code>{" "}
                                  di akhir URL
                                </li>
                                <li>
                                  URL final:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/12345678901/export_tcx
                                  </code>
                                </li>
                                <li>
                                  Buka URL final di browser Anda dan tekan
                                  Enter. File TCX akan otomatis terdownload
                                </li>
                              </ol>
                            </div>
                            <div>
                              <strong>Mobile:</strong>
                              <ol className="list-decimal list-inside ml-2 sm:ml-4 mt-1 space-y-2">
                                <li>Share aktivitas dan copy linknya</li>
                                <li>
                                  Link share seperti:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://strava.app.link/def456uvw
                                  </code>
                                </li>
                                <li>
                                  Buka link di browser dan login ke Strava di
                                  browser
                                </li>
                                <li>
                                  Bersihkan URL (hapus semua setelah ID
                                  aktivitas):{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/98765432109
                                  </code>
                                </li>
                                <li>
                                  Tambahkan{" "}
                                  <code className="bg-blue-100 px-1 rounded">
                                    /export_tcx
                                  </code>{" "}
                                  di akhir
                                </li>
                                <li>
                                  URL final:{" "}
                                  <code className="bg-blue-100 px-1 rounded text-xs break-all">
                                    https://www.strava.com/activities/98765432109/export_tcx
                                  </code>
                                </li>
                                <li>
                                  Buka URL final di browser Anda dan tekan
                                  Enter. File TCX akan otomatis terdownload
                                </li>
                              </ol>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connection Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {language === "en"
                        ? "Connected to Strava"
                        : "Terhubung ke Strava"}
                      <Badge className="bg-brand-green text-white">
                        {language === "en" ? "Active" : "Aktif"}
                      </Badge>
                    </div>
                    <Button
                      onClick={handleDisconnect}
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground self-start sm:self-auto"
                    >
                      {language === "en" ? "Disconnect" : "Putuskan"}
                    </Button>
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Activity Content */}
              <ActivityList onSelectActivity={handleSelectActivity} />
            </div>
          )}
        </div>

        {/* Privacy Disclaimer */}
        <div className="max-w-2xl mx-auto mt-8 mb-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-blue-800 text-sm">
                  <strong>
                    {language === "en"
                      ? "Privacy Notice:"
                      : "Pemberitahuan Privasi:"}
                  </strong>{" "}
                  {language === "en"
                    ? "Your Strava data is processed locally in your browser and is not stored on our servers. Only you can see your activity data - it remains completely private and secure."
                    : "Data Strava Anda diproses secara lokal di browser Anda dan tidak disimpan di server kami. Hanya Anda yang dapat melihat data aktivitas Anda - data tetap sepenuhnya pribadi dan aman."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <Footer language={language} />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;
