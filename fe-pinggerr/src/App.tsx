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
import { ActivityVisualization } from "@/components/ActivityVisualization";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import type { StravaActivity } from "@/types/strava";

// Import Connect with Strava SVG
import StravaConnectButton from "@/assets/btn_strava_connect_with_orange_x2.svg";

function MainApp() {
  const { isAuthenticated, login, logout, error } = useStravaAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] =
    useState<StravaActivity | null>(null);
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
  };

  const handleBackToList = () => {
    setSelectedActivity(null);
  };

  if (isCallbackRoute) {
    return (
      <AuthCallback onSuccess={handleAuthSuccess} onError={handleAuthError} />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {/* <span className="text-brand-pink">Strava</span>{" "}
            <span className="text-brand-green">Activity</span> Visualizer */}
            Strava Activity Visualizer
          </h1>
          <p className="text-muted-foreground text-lg">
            Create beautiful, shareable graphics of your Strava activities
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
                  Connect Your Strava Account
                </CardTitle>
                <CardDescription>
                  Connect your Strava account to generate beautiful
                  visualizations of your recent activities
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
          ) : (
            <div className="space-y-6">
              {/* Connection Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-2">
                      Connected to Strava
                      <Badge className="bg-brand-green text-white">
                        Active
                      </Badge>
                    </div>
                    <Button
                      onClick={logout}
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground self-start sm:self-auto"
                    >
                      Disconnect
                    </Button>
                  </CardTitle>
                  {selectedActivity && (
                    <CardDescription>
                      <Button
                        onClick={handleBackToList}
                        variant="ghost"
                        size="sm"
                        className="text-brand-pink hover:text-brand-green p-0 h-auto"
                      >
                        ← Back to activities
                      </Button>
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>

              {/* Activity Content */}
              {!selectedActivity ? (
                <ActivityList onSelectActivity={handleSelectActivity} />
              ) : (
                <ActivityVisualization
                  activity={selectedActivity}
                  onDownload={(imageUrl) => {
                    console.log("Image downloaded:", imageUrl);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-muted-foreground">
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
