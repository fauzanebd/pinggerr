import { useRef, useEffect, useState } from "react";
// Konva is imported dynamically in generateImage function
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityVisualizationProps } from "@/types/strava";
import { config } from "@/config/env";

// Strava logo
import stravaLogoWhite from "@/assets/api_logo_pwrdBy_strava_stack_white.svg";

export const ActivityVisualization: React.FC<ActivityVisualizationProps> = ({
  activity,
  onDownload,
  language,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);

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

  // Fixed dimensions for consistent output
  const CANVAS_DIMENSIONS = { width: 800, height: 800 };

  // Load Strava logo and font
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setLogoImage(img);
    };
    img.src = stravaLogoWhite;
    logoImageRef.current = img;

    // Load the Special Gothic font
    const loadFont = async () => {
      try {
        // Check if FontFace API is available
        if ("fonts" in document) {
          const specialGothicFont = new FontFace(
            "Special Gothic Expanded One",
            "url(/fonts/SpecialGothicExpandedOne-Regular.ttf)"
          );
          await specialGothicFont.load();
          document.fonts.add(specialGothicFont);
          console.log(
            "✅ Special Gothic Expanded One font loaded successfully"
          );
          setFontLoaded(true);
        } else {
          // Fallback: wait a bit for font to load naturally
          setTimeout(() => setFontLoaded(true), 2000);
        }
      } catch (error) {
        console.warn("❌ Font loading failed, using fallback:", error);
        setFontLoaded(true); // Continue with fallback font
      }
    };

    loadFont();
  }, []);

  // Generate image when parameters change
  useEffect(() => {
    if (logoImage && fontLoaded) {
      generateImage();
    }
  }, [logoImage, fontLoaded, selectedStats, invertColors, activity]);

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

  const formatHeartRate = (bpm: number) => `${Math.round(bpm)} BPM`;

  // const formatCadence = (rpm: number) => `${Math.round(rpm)} SPM`;

  // Track download in the backend
  const trackDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // Do nothing if counting download fails
    }
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
    ...(activity.has_heartrate && activity.average_heartrate
      ? {
          heartrate: {
            label: "AVG HEART RATE",
            value: formatHeartRate(activity.average_heartrate),
            shortLabel: "AVG HR",
          },
        }
      : {}),
    // ...(activity.average_cadence
    //   ? {
    //       cadence: {
    //         label: "AVG CADENCE",
    //         value: formatCadence(activity.average_cadence),
    //         shortLabel: "AVG CADENCE",
    //       },
    //     }
    //   : {}),
  };

  // Process polyline data for map visualization with proper constraints
  const processPolyline = () => {
    const canvasDimensions = CANVAS_DIMENSIONS;
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

      // Define layout areas - fixed proportions for consistent output
      const dataAreaHeight = canvasDimensions.height * 0.5;
      const mapAreaHeight = canvasDimensions.height * 0.3;

      const mapPadding = canvasDimensions.width * 0.2; // 8% padding
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

  // Helper function to get text width for centering
  const getTextWidth = (
    text: string,
    fontSize: number,
    fontWeight: string = "normal",
    fontFamily: string = "'Funnel Display', sans-serif"
  ) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      return context.measureText(text).width;
    }
    return 0;
  };

  // Generate image for both preview and download
  const generateImage = async (forceColors?: {
    dataColor: string;
    mapColor: string;
  }) => {
    if (!logoImage) return null;

    setIsGenerating(true);
    try {
      // Use either forced colors or current state colors
      const currentDataColor =
        forceColors?.dataColor || (invertColors ? BRAND_GREEN : BRAND_PINK);
      const currentMapColor =
        forceColors?.mapColor || (invertColors ? BRAND_PINK : BRAND_GREEN);

      // Import Konva for creating a temporary stage
      const Konva = (await import("konva")).default;

      // Create a temporary stage for image generation with fixed dimensions
      const tempStage = new Konva.Stage({
        container: document.createElement("div"),
        width: CANVAS_DIMENSIONS.width,
        height: CANVAS_DIMENSIONS.height,
      });

      const tempLayer = new Konva.Layer();
      tempStage.add(tempLayer);

      // Add stats panel
      selectedStats.slice(0, 3).forEach((statKey, index) => {
        const stat = availableStats[statKey as keyof typeof availableStats];

        // Skip if stat doesn't exist (e.g., heart rate when not available)
        if (!stat) return;

        // Use proportional spacing based on data area
        const dataAreaHeight = CANVAS_DIMENSIONS.height * 0.35;
        const availableSpace = dataAreaHeight - 40;
        const spacing = availableSpace / 3;
        const startY = 150;
        const statY = startY + index * spacing;

        // Font sizes based on canvas size
        // const labelSize = Math.max(24, CANVAS_DIMENSIONS.width * 0.02);
        // const valueSize = Math.max(48, CANVAS_DIMENSIONS.width * 0.048);

        const labelSize = 18;
        const valueSize = 38;

        const labelWidth = getTextWidth(stat.label, labelSize, "500");
        const valueFontFamily = fontLoaded
          ? "'Special Gothic Expanded One', 'Arial Black', sans-serif"
          : "'Arial Black', sans-serif";
        const valueWidth = getTextWidth(
          stat.value,
          valueSize,
          "400",
          valueFontFamily
        );

        // Add label
        tempLayer.add(
          new Konva.Text({
            x: CANVAS_DIMENSIONS.width / 2 - labelWidth / 2,
            y: statY,
            text: stat.label,
            fontSize: labelSize,
            fontFamily: "'Funnel Display', sans-serif",
            fontStyle: "400",
            fill: currentDataColor,
          })
        );

        // Add value with font fallback
        const fontFamily = fontLoaded
          ? "'Special Gothic Expanded One', 'Arial Black', sans-serif"
          : "'Arial Black', sans-serif";

        tempLayer.add(
          new Konva.Text({
            x: CANVAS_DIMENSIONS.width / 2 - valueWidth / 2,
            y: statY + labelSize + 4,
            text: stat.value,
            fontSize: valueSize,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: currentDataColor,
          })
        );
      });

      // Add map path if available
      if (pathPoints.length > 1) {
        const strokeWidth = Math.max(2, CANVAS_DIMENSIONS.width * 0.008);
        tempLayer.add(
          new Konva.Line({
            points: pathPoints.flatMap((p) => [p.x, p.y]),
            stroke: currentMapColor,
            strokeWidth: strokeWidth,
            lineJoin: "round",
            lineCap: "round",
          })
        );
      }

      // Add Strava logo
      const logoAreaHeight = CANVAS_DIMENSIONS.height * 0.3;
      const logoWidth = Math.min(CANVAS_DIMENSIONS.width * 0.15, 1000);
      const logoHeight = logoWidth * (30 / 88);
      const logoY =
        CANVAS_DIMENSIONS.height - logoAreaHeight / 2 - logoHeight / 2;

      tempLayer.add(
        new Konva.Image({
          image: logoImage,
          x: CANVAS_DIMENSIONS.width / 2 - logoWidth / 2,
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
    // Ensure we use current color settings for download
    const currentDataColor = invertColors ? BRAND_GREEN : BRAND_PINK;
    const currentMapColor = invertColors ? BRAND_PINK : BRAND_GREEN;
    const imageUrl =
      generatedImageUrl ||
      (await generateImage({
        dataColor: currentDataColor,
        mapColor: currentMapColor,
      }));
    if (!imageUrl) return;

    // Track the download before actually downloading
    await trackDownload();

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
            {language === "en"
              ? "Activity Visualization"
              : "Visualisasi Aktivitas"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-brand-pink hover:bg-brand-pink/90 text-brand-green"
            >
              {isGenerating
                ? language === "en"
                  ? "Generating..."
                  : "Membuat..."
                : language === "en"
                ? "💾 Download"
                : "💾 Unduh"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="mb-4 space-y-4">
          {/* Font loading status */}
          {/* <div className="text-xs text-muted-foreground">
            Font status:{" "}
            {fontLoaded
              ? "✅ Special Gothic Expanded One loaded"
              : "⏳ Loading font..."}
          </div> */}

          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === "en"
                ? "Maximum 3 stats can be selected. Deselect one to enable others."
                : "Maksimal 3 statistik dapat dipilih. Batalkan pilihan satu untuk mengaktifkan yang lain."}
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
                {language === "en"
                  ? "Inverse colors (Green data, Pink map)"
                  : "Warna terbalik (Data hijau, Peta pink)"}
              </span>
            </label>
          </div>
        </div>

        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
            {isGenerating ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-pink mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    {language === "en"
                      ? "Generating visualization..."
                      : "Membuat visualisasi..."}
                  </p>
                </div>
              </div>
            ) : generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt="Activity Visualization"
                className="w-full h-auto max-w-full"
                style={{
                  maxHeight: "80vh",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-sm text-muted-foreground">
                  {language === "en" ? "Loading..." : "Memuat..."}
                </p>
              </div>
            )}
          </div>

          {/* Info below visualization */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {pathPoints.length === 0 && (
              <p className="mt-2 text-orange-600">
                ⚠️{" "}
                {language === "en"
                  ? "No GPS data available for this activity - showing stats only"
                  : "Tidak ada data GPS untuk aktivitas ini - hanya menampilkan statistik"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
