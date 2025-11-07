import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useStravaActivities,
  useStravaActivityPrefetch,
} from "@/hooks/useStravaQueries";
import type { ActivityListProps } from "@/types/strava";

// Import Strava logo
// import stravaLogo from "@/assets/api_logo_pwrdBy_strava_horiz_orange.png";

export const ActivityList: React.FC<ActivityListProps> = ({
  onSelectActivity,
}) => {
  // const { isAuthenticated } = useStravaAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 30; // Strava's default per_page value

  // Use the new caching hook
  const {
    data: allActivities,
    isLoading: loading,
    error: queryError,
    rateLimitInfo,
  } = useStravaActivities(1, perPage * currentPage);
  const { prefetchActivity } = useStravaActivityPrefetch();

  // Filter to only show running activities
  const activities =
    allActivities?.filter(
      (activity) => activity.type === "Run" || activity.sport_type === "Run"
    ) || [];

  const hasMorePages = allActivities?.length === perPage * currentPage;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load activities"
    : null;

  const loadMoreActivities = () => {
    setCurrentPage((prev) => prev + 1);
  };

  // Prefetch activity details on hover for instant loading
  const handleActivityHover = (activityId: number) => {
    prefetchActivity(activityId);
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

  if (rateLimitInfo.isLimited) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-800">
            ⚠️ Strava API Rate Limit Reached
          </CardTitle>
          <CardDescription className="text-amber-700">
            {rateLimitInfo.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 mb-3">
            Strava limits API requests to 300 per 15 minutes and 3,000 per day.
            Please try again in a few minutes, or cached activities will load
            automatically.
          </p>
          <Button
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            Cached data will be available shortly
          </Button>
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
          <p className="text-sm text-muted-foreground mb-3">
            Don't worry - your previously viewed activities may still be
            available in the cache.
          </p>
          <Button variant="outline">Try Again Later</Button>
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
          {/* Show Strava logo since all activities in this list are from Strava
          <img
            src={stravaLogo}
            alt="Powered by Strava"
            className="h-4 w-auto ml-2"
          /> */}
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
                  onMouseEnter={() => handleActivityHover(activity.id)}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent double-triggering from parent div
                    onSelectActivity(activity);
                  }}
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
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground">
                      {formatDate(activity.start_date)}
                    </div>
                    <a
                      href={`https://www.strava.com/activities/${activity.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium underline"
                      style={{ color: "#FC5200" }}
                    >
                      View on Strava
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-pink hover:text-brand-green hover:bg-brand-pink/10"
                    onMouseEnter={() => handleActivityHover(activity.id)}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent double-triggering from parent div
                      onSelectActivity(activity);
                    }}
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
              disabled={loading}
              className="w-full"
            >
              {loading ? "Loading..." : "Load More Activities"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
