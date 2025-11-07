import { useRef, useEffect, useState } from "react";
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StravaActivity } from "@/types/strava";
import { config } from "@/config/env";
// import stravaLogoOrange from "@/assets/api_logo_pwrdBy_strava_horiz_orange.png";

// const isStravaData = (activity: StravaActivity): boolean =>
//   activity.source === "strava";

interface ModernMinimalistActivityProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function ModernMinimalistActivity({
  activity,
  language,
  onDownload,
}: ModernMinimalistActivityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [showOrnament, setShowOrnament] = useState<boolean>(true);
  const [showRoute, setShowRoute] = useState<boolean>(false);

  // User customizable options - initialize with available stats only
  const [selectedStats, setSelectedStats] = useState<string[]>(() => {
    const defaults = ["distance", "pace", "time", "elevation"];
    const available = [
      "distance",
      "pace",
      "time",
      "elapsed",
      "speed",
      "elevation",
      "date",
      ...(activity.calories ? ["calories"] : []),
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];
    return defaults.filter((s) => available.includes(s)).slice(0, 4);
  });

  // Canvas dimensions (normal size, will be scaled at export via pixelRatio)
  // Height increased to improve aspect ratio for iOS/Instagram transparency (was 232)
  const CANVAS_DIMENSIONS = { width: 812, height: 400 };

  // Minimalist palette (transparent background, white foreground)
  const COLORS = {
    background: "rgba(0,0,0,0)",
    text: "#FFFFFF",
    capsuleStroke: "#FFFFFF",
  };

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
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];
    const valid = selectedStats.filter((s) => available.includes(s));
    if (JSON.stringify(valid) !== JSON.stringify(selectedStats))
      setSelectedStats(valid);
  }, [activity]); // Only depend on activity, not selectedStats to avoid infinite loop

  // Generate image when parameters change
  useEffect(() => {
    generateImage();
  }, [selectedStats, activity, showOrnament, showRoute]);

  // Helper functions for formatting
  // Formatting for minimalist values (numbers only, no units)
  const formatDistanceNumber = (meters: number) => (meters / 1000).toFixed(2);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsTime = seconds - minutes * 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}`;
    return `${minutes}:${secondsTime.toString().padStart(2, "0")}`;
  };

  const formatPace = (activity: StravaActivity) => {
    // Use average_speed from Strava if available, otherwise fall back to calculation
    if (activity.average_speed && activity.average_speed > 0) {
      // average_speed is in m/s, convert to min/km
      // Formula: 1000 / (average_speed * 60) = minutes per km
      const paceMinPerKm = 1000 / (activity.average_speed * 60);
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}`;
    } else {
      // Fallback to total distance / total time calculation
      const minutes = activity.moving_time / 60;
      const km = activity.distance / 1000;
      const paceMinPerKm = minutes / km;
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}`;
    }
  };
  const formatSpeed = (distanceMeters: number, timeSeconds: number) =>
    (distanceMeters / 1000 / (timeSeconds / 3600)).toFixed(2);
  const formatElevationNumber = (meters: number) => `${Math.round(meters)}`;
  const formatCaloriesNumber = (kcal: number) => `${Math.round(kcal)}`;
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const formatHeartRate = (bpm: number) => `${Math.round(bpm)}`;

  // Track download
  const trackDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-mm-download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // Silent fail
    }
  };

  // Available stats for selection
  const availableStats = {
    distance: {
      label: "Distance",
      value: formatDistanceNumber(activity.distance),
    },
    pace: { label: "Pace", value: formatPace(activity) },
    time: { label: "Time", value: formatTime(activity.moving_time) },
    elapsed: { label: "Elapsed", value: formatTime(activity.elapsed_time) },
    speed: {
      label: "Speed",
      value: formatSpeed(activity.distance, activity.moving_time),
    },
    elevation: {
      label: "Elev. Gain",
      value: formatElevationNumber(activity.total_elevation_gain),
    },
    date: { label: "Date", value: formatDate(activity.start_date) },
    ...(activity.calories
      ? {
          calories: {
            label: "Calories",
            value: `${Math.round(activity.calories)}`,
          },
        }
      : {}),
    ...(activity.average_cadence
      ? {
          cadence: {
            label: "Cadence",
            value: `${Math.round(activity.average_cadence * 2)}`,
          },
        }
      : {}),
    ...(activity.average_watts
      ? {
          power: {
            label: "Power",
            value: `${Math.round(activity.average_watts)}`,
          },
        }
      : {}),
    ...(activity.average_temp
      ? {
          temperature: {
            label: "Temp",
            value: `${Math.round(activity.average_temp)}`,
          },
        }
      : {}),
    ...(activity.calories
      ? {
          calories: {
            label: "Calories",
            value: formatCaloriesNumber(activity.calories),
          },
        }
      : {}),
    ...(activity.has_heartrate && activity.average_heartrate
      ? {
          heartrate: {
            label: "Avg. HR",
            value: formatHeartRate(activity.average_heartrate),
          },
        }
      : {}),
  } as const;

  // Load Telegraf fonts (ensure available for canvas render)
  const ensureTelegrafLoaded = async () => {
    try {
      // Trigger load for both weights
      // 400 regular used for title and numbers
      await Promise.all([
        document.fonts.load("400 64px 'PP Telegraf'"),
        document.fonts.load("200 22px 'PP Telegraf'"),
      ]);
      await (document as any).fonts.ready;
    } catch (_) {
      // Ignore; fallback to system sans if it fails
    }
  };

  // Text measurement helper using the same fonts we render with
  const measureText = (fontCss: string, text: string): number => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.font = fontCss;
    const metrics = ctx.measureText(text);
    return metrics.width;
  };

  // Pairing and two-row layout distribution
  type StatKey = keyof typeof availableStats;
  type LayoutItem = {
    key: StatKey;
    label: string;
    value: string;
    groupWidth: number;
    capsuleBaseWidth: number;
    valueWidth: number;
  };

  // Generate minimalist image
  const generateImage = async () => {
    setIsGenerating(true);
    try {
      await ensureTelegrafLoaded();
      const Konva = (await import("konva")).default;
      // Extend canvas width when stats > 4 and ornament is enabled to create a right gutter
      const extraRightSpace =
        showOrnament && selectedStats.length > 4 ? 160 : 0;
      const dynamicWidth = CANVAS_DIMENSIONS.width + extraRightSpace;
      // Create temporary stage with transparent background
      const tempStage = new Konva.Stage({
        container: document.createElement("div"),
        width: dynamicWidth,
        height: CANVAS_DIMENSIONS.height,
      });

      const tempLayer = new Konva.Layer();
      tempStage.add(tempLayer);
      const marginX = 20;
      const contentWidth = dynamicWidth - marginX * 2;

      // Title sizing and optional top padding when showing tall route
      const titleFontSize = 34; // matches stat numbers
      const hasPolyline = Boolean(
        activity.map?.polyline || activity.map?.summary_polyline
      );
      const rowHeightLocal = 50;
      const desiredRouteHeight =
        showRoute && hasPolyline ? rowHeightLocal * 3 : 0;
      const titleBaseline = 16 + titleFontSize / 2;
      const desiredTopY = titleBaseline - desiredRouteHeight;
      const topExtra =
        desiredRouteHeight > 0 && desiredTopY < 0
          ? Math.ceil(-desiredTopY + 4)
          : 0;
      if (topExtra > 0) {
        tempStage.size({
          width: dynamicWidth,
          height: CANVAS_DIMENSIONS.height + topExtra,
        });
      }
      const canvasHeight = CANVAS_DIMENSIONS.height + topExtra;
      const yOffset = topExtra;

      // Add invisible anchor points at canvas corners for Instagram Stories transparency
      // This helps Instagram preserve transparency instead of defaulting to white background
      const anchorSize = 1;
      [
        [0, 0],
        [dynamicWidth - anchorSize, 0],
        [0, canvasHeight - anchorSize],
        [dynamicWidth - anchorSize, canvasHeight - anchorSize],
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

      // iOS/Instagram transparency fix: Add invisible spacer content when no route
      // This mimics the pixel distribution of the route to help iOS recognize transparency
      if (!showRoute || !hasPolyline) {
        // Add vertical lines of barely visible pixels distributed across the canvas
        // This matches the content density when route is shown
        const numLines = 8;
        const spacing = dynamicWidth / (numLines + 1);
        for (let i = 1; i <= numLines; i++) {
          tempLayer.add(
            new Konva.Line({
              points: [
                spacing * i,
                yOffset + titleFontSize + 20,
                spacing * i,
                canvasHeight - 80,
              ],
              stroke: "rgba(255, 255, 255, 0.002)",
              strokeWidth: 1,
              listening: false,
            })
          );
        }
      }
      const title =
        activity.name && activity.name.trim().length > 0
          ? activity.name.trim()
          : "Activity";

      // Center content vertically
      const totalContentHeight = titleFontSize + 80 + 50 * 2;
      const verticalPadding =
        (CANVAS_DIMENSIONS.height - totalContentHeight) / 2;

      tempLayer.add(
        new Konva.Text({
          x: marginX,
          y: yOffset + verticalPadding,
          text: title,
          fontSize: titleFontSize,
          fontFamily: "PP Telegraf",
          fontStyle: "normal",
          fill: COLORS.text,
          listening: false,
        })
      );

      // Build layout items from selected stats (up to 6)
      const MAX_STATS = 6;
      const selected = selectedStats
        .slice(0, MAX_STATS)
        .filter((k) => (availableStats as any)[k]);
      const numberFontSize = titleFontSize; // same as title
      const labelFontSize = 18; // smaller ultralight
      const valueFontCss = `${400} ${numberFontSize}px 'PP Telegraf', sans-serif`;
      const labelFontCss = `${200} ${labelFontSize}px 'PP Telegraf', sans-serif`;
      const capsuleHPad = 8; // horizontal padding inside capsule
      const capsuleVPad = 8;
      const gapBetweenCapsuleAndValue = 14;
      const gapBetweenItems = 14;

      // Effective width for title+stats area (keeps stats from taking the entire canvas)
      const effectiveContentWidth =
        selected.length > 4
          ? Math.floor(contentWidth * 0.97)
          : contentWidth - Math.round(contentWidth * 0.4);

      // Optional route preview aligned to the right end of the title row
      if (showRoute) {
        const polyline =
          activity.map?.polyline || activity.map?.summary_polyline;
        if (polyline) {
          try {
            const coordinates = decode(polyline);
            if (coordinates.length > 1) {
              const routeBoxWidth =
                selected.length <= 4
                  ? effectiveContentWidth * 0.5
                  : effectiveContentWidth * 0.3;
              const routeBoxHeight = rowHeightLocal * 3; // 3x row height
              const routeBoxX =
                selected.length <= 4 ? 270 : showOrnament ? 660 : 550;
              // Position closer to stats - align with title row in vertically centered layout
              const routeBoxBottom =
                yOffset + verticalPadding + titleFontSize - 20;
              const routeBoxY = routeBoxBottom - routeBoxHeight + 10;

              const lats = coordinates.map((c) => c[0]);
              const lngs = coordinates.map((c) => c[1]);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);

              const latRange = Math.max(1e-9, maxLat - minLat);
              const lngRange = Math.max(1e-9, maxLng - minLng);

              const latPad = latRange * 0.1;
              const lngPad = lngRange * 0.1;
              const paddedLatRange = latRange + latPad * 2;
              const paddedLngRange = lngRange + lngPad * 2;

              const scaleX = routeBoxWidth / paddedLngRange;
              const scaleY = routeBoxHeight / paddedLatRange;
              const scale = Math.min(scaleX, scaleY);

              const mapWidth = paddedLngRange * scale;
              const mapHeight = paddedLatRange * scale;
              const offsetX = routeBoxX + (routeBoxWidth - mapWidth) + 20;
              const offsetY = routeBoxY + (routeBoxHeight - mapHeight) + 25;

              const points: number[] = [];
              coordinates.forEach(([lat, lng]) => {
                const x =
                  offsetX +
                  ((lng - (minLng - lngPad)) / paddedLngRange) * mapWidth;
                const y =
                  offsetY +
                  ((maxLat + latPad - lat) / paddedLatRange) * mapHeight;
                points.push(x, y);
              });

              tempLayer.add(
                new Konva.Line({
                  points,
                  stroke: COLORS.text,
                  strokeWidth: 2,
                  lineJoin: "round",
                  lineCap: "round",
                  listening: false,
                })
              );
            }
          } catch (_) {
            // ignore decode errors
          }
        }
      }

      const items: LayoutItem[] = selected.map((key) => {
        const entry = (availableStats as any)[key];
        const label = entry.label as string;
        const value = entry.value as string;
        const labelWidth = measureText(labelFontCss, label);
        const valueWidth = measureText(valueFontCss, value);
        const capsuleBaseWidth = labelWidth + capsuleHPad * 2;
        const groupWidth =
          capsuleBaseWidth + gapBetweenCapsuleAndValue + valueWidth;
        return {
          key: key as StatKey,
          label,
          value,
          groupWidth,
          capsuleBaseWidth,
          valueWidth,
        };
      });

      // Greedy balance into 2 rows (alternate to keep long/short mixed)
      const sorted = [...items].sort((a, b) => b.groupWidth - a.groupWidth);
      const rows: LayoutItem[][] = [[], []];
      const rowWidths = [0, 0];
      sorted.forEach((it) => {
        const targetRow = rowWidths[0] <= rowWidths[1] ? 0 : 1;
        rows[targetRow].push(it);
        rowWidths[targetRow] +=
          it.groupWidth + (rows[targetRow].length > 1 ? gapBetweenItems : 0);
      });

      // Draw both rows justified - use verticalPadding calculated earlier
      const rowStartY = yOffset + verticalPadding + titleFontSize + 40; // below title, centered
      const rowHeight = 50; // approximate line height
      rows.forEach((rowItems, rowIndex) => {
        if (rowItems.length === 0) return;
        const totalIntrinsic =
          rowItems.reduce((acc, it) => acc + it.groupWidth, 0) +
          gapBetweenItems * (rowItems.length - 1);
        const extra = Math.max(0, effectiveContentWidth - totalIntrinsic);
        // Distribute extra width randomly across items for a more organic look
        const weights = rowItems.map(() => 0.2 + Math.random());
        const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
        const extrasPerItem = weights.map((w) => (extra * w) / weightSum);

        let x = marginX;
        const y = rowStartY + rowIndex * rowHeight;
        rowItems.forEach((it, i) => {
          const capsuleWidth = it.capsuleBaseWidth + extrasPerItem[i];
          const capsuleHeight = labelFontSize + capsuleVPad * 2;

          // Capsule
          tempLayer.add(
            new Konva.Rect({
              x,
              y: y - capsuleHeight / 2,
              width: capsuleWidth,
              height: capsuleHeight,
              cornerRadius: capsuleHeight / 2,
              stroke: COLORS.capsuleStroke,
              strokeWidth: 2,
              listening: false,
            })
          );

          // Label inside capsule (centered)
          tempLayer.add(
            new Konva.Text({
              x,
              y: y - labelFontSize / 2,
              width: capsuleWidth,
              text: it.label,
              fontSize: labelFontSize,
              fontFamily: "PP Telegraf",
              fontStyle: "normal",
              align: "center",
              fill: COLORS.text,
              listening: false,
            })
          );

          // Value to the right (regular, big)
          tempLayer.add(
            new Konva.Text({
              x: x + capsuleWidth + gapBetweenCapsuleAndValue,
              //   y: y - numberFontSize * 0.8, // compensate baseline
              //   y: y - capsuleHeight / 2,
              y: y - (numberFontSize * 0.95) / 2,
              text: it.value,
              fontSize: numberFontSize,
              fontFamily: "PP Telegraf",
              fill: COLORS.text,
              listening: false,
            })
          );

          x +=
            capsuleWidth +
            gapBetweenCapsuleAndValue +
            it.valueWidth +
            gapBetweenItems;
        });
      });

      // Decorative star-like ornament in bottom-right (optional)
      if (showOrnament) {
        const ornamentRadius = 48;
        const ornamentStroke = COLORS.text;
        const ornamentStrokeWidth = 3;
        const rightPad = 20;
        const d = ornamentRadius * Math.SQRT1_2;

        // Place ornament just to the right of the stats block, but never beyond the right edge
        // Make horizontal offset responsive to number of stats: smaller shift when ≤ 4
        const ornamentOverlapShift =
          selected.length <= 4 ? ornamentRadius * 0.6 : ornamentRadius * 1.2;
        const desiredCenterX =
          marginX + effectiveContentWidth + ornamentOverlapShift;
        const maxCenterX = dynamicWidth - rightPad - ornamentRadius;
        const ornamentCenterX = Math.min(desiredCenterX, maxCenterX);
        // Position closer to stats - align with bottom row of stats
        const ornamentCenterY = rowStartY + rowHeight + ornamentRadius / 2 + 20;

        // Vertical line
        tempLayer.add(
          new Konva.Line({
            points: [
              ornamentCenterX,
              ornamentCenterY - ornamentRadius,
              ornamentCenterX,
              ornamentCenterY + ornamentRadius,
            ],
            stroke: ornamentStroke,
            strokeWidth: ornamentStrokeWidth,
            lineCap: "square",
            listening: false,
          })
        );
        // Horizontal line
        tempLayer.add(
          new Konva.Line({
            points: [
              ornamentCenterX - ornamentRadius,
              ornamentCenterY,
              ornamentCenterX + ornamentRadius,
              ornamentCenterY,
            ],
            stroke: ornamentStroke,
            strokeWidth: ornamentStrokeWidth,
            lineCap: "square",
            listening: false,
          })
        );
        // Diagonal 45° (\)
        tempLayer.add(
          new Konva.Line({
            points: [
              ornamentCenterX - d,
              ornamentCenterY - d,
              ornamentCenterX + d,
              ornamentCenterY + d,
            ],
            stroke: ornamentStroke,
            strokeWidth: ornamentStrokeWidth,
            lineCap: "square",
            listening: false,
          })
        );
        // Diagonal -45° (/)
        tempLayer.add(
          new Konva.Line({
            points: [
              ornamentCenterX - d,
              ornamentCenterY + d,
              ornamentCenterX + d,
              ornamentCenterY - d,
            ],
            stroke: ornamentStroke,
            strokeWidth: ornamentStrokeWidth,
            lineCap: "square",
            listening: false,
          })
        );
      }

      // Draw and export with transparent background
      tempLayer.draw();
      const dataURL = tempStage.toDataURL({
        mimeType: "image/png",
        quality: 1,
        pixelRatio: 4, // 4x for crisp high-res output (was 2)
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

  // Download handler
  const handleDownload = async () => {
    const imageUrl = generatedImageUrl || (await generateImage());
    if (!imageUrl) return;

    await trackDownload();

    const link = document.createElement("a");
    link.download = `${activity.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_modern_minimalist.png`;
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
            <span className="text-blue-500">⚫</span>
            {language === "en"
              ? "Modern Minimalist Activity"
              : "Aktivitas Minimalis Modern"}
            {/* {isStravaData(activity) && (
              <img
                src={stravaLogoOrange}
                alt="Powered by Strava"
                className="h-4 w-auto ml-2"
              />
            )} */}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-blue-500 hover:bg-blue-600 text-white"
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
              {Object.entries(availableStats).map(([key, stat]) => {
                return (
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
                        !selectedStats.includes(key) &&
                        selectedStats.length >= 6
                      }
                      className="rounded"
                    />
                    <span className="text-sm">{(stat as any).label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === "en" ? "Decoration" : "Dekorasi"}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOrnament}
                onChange={(e) => setShowOrnament(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">
                {language === "en"
                  ? "Show star ornament"
                  : "Tampilkan ornamen bintang"}
              </span>
            </label>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === "en" ? "Route" : "Rute"}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRoute}
                onChange={(e) => setShowRoute(e.target.checked)}
                className="rounded"
                disabled={
                  !(activity.map?.polyline || activity.map?.summary_polyline)
                }
              />
              <span className="text-sm">
                {language === "en"
                  ? "Show route on title row"
                  : "Tampilkan rute di baris judul"}
              </span>
            </label>
          </div>
        </div>

        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden flex items-center justify-center bg-black min-h-[300px]">
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm text-white">
                    {language === "en"
                      ? "Rendering minimalist layout..."
                      : "Merender tata letak minimalis..."}
                  </p>
                </div>
              </div>
            ) : generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt="Modern Minimalist Activity"
                className="max-w-full max-h-[80vh] object-contain"
              />
            ) : (
              <div className="flex items-center justify-center">
                <p className="text-sm text-white">
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
