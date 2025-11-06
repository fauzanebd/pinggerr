import { useRef, useEffect, useState } from "react";
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StravaActivity } from "@/types/strava";
import { config } from "@/config/env";

interface StravaDefaultStyleProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function StravaDefaultStyle({
  activity,
  language,
  onDownload,
}: StravaDefaultStyleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [fontLoaded, setFontLoaded] = useState(false);

  // User selectable stats (same behavior as PinkGreen)
  const [selectedStats, setSelectedStats] = useState<string[]>(() => {
    const defaults = ["distance", "pace", "time"];
    const available = [
      "distance",
      "pace",
      "time",
      "speed",
      "elevation",
      "date",
      ...(activity.calories ? ["calories"] : []),
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];
    return defaults.filter((s) => available.includes(s)).slice(0, 3);
  });

  // Fixed palette for Strava default style
  const DATA_COLOR = "#FFFFFF"; // stats in white
  const PATH_COLOR = "#FC5200"; // route in Strava orange

  // Fixed output size similar to PinkGreen
  const CANVAS_DIMENSIONS = { width: 800, height: 800 } as const;

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

  // Load Special Gothic font used by PinkGreen
  useEffect(() => {
    const loadFont = async () => {
      try {
        if ("fonts" in document) {
          const specialGothicFont = new FontFace(
            "Special Gothic Expanded One",
            "url(/fonts/SpecialGothicExpandedOne-Regular.ttf)"
          );
          await specialGothicFont.load();
          document.fonts.add(specialGothicFont);
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

  // Formatters (same as PinkGreen)
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
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
  const formatElevation = (meters: number) => `${meters.toFixed(2)} m`;
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const formatHeartRate = (bpm: number) => `${Math.round(bpm)} BPM`;
  const formatCalories = (kcal: number) => `${Math.round(kcal)} kcal`;
  const formatCadence = (cad: number) => `${Math.round(cad * 2)} spm`;
  const formatPower = (w: number) => `${Math.round(w)} W`;
  const formatTemperature = (t: number) => `${Math.round(t)}°C`;

  // Stats map
  const availableStats = {
    distance: {
      label: "DISTANCE",
      value: formatDistance(activity.distance),
      shortLabel: "DISTANCE",
    },
    pace: {
      label: "AVG PACE",
      value: formatPace(activity),
      shortLabel: "AVG PACE",
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
    ...(activity.calories
      ? {
          calories: {
            label: "CALORIES",
            value: formatCalories(activity.calories),
            shortLabel: "CALORIES",
          },
        }
      : {}),
    ...(activity.average_cadence
      ? {
          cadence: {
            label: "AVG CADENCE",
            value: formatCadence(activity.average_cadence),
            shortLabel: "AVG CADENCE",
          },
        }
      : {}),
    ...(activity.average_watts
      ? {
          power: {
            label: "AVG POWER",
            value: formatPower(activity.average_watts),
            shortLabel: "AVG POWER",
          },
        }
      : {}),
    ...(activity.average_temp
      ? {
          temperature: {
            label: "AVG TEMP",
            value: formatTemperature(activity.average_temp),
            shortLabel: "AVG TEMP",
          },
        }
      : {}),
    ...(activity.has_heartrate && activity.average_heartrate
      ? {
          heartrate: {
            label: "AVG HEART RATE",
            value: formatHeartRate(activity.average_heartrate),
            shortLabel: "AVG HR",
          },
        }
      : {}),
  } as const;

  // Polyline processor (same as PinkGreen)
  const processPolyline = () => {
    const polyline = activity.map?.polyline || activity.map?.summary_polyline;
    if (!polyline) return [] as Array<{ x: number; y: number }>;
    try {
      const coordinates = decode(polyline);
      if (coordinates.length === 0) return [];

      const canvas = CANVAS_DIMENSIONS;
      const lats = coordinates.map((c) => c[0]);
      const lngs = coordinates.map((c) => c[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const dataAreaHeight = canvas.height * 0.4;
      const mapAreaHeight = canvas.height * 0.4;
      const mapPadding = canvas.width * 0.2;
      const mapAreaX = mapPadding;
      const mapAreaY = dataAreaHeight;
      const mapAreaWidth = canvas.width - mapPadding * 2;

      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;
      const latPadding = latRange * 0.1;
      const lngPadding = lngRange * 0.1;
      const paddedLatRange = latRange + latPadding * 2;
      const paddedLngRange = lngRange + lngPadding * 2;
      const scaleX = mapAreaWidth / paddedLngRange;
      const scaleY = mapAreaHeight / paddedLatRange;
      const scale = Math.min(scaleX, scaleY);

      // Apply an additional downscale to make the route smaller on canvas
      const PATH_SCALE = 0.6;

      const mapWidth = paddedLngRange * scale * PATH_SCALE;
      const mapHeight = paddedLatRange * scale * PATH_SCALE;
      const offsetX = mapAreaX + (mapAreaWidth - mapWidth) / 2;
      const offsetY = mapAreaY + (mapAreaHeight - mapHeight) / 2;

      return coordinates.map(([lat, lng]) => {
        const x =
          offsetX + ((lng - (minLng - lngPadding)) / paddedLngRange) * mapWidth;
        const y =
          offsetY + ((maxLat + latPadding - lat) / paddedLatRange) * mapHeight;
        return { x, y };
      });
    } catch (e) {
      console.error("Error processing polyline:", e);
      return [];
    }
  };

  const pathPoints = processPolyline();

  // Generate image whenever deps change
  useEffect(() => {
    if (fontLoaded) {
      generateImage();
    }
  }, [fontLoaded, selectedStats, activity]);

  // Track download
  const trackDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-sds-download`, {
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

      // Stats panel (3 rows)
      selectedStats.slice(0, 3).forEach((key, idx) => {
        const stat = (availableStats as any)[key];
        if (!stat) return;
        const dataAreaHeight = CANVAS_DIMENSIONS.height * 0.35;
        const availableSpace = dataAreaHeight - 40;
        const spacing = availableSpace / 3;
        const startY = 150;
        const statY = startY + idx * spacing;
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

        tempLayer.add(
          new Konva.Text({
            x: CANVAS_DIMENSIONS.width / 2 - labelWidth / 2,
            y: statY,
            text: stat.label,
            fontSize: labelSize,
            fontFamily: "'Funnel Display', sans-serif",
            fontStyle: "400",
            fill: DATA_COLOR,
          })
        );

        tempLayer.add(
          new Konva.Text({
            x: CANVAS_DIMENSIONS.width / 2 - valueWidth / 2,
            y: statY + labelSize + 4,
            text: stat.value,
            fontSize: valueSize,
            fontFamily: valueFontFamily,
            fontStyle: "normal",
            fill: DATA_COLOR,
          })
        );
      });

      // Route path in Strava orange
      if (pathPoints.length > 1) {
        const strokeWidth = Math.max(2, CANVAS_DIMENSIONS.width * 0.008);
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
      console.error("Error generating SDS image:", e);
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
      .toLowerCase()}_strava_default_style.png`;
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
            <span className="text-orange-600">🔥</span>
            {language === "en" ? "Strava Default Style" : "Gaya Default Strava"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-orange-600 hover:bg-orange-700 text-white"
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
        </div>

        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden flex items-center justify-center bg-black">
            {isGenerating ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
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
                alt="Strava Default Style Visualization"
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
}
