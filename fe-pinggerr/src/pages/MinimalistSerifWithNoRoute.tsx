import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StravaActivity } from "@/types/strava";
import { config } from "@/config/env";

interface MinimalistSerifWithNoRouteProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function MinimalistSerifWithNoRoute({
  activity,
  language,
  onDownload,
}: MinimalistSerifWithNoRouteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [fontLoaded, setFontLoaded] = useState(false);
  const [showTitle, setShowTitle] = useState<boolean>(true);

  // User selectable stats (max 6)
  const [selectedStats, setSelectedStats] = useState<string[]>(() => {
    const defaults = [
      "pace",
      "distance",
      "elevation",
      "temperature",
      "cadence",
      "heartrate",
    ];
    const available = [
      "distance",
      "pace",
      "time",
      "elapsed",
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
    return defaults.filter((s) => available.includes(s)).slice(0, 6);
  });

  // Colors: transparent background, white text
  const TEXT_COLOR = "#FFFFFF";

  // Canvas dimensions - wider format (not square)
  const CANVAS_DIMENSIONS = { width: 1020, height: 500 } as const;

  // Layout constants
  const TITLE_FONT_SIZE = 64; // Same as stats value
  const PADDING = 60; // Padding from edges
  const TITLE_TOP_PADDING = 60;
  const STATS_TOP_MARGIN = 40; // Space between title and stats
  const STATS_ROW_GAP = 40; // Gap between two rows of stats

  // Reset selected stats when activity changes
  useEffect(() => {
    const available = [
      "distance",
      "pace",
      "time",
      "elapsed",
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
    if (JSON.stringify(valid) !== JSON.stringify(selectedStats)) {
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
  const formatCalories = (cal: number) => `${Math.round(cal)} cal`;
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
    elapsed: {
      label: "Elapsed",
      value: formatTime(activity.elapsed_time),
      shortLabel: "ELAPSED",
    },
    speed: {
      label: "Avg. Speed",
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

  // Generate image whenever deps change
  useEffect(() => {
    if (fontLoaded) {
      generateImage();
    }
  }, [fontLoaded, selectedStats, activity, showTitle]);

  // Track download
  const trackDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-msn-download`, {
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

      const fontFamily = fontLoaded ? "'Instrument Serif', serif" : "serif";

      // Activity title at top-left (64px) - only if showTitle is true
      let currentY = TITLE_TOP_PADDING;
      if (showTitle) {
        const titleText = activity.name || "Activity";
        tempLayer.add(
          new Konva.Text({
            x: PADDING,
            y: currentY,
            text: titleText,
            fontSize: TITLE_FONT_SIZE,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: TEXT_COLOR,
            align: "left",
          })
        );
        currentY += TITLE_FONT_SIZE + STATS_TOP_MARGIN;
      } else {
        currentY = TITLE_TOP_PADDING;
      }

      // Stats panel - arrange in grid (2 rows, 3 columns max)
      const statsToShow = selectedStats.slice(0, 6);
      const statsPerRow = 3;

      // Font sizes
      const labelSize = 40;
      const valueSize = 64;
      const spacingBetweenLabelAndValue = 8;

      // Calculate available width for stats and distribute evenly
      const availableWidth = CANVAS_DIMENSIONS.width - PADDING * 2;

      // Calculate row height for vertical spacing
      const rowHeight =
        labelSize + valueSize + spacingBetweenLabelAndValue + STATS_ROW_GAP;

      statsToShow.forEach((key, index) => {
        const stat = (availableStats as any)[key];
        if (!stat) return;

        const row = Math.floor(index / statsPerRow);
        const col = index % statsPerRow;

        // Calculate x position - always use 3-column grid for consistent positioning
        // Each stat gets equal space, left-aligned within its section
        const sectionWidth = availableWidth / statsPerRow;
        const statX = PADDING + col * sectionWidth;

        // Calculate y position
        const labelY = currentY + row * rowHeight;
        const valueY = labelY + labelSize + spacingBetweenLabelAndValue;

        // Add label
        tempLayer.add(
          new Konva.Text({
            x: statX,
            y: labelY,
            text: stat.label,
            fontSize: labelSize,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: TEXT_COLOR,
            align: "left",
          })
        );

        // Add value
        tempLayer.add(
          new Konva.Text({
            x: statX,
            y: valueY,
            text: stat.value,
            fontSize: valueSize,
            fontFamily: fontFamily,
            fontStyle: "normal",
            fill: TEXT_COLOR,
            align: "left",
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
      console.error("Error generating MSN image:", e);
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
      .toLowerCase()}_minimalist_serif_no_route.png`;
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
              ? "Minimalist Serif No Route"
              : "Serif Minimalis Tanpa Rute"}
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
                ? "Choose up to 6 stats"
                : "Pilih hingga 6 statistik"}
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
                      if (e.target.checked && selectedStats.length < 6) {
                        setSelectedStats([...selectedStats, key]);
                      } else if (!e.target.checked) {
                        setSelectedStats(
                          selectedStats.filter((s) => s !== key)
                        );
                      }
                    }}
                    disabled={
                      !selectedStats.includes(key) && selectedStats.length >= 6
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-400 mx-auto mb-2"></div>
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
                alt="Minimalist Serif No Route Activity Visualization"
                className="w-full h-auto max-w-full"
                style={{ maxHeight: "80vh", objectFit: "contain" }}
              />
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-sm text-muted-foreground">
                  {language === "en" ? "Loading..." : "Memuat..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
