import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import type { StravaActivity, ActivityListProps } from "@/types/strava";

export const ActivityList: React.FC<ActivityListProps> = ({
  onSelectActivity,
}) => {
  const { fetchActivities, isAuthenticated, tokens } = useStravaAuth();
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const perPage = 30; // Strava's default per_page value

  useEffect(() => {
    // Only load activities if authenticated and tokens are available
    if (isAuthenticated && tokens) {
      loadActivities();
    }
  }, [isAuthenticated, tokens]);

  // Listen for auth success events
  useEffect(() => {
    const handleAuthSuccess = () => {
      // Small delay to ensure tokens are set
      setTimeout(() => {
        loadActivities();
      }, 200);
    };

    window.addEventListener("strava-auth-success", handleAuthSuccess);
    return () =>
      window.removeEventListener("strava-auth-success", handleAuthSuccess);
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchActivities(1, perPage);
      // Filter to only show running activities
      const runningActivities = data.filter(
        (activity) => activity.type === "Run" || activity.sport_type === "Run"
      );

      setActivities(runningActivities);
      setCurrentPage(1);
      // If we got less than perPage activities, we've reached the end
      setHasMorePages(data.length === perPage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activities"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMoreActivities = async () => {
    if (!hasMorePages || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = currentPage + 1;
      const data = await fetchActivities(nextPage, perPage);

      // Filter to only show running activities
      const runningActivities = data.filter(
        (activity) => activity.type === "Run" || activity.sport_type === "Run"
      );

      setActivities((prev) => [...prev, ...runningActivities]);
      setCurrentPage(nextPage);
      // If we got less than perPage activities, we've reached the end
      setHasMorePages(data.length === perPage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more activities"
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatPace = (distanceMeters: number, timeSeconds: number) => {
    const kmh = distanceMeters / 1000 / (timeSeconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getActivityTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "run":
        return "bg-brand-pink text-brand-green";
      case "ride":
        return "bg-brand-green text-white";
      case "walk":
        return "bg-blue-100 text-blue-800";
      case "hike":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Activities...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">
            Error Loading Activities
          </CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadActivities} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Activities Found</CardTitle>
          <CardDescription>
            You don't have any activities yet. Go for a run or ride and they'll
            appear here!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Recent Activities
          <Badge variant="outline">{activities.length}</Badge>
        </CardTitle>
        <CardDescription>
          Select a running activity to create a beautiful visualization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onSelectActivity(activity)}
            >
              {/* Desktop layout */}
              <div className="hidden sm:flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium truncate">{activity.name}</h3>
                    <Badge className={getActivityTypeColor(activity.type)}>
                      {activity.type}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-brand-pink">📏</span>
                        <span>{formatDistance(activity.distance)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-brand-green">⏱️</span>
                        <span>{formatTime(activity.moving_time)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-brand-pink">🚀</span>
                        <span>
                          {formatPace(activity.distance, activity.moving_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-brand-green">⛰️</span>
                        <span>{activity.total_elevation_gain}m</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDate(activity.start_date)}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-4 text-brand-pink hover:text-brand-green hover:bg-brand-pink/10"
                >
                  Visualize →
                </Button>
              </div>

              {/* Mobile layout */}
              <div className="sm:hidden">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium truncate flex-1">
                    {activity.name}
                  </h3>
                  <Badge className={getActivityTypeColor(activity.type)}>
                    {activity.type}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-brand-pink">📏</span>
                      <span>{formatDistance(activity.distance)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-brand-green">⏱️</span>
                      <span>{formatTime(activity.moving_time)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-brand-pink">🚀</span>
                      <span>
                        {formatPace(activity.distance, activity.moving_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-brand-green">⛰️</span>
                      <span>{activity.total_elevation_gain}m</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {formatDate(activity.start_date)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-pink hover:text-brand-green hover:bg-brand-pink/10"
                  >
                    Visualize →
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMorePages && (
          <div className="mt-4 text-center">
            <Button
              onClick={loadMoreActivities}
              variant="outline"
              disabled={loadingMore}
              className="w-full"
            >
              {loadingMore ? "Loading..." : "Load More Activities"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
