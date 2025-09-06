import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Line, Circle, Text, Rect, Group } from "react-konva";
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareDialog } from "@/components/ShareDialog";

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

interface ActivityVisualizationProps {
  activity: StravaActivity;
  onDownload?: (imageUrl: string) => void;
}

export const ActivityVisualization: React.FC<ActivityVisualizationProps> = ({
  activity,
  onDownload,
}) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );

  // Colors from PRD
  const BRAND_PINK = "#F99FD2";
  const BRAND_GREEN = "#165027";

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const width = Math.min(container.clientWidth - 32, 800);
        const height = Math.min(width * 0.75, 600);
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Helper functions for formatting
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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

  // Process polyline data for map visualization
  const processPolyline = () => {
    const polyline = activity.map?.polyline || activity.map?.summary_polyline;
    if (!polyline) return [];

    try {
      const coordinates = decode(polyline);
      if (coordinates.length === 0) return [];

      // Find bounds
      const lats = coordinates.map((coord) => coord[0]);
      const lngs = coordinates.map((coord) => coord[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Map to canvas coordinates (leave space for stats)
      const mapWidth = dimensions.width - 100;
      const mapHeight = dimensions.height - 200;
      const mapX = 50;
      const mapY = 100;

      return coordinates.map(([lat, lng]) => {
        const x = mapX + ((lng - minLng) / (maxLng - minLng)) * mapWidth;
        const y = mapY + ((maxLat - lat) / (maxLat - minLat)) * mapHeight;
        return { x, y };
      });
    } catch (error) {
      console.error("Error processing polyline:", error);
      return [];
    }
  };

  const pathPoints = processPolyline();

  // Generate image for download/sharing
  const generateImage = async () => {
    if (!stageRef.current) return null;

    setIsGenerating(true);
    try {
      // Get the stage as a data URL
      const dataURL = stageRef.current.toDataURL({
        mimeType: "image/png",
        quality: 1,
        pixelRatio: 2, // High DPI
      });

      setGeneratedImageUrl(dataURL);
      return dataURL;
    } catch (error) {
      console.error("Error generating image:", error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Download image
  const handleDownload = async () => {
    const imageUrl = generatedImageUrl || (await generateImage());
    if (!imageUrl) return;

    // Create download link
    const link = document.createElement("a");
    link.download = `${activity.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_strava_viz.png`;
    link.href = imageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onDownload) {
      onDownload(imageUrl);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-brand-pink">🎨</span>
            Activity Visualization
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-brand-pink hover:bg-brand-pink/90 text-brand-green"
            >
              {isGenerating ? "Generating..." : "💾 Download"}
            </Button>
            <ShareDialog
              activity={activity}
              imageUrl={generatedImageUrl || undefined}
            >
              <Button
                variant="outline"
                disabled={isGenerating}
                className="border-brand-green text-brand-green hover:bg-brand-green hover:text-white"
              >
                📤 Share
              </Button>
            </ShareDialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden bg-white">
            <Stage
              width={dimensions.width}
              height={dimensions.height}
              ref={stageRef}
            >
              <Layer>
                {/* Background */}
                <Rect
                  x={0}
                  y={0}
                  width={dimensions.width}
                  height={dimensions.height}
                  fill="white"
                />

                {/* Title */}
                <Text
                  x={dimensions.width / 2}
                  y={20}
                  text={activity.name}
                  fontSize={24}
                  fontFamily="Arial, sans-serif"
                  fontStyle="bold"
                  fill={BRAND_GREEN}
                  width={dimensions.width - 40}
                  align="center"
                />

                {/* Activity Type Badge */}
                <Rect
                  x={dimensions.width / 2 - 40}
                  y={55}
                  width={80}
                  height={25}
                  fill={BRAND_PINK}
                  cornerRadius={12}
                />
                <Text
                  x={dimensions.width / 2}
                  y={62}
                  text={activity.type.toUpperCase()}
                  fontSize={12}
                  fontFamily="Arial, sans-serif"
                  fontStyle="bold"
                  fill={BRAND_GREEN}
                  align="center"
                />

                {/* Map Path */}
                {pathPoints.length > 1 && (
                  <>
                    {/* Path line */}
                    <Line
                      points={pathPoints.flatMap((p) => [p.x, p.y])}
                      stroke={BRAND_GREEN}
                      strokeWidth={3}
                      lineJoin="round"
                      lineCap="round"
                    />

                    {/* Start point */}
                    <Circle
                      x={pathPoints[0].x}
                      y={pathPoints[0].y}
                      radius={6}
                      fill={BRAND_PINK}
                      stroke="white"
                      strokeWidth={2}
                    />

                    {/* End point */}
                    <Circle
                      x={pathPoints[pathPoints.length - 1].x}
                      y={pathPoints[pathPoints.length - 1].y}
                      radius={6}
                      fill={BRAND_GREEN}
                      stroke="white"
                      strokeWidth={2}
                    />
                  </>
                )}

                {/* Stats Panel */}
                <Group>
                  {/* Stats Background */}
                  <Rect
                    x={20}
                    y={dimensions.height - 150}
                    width={dimensions.width - 40}
                    height={120}
                    fill={BRAND_PINK}
                    opacity={0.1}
                    cornerRadius={8}
                  />

                  {/* Distance */}
                  <Text
                    x={40}
                    y={dimensions.height - 130}
                    text="DISTANCE"
                    fontSize={12}
                    fontFamily="Arial, sans-serif"
                    fill={BRAND_GREEN}
                    opacity={0.8}
                  />
                  <Text
                    x={40}
                    y={dimensions.height - 110}
                    text={formatDistance(activity.distance)}
                    fontSize={20}
                    fontFamily="Arial, sans-serif"
                    fontStyle="bold"
                    fill={BRAND_GREEN}
                  />

                  {/* Time */}
                  <Text
                    x={dimensions.width / 2 - 60}
                    y={dimensions.height - 130}
                    text="TIME"
                    fontSize={12}
                    fontFamily="Arial, sans-serif"
                    fill={BRAND_GREEN}
                    opacity={0.8}
                  />
                  <Text
                    x={dimensions.width / 2 - 60}
                    y={dimensions.height - 110}
                    text={formatTime(activity.moving_time)}
                    fontSize={20}
                    fontFamily="Arial, sans-serif"
                    fontStyle="bold"
                    fill={BRAND_GREEN}
                  />

                  {/* Pace */}
                  <Text
                    x={dimensions.width - 120}
                    y={dimensions.height - 130}
                    text="AVG SPEED"
                    fontSize={12}
                    fontFamily="Arial, sans-serif"
                    fill={BRAND_GREEN}
                    opacity={0.8}
                  />
                  <Text
                    x={dimensions.width - 120}
                    y={dimensions.height - 110}
                    text={formatPace(activity.distance, activity.moving_time)}
                    fontSize={20}
                    fontFamily="Arial, sans-serif"
                    fontStyle="bold"
                    fill={BRAND_GREEN}
                  />

                  {/* Elevation */}
                  <Text
                    x={40}
                    y={dimensions.height - 80}
                    text="ELEVATION GAIN"
                    fontSize={12}
                    fontFamily="Arial, sans-serif"
                    fill={BRAND_GREEN}
                    opacity={0.8}
                  />
                  <Text
                    x={40}
                    y={dimensions.height - 60}
                    text={`${activity.total_elevation_gain}m`}
                    fontSize={20}
                    fontFamily="Arial, sans-serif"
                    fontStyle="bold"
                    fill={BRAND_GREEN}
                  />

                  {/* Date */}
                  <Text
                    x={dimensions.width - 120}
                    y={dimensions.height - 80}
                    text="DATE"
                    fontSize={12}
                    fontFamily="Arial, sans-serif"
                    fill={BRAND_GREEN}
                    opacity={0.8}
                  />
                  <Text
                    x={dimensions.width - 120}
                    y={dimensions.height - 60}
                    text={formatDate(activity.start_date)}
                    fontSize={16}
                    fontFamily="Arial, sans-serif"
                    fontStyle="bold"
                    fill={BRAND_GREEN}
                  />
                </Group>

                {/* Brand Colors Indicator */}
                <Group>
                  <Circle
                    x={dimensions.width - 60}
                    y={30}
                    radius={8}
                    fill={BRAND_PINK}
                  />
                  <Circle
                    x={dimensions.width - 30}
                    y={30}
                    radius={8}
                    fill={BRAND_GREEN}
                  />
                </Group>
              </Layer>
            </Stage>
          </div>

          {/* Info below visualization */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>
              Visualization created with
              <span className="text-brand-pink font-medium">
                {" "}
                pink (#F99FD2){" "}
              </span>
              and
              <span className="text-brand-green font-medium">
                {" "}
                green (#165027){" "}
              </span>
              theme
            </p>
            {pathPoints.length === 0 && (
              <p className="mt-2 text-orange-600">
                ⚠️ No GPS data available for this activity - showing stats only
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
