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

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  average_speed: number;
  max_speed: number;
  map?: {
    polyline?: string;
    summary_polyline?: string;
  };
}

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
            <span className="text-brand-pink">Strava</span>{" "}
            <span className="text-brand-green">Activity</span> Visualizer
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
                  <span className="text-brand-pink">●</span>
                  Connect Your Strava Account
                  <span className="text-brand-green">●</span>
                </CardTitle>
                <CardDescription>
                  Connect your Strava account to generate beautiful
                  visualizations of your recent activities
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={login}
                  className="bg-brand-pink hover:bg-brand-pink/90 text-brand-green font-semibold px-8 py-3"
                  size="lg"
                >
                  Connect with Strava
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Connection Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
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
                      className="text-muted-foreground hover:text-foreground"
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
          <p>Built with React, TypeScript, and Shadcn UI</p>
          <div className="flex justify-center gap-2 mt-2">
            <Badge
              variant="outline"
              className="border-brand-pink text-brand-pink"
            >
              Pink: #F99FD2
            </Badge>
            <Badge
              variant="outline"
              className="border-brand-green text-brand-green"
            >
              Green: #165027
            </Badge>
          </div>
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
