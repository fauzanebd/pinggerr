import { useState } from "react";
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
import { PinkGreenActivity } from "@/pages/PinkGreenActivity";
import { ThreeDStories } from "@/pages/ThreeDStories";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import { processTcxFromFile } from "@/lib/tcxParser";
import type { StravaActivity } from "@/types/strava";

// Import Connect with Strava SVG
import StravaConnectButton from "@/assets/btn_strava_connect_with_orange_x2.svg";

function MainApp() {
  const { isAuthenticated, login, logout, error } = useStravaAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] =
    useState<StravaActivity | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingTcx, setIsProcessingTcx] = useState<boolean>(false);
  const [tcxError, setTcxError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [language, setLanguage] = useState<"en" | "id">("en");
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleSelectActivity = (activity: StravaActivity) => {
    setSelectedActivity(activity);
    // Navigate to default visualization (pinkgreen-activity)
    navigate("/visualization/pinkgreen-activity");
  };

  const handleBackToList = () => {
    setSelectedActivity(null);
    setSelectedFile(null);
    setTcxError(null);
    setShowInstructions(false);
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
    const currentVisualizationType = location.pathname.includes("3d-stories")
      ? language === "en"
        ? "3D Stories"
        : "Cerita 3D"
      : language === "en"
      ? "PinkGreen Activity"
      : "Aktivitas PinkGreen";

    return (
      <PinggerrLayout
        activity={selectedActivity}
        language={language}
        isAuthenticated={isAuthenticated}
        onBackToList={handleBackToList}
        onLanguageChange={setLanguage}
        currentVisualizationType={currentVisualizationType}
      >
        <Routes>
          <Route
            path="/visualization/pinkgreen-activity"
            element={
              <PinkGreenActivity
                activity={selectedActivity}
                language={language}
                onDownload={(imageUrl) => {
                  console.log("Image downloaded:", imageUrl);
                }}
              />
            }
          />
          <Route
            path="/visualization/3d-stories"
            element={
              <ThreeDStories
                activity={selectedActivity}
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
                activity={selectedActivity}
                language={language}
                onDownload={(imageUrl) => {
                  console.log("Image downloaded:", imageUrl);
                }}
              />
            }
          />
        </Routes>
      </PinggerrLayout>
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
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  {language === "en"
                    ? "Connect to Import Your Activities"
                    : "Hubungkan untuk Mengimpor Aktivitas Anda"}
                </CardTitle>
                <CardDescription>
                  {language === "en"
                    ? "Connect your account to generate beautiful visualizations of your recent activities"
                    : "Hubungkan akun Anda untuk membuat visualisasi yang indah dari aktivitas terbaru Anda"}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
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

                {/* TCX File Upload Option */}
                <div className="mt-4 p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800 leading-relaxed mb-3">
                    <strong>
                      🚀{" "}
                      {language === "en"
                        ? "Alternative Option (No Login to Strava):"
                        : "Opsi Alternatif (Tanpa Login ke Strava):"}
                    </strong>{" "}
                    {language === "en"
                      ? "Strava has not approved my app for a bigger limit for public API yet, but you can still create beautiful visualizations! Download your activity's TCX file from Strava and upload it here."
                      : "Strava belum menyetujui aplikasi saya untuk batas API publik yang lebih besar, tetapi Anda masih dapat membuat visualisasi yang indah! Unduh file TCX aktivitas Anda dari Strava dan unggah di sini."}
                  </p>

                  {/* What is TCX explanation */}
                  <div className="text-left mb-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs sm:text-xs text-blue-800 leading-relaxed">
                      <strong>
                        🔒{" "}
                        {language === "en"
                          ? "Privacy First:"
                          : "Privasi Utama:"}
                      </strong>{" "}
                      {language === "en"
                        ? "TCX files contain your activity data (GPS, heart rate, etc.) and are processed completely locally in your browser. Your data never leaves your device - no uploads to servers!"
                        : "File TCX berisi data aktivitas Anda (GPS, detak jantung, dll.) dan diproses sepenuhnya secara lokal di browser Anda. Data Anda tidak pernah meninggalkan perangkat - tidak ada unggahan ke server!"}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
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
                                Put final URL in your browser's address bar and
                                press Enter. TCX file will download
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
                                Open the link in browser incognito mode and log
                                in to Strava
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
                                Put final URL in your browser's address bar and
                                press Enter. TCX file will download
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
                                Buka URL final di browser Anda dan tekan Enter.
                                File TCX akan otomatis terdownload
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
                                Buka URL final di browser Anda dan tekan Enter.
                                File TCX akan otomatis terdownload
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
                      onClick={logout}
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
        <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
          <span>
            {language === "en" ? "developed by" : "dikembangkan oleh"}
          </span>
          <a
            href="https://instagram.com/fauzanebd"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-brand-green hover:text-brand-pink font-medium transition-colors"
          >
            fauzanebd
          </a>
          <span className="text-brand-pink">|</span>
          <a
            href="https://github.com/fauzanebd/pinggerr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-brand-green hover:text-brand-pink font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={18}
              height={18}
              fill="currentColor"
              viewBox="0 0 24 24"
              className="inline-block"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.606-2.665-.304-5.466-1.334-5.466-5.931 0-1.31.468-2.381 1.235-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.873.119 3.176.77.84 1.234 1.911 1.234 3.221 0 4.609-2.804 5.625-5.475 5.921.43.372.813 1.104.813 2.226 0 1.606-.015 2.898-.015 3.293 0 .321.218.694.825.576C20.565 21.796 24 17.299 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            github
          </a>
        </div>
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
