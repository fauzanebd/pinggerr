import { useRef, useEffect, useState } from "react";
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StravaActivity } from "@/types/strava";
import { config } from "@/config/env";

interface MinimalistSerifWithRouteProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function MinimalistSerifWithRoute({
  activity,
  language,
  onDownload,
}: MinimalistSerifWithRouteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [fontLoaded, setFontLoaded] = useState(false);
  const [showTitle, setShowTitle] = useState<boolean>(true);

  // User selectable stats (max 3)
  const [selectedStats, setSelectedStats] = useState<string[]>(() => {
    const defaults = ["pace", "distance", "elevation"];
    const available = [
      "distance",
      "pace",
      "time",
      "speed",
      "elevation",
      "date",
      ...(activity.calories ? ["calories"] : []),
      ...(activity.average_cadence ? ["cadence"] : []),
      ...(activity.average_watts ? ["power"] : []),
      ...(activity.average_temp ? ["temperature"] : []),
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];
    return defaults.filter((s) => available.includes(s)).slice(0, 3);
  });

  // Colors: transparent background, white text and route
  const TEXT_COLOR = "#FFFFFF";
  const PATH_COLOR = "#FFFFFF";

  // Fixed canvas dimensions
  const CANVAS_DIMENSIONS = { width: 1000, height: 800 } as const;

  // Layout: Title at top, Stats at bottom 30%, Route in between
  const TITLE_FONT_SIZE = 64; // Same as stats value
  const TITLE_AREA_HEIGHT = 120; // Space for title with padding
  const STATS_AREA_HEIGHT = CANVAS_DIMENSIONS.height * 0.3;
  // Dynamic title area height based on showTitle state
  const getTitleAreaHeight = () => (showTitle ? TITLE_AREA_HEIGHT : 50);
  const getRouteAreaHeight = () =>
    CANVAS_DIMENSIONS.height - getTitleAreaHeight() - STATS_AREA_HEIGHT;

  // Reset selected stats when activity changes
  useEffect(() => {
    const available = [
      "distance",
      "pace",
      "time",
      "speed",
      "elevation",
      "date",
      ...(activity.calories ? ["calories"] : []),
      ...(activity.average_cadence ? ["cadence"] : []),
      ...(activity.average_watts ? ["power"] : []),
      ...(activity.average_temp ? ["temperature"] : []),
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];
    const valid = selectedStats.filter((s) => available.includes(s));
    if (valid.length < 3) {
      const remaining = available.filter((s) => !valid.includes(s));
      const filled = [...valid, ...remaining.slice(0, 3 - valid.length)];
      if (JSON.stringify(filled) !== JSON.stringify(selectedStats)) {
        setSelectedStats(filled);
      }
    } else if (JSON.stringify(valid) !== JSON.stringify(selectedStats)) {
      setSelectedStats(valid);
    }
  }, [activity]);

  // Load Instrument Serif font
  useEffect(() => {
    const loadFont = async () => {
      try {
        if ("fonts" in document) {
          const instrumentSerifFont = new FontFace(
            "Instrument Serif",
            "url(/fonts/InstrumentSerif-Regular.ttf)"
          );
          await instrumentSerifFont.load();
          document.fonts.add(instrumentSerifFont);
          setFontLoaded(true);
        } else {
          setTimeout(() => setFontLoaded(true), 1500);
        }
      } catch (_) {
        setFontLoaded(true);
      }
    };
    loadFont();
  }, []);

  // Measurement helper
  const getTextWidth = (
    text: string,
    fontSize: number,
    fontWeight: string = "normal",
    fontFamily: string = "'Instrument Serif', serif"
  ) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      return context.measureText(text).width;
    }
    return 0;
  };

  // Formatters
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2)} km`;
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsTime = seconds - minutes * 60;
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
    return `${minutes}m ${secondsTime.toString().padStart(2, "0")}s`;
  };
  const formatPace = (a: StravaActivity) => {
    if (a.average_speed && a.average_speed > 0) {
      const paceMinPerKm = 1000 / (a.average_speed * 60);
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
    }
    const minutes = a.moving_time / 60;
    const km = a.distance / 1000;
    const paceMinPerKm = minutes / km;
    const paceMin = Math.floor(paceMinPerKm);
    const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
    return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
  };
  const formatSpeed = (distanceMeters: number, timeSeconds: number) => {
    const kmh = distanceMeters / 1000 / (timeSeconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  };
  const formatElevation = (meters: number) => `${meters.toFixed(0)} m`;
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const formatHeartRate = (bpm: number) => `${Math.round(bpm)} bpm`;
  const formatCalories = (kcal: number) => `${Math.round(kcal)} cal`;
  const formatCadence = (cad: number) => `${Math.round(cad * 2)} spm`;
  const formatPower = (w: number) => `${Math.round(w)} W`;
  const formatTemperature = (t: number) => `${Math.round(t)}°C`;

  // Stats map
  const availableStats = {
    distance: {
      label: "Distance",
      value: formatDistance(activity.distance),
      shortLabel: "DISTANCE",
    },
    pace: {
      label: "Pace",
      value: formatPace(activity),
      shortLabel: "PACE",
    },
    time: {
      label: "Time",
      value: formatTime(activity.moving_time),
      shortLabel: "TIME",
    },
    speed: {
      label: "Avg Speed",
      value: formatSpeed(activity.distance, activity.moving_time),
      shortLabel: "SPEED",
    },
    elevation: {
      label: "Elev. Gain",
      value: formatElevation(activity.total_elevation_gain),
      shortLabel: "ELEVATION",
    },
    date: {
      label: "Date",
      value: formatDate(activity.start_date),
      shortLabel: "DATE",
    },
    ...(activity.calories
      ? {
          calories: {
            label: "Calories",
            value: formatCalories(activity.calories),
            shortLabel: "CALORIES",
          },
        }
      : {}),
    ...(activity.average_cadence
      ? {
          cadence: {
            label: "Avg. Cadence",
            value: formatCadence(activity.average_cadence),
            shortLabel: "CADENCE",
          },
        }
      : {}),
    ...(activity.average_watts
      ? {
          power: {
            label: "Avg. Power",
            value: formatPower(activity.average_watts),
            shortLabel: "POWER",
          },
        }
      : {}),
    ...(activity.average_temp
      ? {
          temperature: {
            label: "Avg. Temp",
            value: formatTemperature(activity.average_temp),
            shortLabel: "TEMP",
          },
        }
      : {}),
    ...(activity.has_heartrate && activity.average_heartrate
      ? {
          heartrate: {
            label: "Avg. HR",
            value: formatHeartRate(activity.average_heartrate),
            shortLabel: "HEART RATE",
          },
        }
      : {}),
  } as const;

  // Helper to check if polyline exists (for warning message)
  const hasPolyline = Boolean(
    activity.map?.polyline || activity.map?.summary_polyline
  );

  // Generate image whenever deps change
  useEffect(() => {
    if (fontLoaded) {
      generateImage();
    }
  }, [fontLoaded, selectedStats, activity, showTitle]);

  // Track download
  const trackDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-msr-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (_) {
      // ignore failures
    }
  };

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const Konva = (await import("konva")).default;
      const tempStage = new Konva.Stage({
        container: document.createElement("div"),
        width: CANVAS_DIMENSIONS.width,
        height: CANVAS_DIMENSIONS.height,
      });
      const tempLayer = new Konva.Layer();
      tempStage.add(tempLayer);

      // Add invisible anchor points at canvas corners for Instagram Stories transparency
      // This helps Instagram preserve transparency instead of defaulting to white background
      const anchorSize = 1;
      [
        [0, 0],
        [CANVAS_DIMENSIONS.width - anchorSize, 0],
        [0, CANVAS_DIMENSIONS.height - anchorSize],
        [
          CANVAS_DIMENSIONS.width - anchorSize,
          CANVAS_DIMENSIONS.height - anchorSize,
        ],
      ].forEach(([x, y]) => {
        tempLayer.add(
          new Konva.Rect({
            x,
            y,
            width: anchorSize,
            height: anchorSize,
            fill: "rgba(0, 0, 0, 0.003)", // Barely visible anchors
            listening: false,
          })
        );
      });

      // Activity title at top (64px, same as stats value) - only if showTitle is true
      const fontFamily = fontLoaded ? "'Instrument Serif', serif" : "serif";
      if (showTitle) {
        const titleText = activity.name || "Activity";
        const titleWidth = getTextWidth(
          titleText,
          TITLE_FONT_SIZE,
          "normal",
          fontFamily
        );
        const titleY = getTitleAreaHeight() / 2; // Center vertically in title area

        tempLayer.add(
          new Konva.Text({
            x: CANVAS_DIMENSIONS.width / 2 - titleWidth / 2,
            y: titleY - TITLE_FONT_SIZE / 2,
            text: titleText,
            fontSize: TITLE_FONT_SIZE,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: TEXT_COLOR,
            align: "center",
          })
        );
      }

      // Route path (white) in middle area - process polyline here to use current showTitle state
      const polyline = activity.map?.polyline || activity.map?.summary_polyline;
      if (polyline) {
        try {
          const coordinates = decode(polyline);
          if (coordinates.length > 1) {
            const canvas = CANVAS_DIMENSIONS;
            const lats = coordinates.map((c) => c[0]);
            const lngs = coordinates.map((c) => c[1]);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            // Route area starts after title, ends before stats
            const routePadding = canvas.width * 0.1; // 10% horizontal padding
            const routeAreaX = routePadding;
            const routeAreaY = getTitleAreaHeight();
            const routeAreaWidth = canvas.width - routePadding * 2;
            const routeAreaHeight = getRouteAreaHeight();

            const latRange = maxLat - minLat;
            const lngRange = maxLng - minLng;
            const latPadding = latRange * 0.1;
            const lngPadding = lngRange * 0.1;
            const paddedLatRange = latRange + latPadding * 2;
            const paddedLngRange = lngRange + lngPadding * 2;
            const scaleX = routeAreaWidth / paddedLngRange;
            const scaleY = routeAreaHeight / paddedLatRange;
            const scale = Math.min(scaleX, scaleY);

            const mapWidth = paddedLngRange * scale;
            const mapHeight = paddedLatRange * scale;
            const offsetX = routeAreaX + (routeAreaWidth - mapWidth) / 2;
            const offsetY = routeAreaY + (routeAreaHeight - mapHeight) / 2;

            const pathPoints = coordinates.map(([lat, lng]) => {
              const x =
                offsetX +
                ((lng - (minLng - lngPadding)) / paddedLngRange) * mapWidth;
              const y =
                offsetY +
                ((maxLat + latPadding - lat) / paddedLatRange) * mapHeight;
              return { x, y };
            });

            const strokeWidth = Math.max(2, CANVAS_DIMENSIONS.width * 0.006);
            tempLayer.add(
              new Konva.Line({
                points: pathPoints.flatMap((p) => [p.x, p.y]),
                stroke: PATH_COLOR,
                strokeWidth,
                lineJoin: "round",
                lineCap: "round",
              })
            );
          }
        } catch (e) {
          console.error("Error processing polyline:", e);
        }
      }

      // Stats panel in bottom 30% - 3 stats horizontally justified
      const statsToShow = selectedStats.slice(0, 3);
      const statsCount = statsToShow.length;
      const statsAreaStartY = getTitleAreaHeight() + getRouteAreaHeight();
      const statsAreaCenterY = statsAreaStartY + STATS_AREA_HEIGHT / 2;

      // Font sizes
      const labelSize = 40;
      const valueSize = 64;

      // Calculate spacing for stats (equal distribution across width)
      // Divide the width into equal sections for each stat
      const horizontalPadding = CANVAS_DIMENSIONS.width * 0.1; // 10% padding on sides
      const availableWidth = CANVAS_DIMENSIONS.width - horizontalPadding * 2;

      statsToShow.forEach((key, index) => {
        const stat = (availableStats as any)[key];
        if (!stat) return;

        // Calculate x position - divide available width equally
        let statX: number;
        if (statsCount === 1) {
          statX = CANVAS_DIMENSIONS.width / 2;
        } else {
          // Divide into equal sections: each stat gets 1/statsCount of the available width
          // Position at the center of each section
          const sectionWidth = availableWidth / statsCount;
          statX = horizontalPadding + (index + 0.5) * sectionWidth;
        }

        // Measure text widths for centering
        const labelWidth = getTextWidth(
          stat.label,
          labelSize,
          "normal",
          fontFamily
        );
        const valueWidth = getTextWidth(
          stat.value,
          valueSize,
          "normal",
          fontFamily
        );

        // Calculate total height of label + value to center vertically
        const labelHeight = labelSize * 1.2; // Approximate line height
        const valueHeight = valueSize * 1.2;
        const totalTextHeight = labelHeight + valueHeight;
        const spacingBetweenLabelAndValue = 8; // Small gap between label and value
        const totalHeight = totalTextHeight + spacingBetweenLabelAndValue;

        // Center vertically in stats area
        const labelY = statsAreaCenterY - totalHeight / 2;
        const valueY = labelY + labelHeight + spacingBetweenLabelAndValue;

        // Add label
        tempLayer.add(
          new Konva.Text({
            x: statX - labelWidth / 2,
            y: labelY,
            text: stat.label,
            fontSize: labelSize,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: TEXT_COLOR,
            align: "center",
          })
        );

        // Add value
        tempLayer.add(
          new Konva.Text({
            x: statX - valueWidth / 2,
            y: valueY,
            text: stat.value,
            fontSize: valueSize,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: TEXT_COLOR,
            align: "center",
          })
        );
      });

      tempLayer.draw();
      const dataURL = tempStage.toDataURL({
        mimeType: "image/png",
        quality: 1,
        pixelRatio: 2,
      });
      tempStage.destroy();
      setGeneratedImageUrl(dataURL);
      return dataURL;
    } catch (e) {
      console.error("Error generating MSR image:", e);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    const imageUrl = generatedImageUrl || (await generateImage());
    if (!imageUrl) return;
    await trackDownload();
    const link = document.createElement("a");
    link.download = `${activity.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_minimalist_serif_with_route.png`;
    link.href = imageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDownload?.(imageUrl);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-800">⚫</span>
            {language === "en"
              ? "Minimalist Serif With Route"
              : "Serif Minimalis Dengan Rute"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-gray-900 hover:bg-gray-800 text-white"
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
                  <span className="text-sm">{(stat as any).shortLabel}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === "en" ? "Display Options" : "Opsi Tampilan"}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTitle}
                onChange={(e) => setShowTitle(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">
                {language === "en"
                  ? "Show activity title"
                  : "Tampilkan judul aktivitas"}
              </span>
            </label>
          </div>
        </div>

        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden flex items-center justify-center bg-black">
            {isGenerating ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    {language === "en"
                      ? "Generating visualization..."
                      : "Membuat visualisasi..."}
                  </p>
                </div>
              </div>
            ) : generatedImageUrl ? (
              <div className="flex flex-col">
                {/* super monkey patch haha */}
                <div className="min-h-[20px] md:min-h-[40px] bg-black"></div>
                <img
                  src={generatedImageUrl}
                  alt="Minimalist Serif With Route Activity Visualization"
                  className="w-full h-auto max-w-full"
                  style={{ maxHeight: "80vh", objectFit: "contain" }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-sm text-muted-foreground">
                  {language === "en" ? "Loading..." : "Memuat..."}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {!hasPolyline && (
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
}
