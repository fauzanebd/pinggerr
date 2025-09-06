import { useRef, useEffect, useState } from "react";
import {
  Stage,
  Layer,
  Line,
  Text,
  Rect,
  Group,
  Image as KonvaImage,
} from "react-konva";
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityVisualizationProps } from "@/types/strava";

// Strava logo
import stravaLogoWhite from "@/assets/api_logo_pwrdBy_strava_stack_white.svg";

export const ActivityVisualization: React.FC<ActivityVisualizationProps> = ({
  activity,
  onDownload,
}) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 993, height: 1238 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [checkerPattern, setCheckerPattern] =
    useState<HTMLCanvasElement | null>(null);

  // User customizable options
  const [selectedStats, setSelectedStats] = useState<string[]>([
    "distance",
    "pace",
    "time",
  ]);
  const [invertColors, setInvertColors] = useState(false);

  // Colors
  const BRAND_PINK = "#F99FD2";
  const BRAND_GREEN = "#165027";
  const dataColor = invertColors ? BRAND_GREEN : BRAND_PINK;
  const mapColor = invertColors ? BRAND_PINK : BRAND_GREEN;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth - 32;
        const maxWidth = Math.min(containerWidth, 993);
        const width = maxWidth;

        // Better mobile-responsive height calculation
        const isMobile = width < 640; // Tailwind's sm breakpoint
        let height;

        if (isMobile) {
          // Taller aspect ratio for mobile to give more space for text
          height = width * 1.4; // 1.4:1 ratio for mobile
        } else {
          // Square-ish for desktop
          height = width * 1.1; // Slightly taller than square
        }

        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Load Strava logo
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setLogoImage(img);
    };
    img.src = stravaLogoWhite;
    logoImageRef.current = img;
  }, []);

  // Create checker pattern when dimensions change
  useEffect(() => {
    const pattern = createCheckerBackground(
      dimensions.width,
      dimensions.height
    );
    setCheckerPattern(pattern);
  }, [dimensions]);

  // Helper functions for formatting
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatPace = (distanceMeters: number, timeSeconds: number) => {
    // Calculate pace as min/km (more common for running)
    const minutes = timeSeconds / 60;
    const km = distanceMeters / 1000;
    const paceMinPerKm = minutes / km;
    const paceMin = Math.floor(paceMinPerKm);
    const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
    return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
  };

  const formatSpeed = (distanceMeters: number, timeSeconds: number) => {
    const kmh = distanceMeters / 1000 / (timeSeconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatElevation = (meters: number) => `${meters}m`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Available stats for selection
  const availableStats = {
    distance: {
      label: "DISTANCE",
      value: formatDistance(activity.distance),
      shortLabel: "DISTANCE",
    },
    pace: {
      label: "PACE",
      value: formatPace(activity.distance, activity.moving_time),
      shortLabel: "PACE",
    },
    time: {
      label: "TIME",
      value: formatTime(activity.moving_time),
      shortLabel: "TIME",
    },
    speed: {
      label: "AVG SPEED",
      value: formatSpeed(activity.distance, activity.moving_time),
      shortLabel: "AVG SPEED",
    },
    elevation: {
      label: "ELEVATION GAIN",
      value: formatElevation(activity.total_elevation_gain),
      shortLabel: "ELEVATION GAIN",
    },
    date: {
      label: "DATE",
      value: formatDate(activity.start_date),
      shortLabel: "DATE",
    },
  };

  // Process polyline data for map visualization with proper constraints
  const processPolyline = (canvasDimensions = dimensions) => {
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

      // Define layout areas - responsive proportions
      const isMobile = canvasDimensions.width < 640;
      const dataAreaHeight = isMobile
        ? canvasDimensions.height * 0.45 // 45% for data on mobile (more space for text)
        : canvasDimensions.height * 0.4; // 40% for data on desktop
      const mapAreaHeight = isMobile
        ? canvasDimensions.height * 0.45 // 45% for map on mobile
        : canvasDimensions.height * 0.5; // 50% for map on desktop

      const mapPadding = canvasDimensions.width * 0.08; // 8% padding
      const mapAreaX = mapPadding;
      const mapAreaY = dataAreaHeight;
      const mapAreaWidth = canvasDimensions.width - mapPadding * 2;

      // Calculate the scale to fit the route in the map area while maintaining aspect ratio
      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;

      // Add some padding around the route (10% of each dimension)
      const latPadding = latRange * 0.1;
      const lngPadding = lngRange * 0.1;

      const paddedLatRange = latRange + latPadding * 2;
      const paddedLngRange = lngRange + lngPadding * 2;

      // Calculate scale factors for both dimensions
      const scaleX = mapAreaWidth / paddedLngRange;
      const scaleY = mapAreaHeight / paddedLatRange;

      // Use the smaller scale to ensure the entire route fits
      const routeScale = Math.min(scaleX, scaleY);

      // Calculate the actual map dimensions and centering offset
      const mapWidth = paddedLngRange * routeScale;
      const mapHeight = paddedLatRange * routeScale;

      const offsetX = mapAreaX + (mapAreaWidth - mapWidth) / 2;
      const offsetY = mapAreaY + (mapAreaHeight - mapHeight) / 2;

      return coordinates.map(([lat, lng]) => {
        const x =
          offsetX + ((lng - (minLng - lngPadding)) / paddedLngRange) * mapWidth;
        const y =
          offsetY + ((maxLat + latPadding - lat) / paddedLatRange) * mapHeight;
        return { x, y };
      });
    } catch (error) {
      console.error("Error processing polyline:", error);
      return [];
    }
  };

  const pathPoints = processPolyline();

  // Mobile detection for display optimizations
  const isMobileDisplay = dimensions.width < 640;

  // Helper function to get text width for centering
  const getTextWidth = (
    text: string,
    fontSize: number,
    fontWeight: string = "normal"
  ) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `${fontWeight} ${fontSize}px 'Funnel Display', sans-serif`;
      return context.measureText(text).width;
    }
    return 0;
  };

  // Generate checkered background pattern for the entire canvas
  const createCheckerBackground = (width: number, height: number) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const squareSize = 20;

    // Make sure we have exact dimensions
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);

    if (context) {
      // Fill the entire canvas with base color first
      context.fillStyle = "#f0f0f0";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Add checker pattern
      for (let x = 0; x < canvas.width; x += squareSize) {
        for (let y = 0; y < canvas.height; y += squareSize) {
          const isEven =
            (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
          if (!isEven) {
            context.fillStyle = "#ffffff";
            // Make sure to fill to the edge
            const rectWidth = Math.min(squareSize, canvas.width - x);
            const rectHeight = Math.min(squareSize, canvas.height - y);
            context.fillRect(x, y, rectWidth, rectHeight);
          }
        }
      }
    }

    return canvas;
  };

  // Fixed dimensions for consistent downloads across all devices
  const DOWNLOAD_DIMENSIONS = { width: 1080, height: 1080 };

  // Generate image for download/sharing
  const generateImage = async () => {
    if (!stageRef.current || !logoImage) return null;

    setIsGenerating(true);
    try {
      // Import Konva for creating a temporary stage
      const Konva = (await import("konva")).default;

      // Create a temporary stage for image generation with fixed dimensions
      const tempStage = new Konva.Stage({
        container: document.createElement("div"),
        width: DOWNLOAD_DIMENSIONS.width,
        height: DOWNLOAD_DIMENSIONS.height,
      });

      const tempLayer = new Konva.Layer();
      tempStage.add(tempLayer);

      // Calculate layout for download dimensions
      const downloadPathPoints = processPolyline(DOWNLOAD_DIMENSIONS);

      // Add stats panel with download dimensions
      selectedStats.slice(0, 3).forEach((statKey, index) => {
        const stat = availableStats[statKey as keyof typeof availableStats];

        // Use proportional spacing based on data area (use desktop proportions for downloads)
        const dataAreaHeight = DOWNLOAD_DIMENSIONS.height * 0.4;
        const availableSpace = dataAreaHeight - 60;
        const spacing = availableSpace / 3;
        const startY = 60;
        const statY = startY + index * spacing;

        // Responsive font sizes based on canvas size
        const labelSize = Math.max(14, DOWNLOAD_DIMENSIONS.width * 0.02);
        const valueSize = Math.max(28, DOWNLOAD_DIMENSIONS.width * 0.048);

        const labelWidth = getTextWidth(stat.label, labelSize, "500");
        const valueWidth = getTextWidth(stat.value, valueSize, "bold");

        // Add label
        tempLayer.add(
          new Konva.Text({
            x: DOWNLOAD_DIMENSIONS.width / 2 - labelWidth / 2,
            y: statY,
            text: stat.label,
            fontSize: labelSize,
            fontFamily: "'Funnel Display', sans-serif",
            fontStyle: "400",
            fill: dataColor,
          })
        );

        // Add value
        tempLayer.add(
          new Konva.Text({
            x: DOWNLOAD_DIMENSIONS.width / 2 - valueWidth / 2,
            y: statY + labelSize + 4,
            text: stat.value,
            fontSize: valueSize,
            fontFamily: "'Funnel Display', sans-serif",
            fontStyle: "bold",
            fill: dataColor,
          })
        );
      });

      // Add map path if available
      if (downloadPathPoints.length > 1) {
        const strokeWidth = Math.max(2, DOWNLOAD_DIMENSIONS.width * 0.008);
        tempLayer.add(
          new Konva.Line({
            points: downloadPathPoints.flatMap((p) => [p.x, p.y]),
            stroke: mapColor,
            strokeWidth: strokeWidth,
            lineJoin: "round",
            lineCap: "round",
          })
        );
      }

      // Add Strava logo
      const logoAreaHeight = DOWNLOAD_DIMENSIONS.height * 0.1;
      const logoWidth = Math.min(DOWNLOAD_DIMENSIONS.width * 0.2, 90);
      const logoHeight = logoWidth * (30 / 88);
      const logoY =
        DOWNLOAD_DIMENSIONS.height - logoAreaHeight / 2 - logoHeight / 2;

      tempLayer.add(
        new Konva.Image({
          image: logoImage,
          x: DOWNLOAD_DIMENSIONS.width / 2 - logoWidth / 2,
          y: logoY,
          width: logoWidth,
          height: logoHeight,
        })
      );

      // Draw and export
      tempLayer.draw();
      const dataURL = tempStage.toDataURL({
        mimeType: "image/png",
        quality: 1,
        pixelRatio: 2,
      });

      // Clean up
      tempStage.destroy();

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
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="mb-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select 3 stats to display:
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(availableStats).map(([key, stat]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStats.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked && selectedStats.length < 3) {
                        setSelectedStats([...selectedStats, key]);
                      } else if (!e.target.checked) {
                        setSelectedStats(
                          selectedStats.filter((s) => s !== key)
                        );
                      }
                    }}
                    disabled={
                      !selectedStats.includes(key) && selectedStats.length >= 3
                    }
                    className="rounded"
                  />
                  <span className="text-sm">{stat.shortLabel}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={invertColors}
                onChange={(e) => setInvertColors(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">
                Inverse colors (Green data, Pink map)
              </span>
            </label>
          </div>
        </div>

        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden">
            <Stage
              width={dimensions.width}
              height={dimensions.height}
              ref={stageRef}
            >
              <Layer>
                {/* Checkered Background for preview */}
                {checkerPattern && (
                  <KonvaImage
                    id="checkerBackground"
                    image={checkerPattern}
                    x={0}
                    y={0}
                    width={dimensions.width}
                    height={dimensions.height}
                    perfectDrawEnabled={false}
                    listening={false}
                  />
                )}

                {/* Transparent background rectangle for download */}
                <Rect
                  id="backgroundRect"
                  x={0}
                  y={0}
                  width={dimensions.width}
                  height={dimensions.height}
                  fill="transparent"
                  visible={false}
                />

                {/* Stats Panel - 3 stats vertically at top, centered */}
                <Group>
                  {selectedStats.slice(0, 3).map((statKey, index) => {
                    const stat =
                      availableStats[statKey as keyof typeof availableStats];

                    // Use proportional spacing based on data area (responsive)
                    const dataAreaHeight = isMobileDisplay
                      ? dimensions.height * 0.45 // More space for text on mobile
                      : dimensions.height * 0.4;
                    const availableSpace = dataAreaHeight - 60; // Leave some padding
                    const spacing = availableSpace / 3; // Divide equally among 3 stats
                    const startY = 60; // Top padding
                    const statY = startY + index * spacing;

                    // Responsive font sizes with better mobile sizing
                    const labelSize = isMobileDisplay
                      ? Math.max(16, dimensions.width * 0.028) // Larger text on mobile
                      : Math.max(14, dimensions.width * 0.02);
                    const valueSize = isMobileDisplay
                      ? Math.max(32, dimensions.width * 0.055) // Larger values on mobile
                      : Math.max(28, dimensions.width * 0.048);

                    const labelWidth = getTextWidth(
                      stat.label,
                      labelSize,
                      "500"
                    );
                    const valueWidth = getTextWidth(
                      stat.value,
                      valueSize,
                      "bold"
                    );

                    return (
                      <Group key={statKey}>
                        {/* Stat Label - light font, centered */}
                        <Text
                          x={dimensions.width / 2 - labelWidth / 2}
                          y={statY}
                          text={stat.label}
                          fontSize={labelSize}
                          fontFamily="'Funnel Display', sans-serif"
                          fontStyle="400"
                          fill={dataColor}
                        />
                        {/* Stat Value - bold font, centered */}
                        <Text
                          x={dimensions.width / 2 - valueWidth / 2}
                          y={statY + labelSize + 4}
                          text={stat.value}
                          fontSize={valueSize}
                          fontFamily="'Funnel Display', sans-serif"
                          fontStyle="bold"
                          fill={dataColor}
                        />
                      </Group>
                    );
                  })}
                </Group>

                {/* Activity Type Badge */}
                {/* <Rect
                  x={dimensions.width / 2 - 40}
                  y={dimensions.height - 90}
                  width={80}
                  height={25}
                  fill={dataColor}
                  cornerRadius={12}
                />
                <Text
                  x={dimensions.width / 2}
                  y={dimensions.height - 83}
                  text={activity.type.toUpperCase()}
                  fontSize={12}
                  fontFamily="Arial, sans-serif"
                  fontStyle="bold"
                  fill="white"
                  align="center"
                /> */}

                {/* Map Path - just the line, no start/end points */}
                {pathPoints.length > 1 &&
                  (() => {
                    // Use proportional stroke width with better mobile sizing
                    const strokeWidth = isMobileDisplay
                      ? Math.max(3, dimensions.width * 0.012) // Thicker line on mobile for visibility
                      : Math.max(2, dimensions.width * 0.008);

                    return (
                      <Line
                        points={pathPoints.flatMap((p) => [p.x, p.y])}
                        stroke={mapColor}
                        strokeWidth={strokeWidth}
                        lineJoin="round"
                        lineCap="round"
                      />
                    );
                  })()}

                {/* Powered by Strava logo at bottom, centered */}
                {logoImage &&
                  (() => {
                    // Use proportional sizing for logo with mobile optimization
                    const logoAreaHeight = dimensions.height * 0.1;
                    const logoWidth = isMobileDisplay
                      ? Math.min(dimensions.width * 0.25, 80) // Slightly larger on mobile
                      : Math.min(dimensions.width * 0.2, 90);
                    const logoHeight = logoWidth * (30 / 88); // Maintain aspect ratio
                    const logoY =
                      dimensions.height - logoAreaHeight / 2 - logoHeight / 2; // Center in logo area

                    return (
                      <KonvaImage
                        image={logoImage}
                        x={dimensions.width / 2 - logoWidth / 2}
                        y={logoY}
                        width={logoWidth}
                        height={logoHeight}
                      />
                    );
                  })()}
              </Layer>
            </Stage>
          </div>

          {/* Info below visualization */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
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
