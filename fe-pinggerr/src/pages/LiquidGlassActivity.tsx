import { useRef, useEffect, useState } from "react";
import { decode } from "@googlemaps/polyline-codec";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StravaActivity } from "@/types/strava";
import { config } from "@/config/env";
import {
  MapPin,
  Zap,
  Clock,
  Gauge,
  Mountain,
  Calendar,
  Heart,
} from "lucide-react";

// Strava logos
import stravaLogoWhite from "@/assets/api_logo_pwrdBy_strava_stack_white.svg";
import stravaLogoOrange from "@/assets/api_logo_pwrdBy_strava_horiz_orange.png";

// Helper function to detect if activity data is from Strava (vs TCX)
const isStravaData = (activity: StravaActivity): boolean => {
  return activity.source === "strava";
};

// Helper function to convert Lucide icons to SVG data URLs
const createIconImage = async (
  iconName: string,
  color: string = "white",
  size: number = 16
): Promise<HTMLImageElement> => {
  const iconSvgs: { [key: string]: string } = {
    MapPin: `<path d="m12 8 6-3-6-3v10"/><path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12"/><path d="m6.49 12.85 11.02 6.3"/><path d="M17.51 12.85 6.5 19.15"/>`,
    Zap: `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`,
    Clock: `<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>`,
    // Timer: `<path d="M10 2h4"/><path d="M4.6 11a8 8 0 0 0 1.7 8.7 8 8 0 0 0 8.7 1.7 8 8 0 0 0 1.7-8.7 8 8 0 0 0-8.7-1.7"/><path d="M9 12l2 2 4-4"/>`,
    Timer: `<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>`,
    Gauge: `<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>`,
    Mountain: `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>`,
    Calendar: `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
    Heart: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>`,
  };

  const svgContent = iconSvgs[iconName] || iconSvgs.MapPin;
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgContent}</svg>`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
  });
};

interface LiquidGlassActivityProps {
  activity: StravaActivity;
  language: "en" | "id";
  onDownload?: (imageUrl: string) => void;
}

export function LiquidGlassActivity({
  activity,
  language,
  onDownload,
}: LiquidGlassActivityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [iconImages, setIconImages] = useState<{
    [key: string]: HTMLImageElement;
  }>({});

  // User customizable options - initialize with available stats only
  const [selectedStats, setSelectedStats] = useState<string[]>(() => {
    // Default stats we want to show
    const defaultStats = ["distance", "pace", "time", "heartrate"];

    // Filter to only include stats that are available for this activity
    const availableStatKeys = [
      "distance",
      "pace",
      "time",
      "elapsed",
      "speed",
      "elevation",
      "date",
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];

    // Return only the default stats that are actually available, up to 4
    return defaultStats
      .filter((stat) => availableStatKeys.includes(stat))
      .slice(0, 4);
  });

  const [glassStyle, setGlassStyle] = useState<"light" | "dark">("light");

  // Glass effect colors
  const GLASS_COLORS = {
    light: {
      cardBg: "rgba(255, 255, 255, 0.5)",
      cardBorder: "rgba(255, 255, 255, 0.3)",
      textPrimary: "#2D3047",
      textSecondary: "#2D3047",
      accent: "rgba(255, 255, 255, 0.4)",
      routePath: "#2D3047",
    },
    dark: {
      cardBg: "rgba(0, 0, 0, 0.5)",
      cardBorder: "rgba(255, 255, 255, 0.2)",
      textPrimary: "rgba(255, 255, 255, 0.95)",
      textSecondary: "rgba(255, 255, 255, 0.7)",
      accent: "rgba(255, 255, 255, 0.3)",
      routePath: "rgba(255, 255, 255, 0.8)",
    },
  };

  // Changed dimensions to horizontal layout
  const CANVAS_DIMENSIONS = { width: 550, height: 245 };

  // Reset selected stats when activity changes
  useEffect(() => {
    // Reset selected stats when activity changes to ensure we don't have invalid selections
    const availableStatKeys = [
      "distance",
      "pace",
      "time",
      "elapsed",
      "speed",
      "elevation",
      "date",
      ...(activity.has_heartrate && activity.average_heartrate
        ? ["heartrate"]
        : []),
    ];

    // Filter current selection to only include available stats
    const validSelectedStats = selectedStats.filter((stat) =>
      availableStatKeys.includes(stat)
    );

    // If we have fewer than 4 valid stats selected, try to fill up to 4 with remaining available stats
    if (validSelectedStats.length < 4) {
      const remainingStats = availableStatKeys.filter(
        (stat) => !validSelectedStats.includes(stat)
      );
      const additionalStats = remainingStats.slice(
        0,
        4 - validSelectedStats.length
      );
      const newSelectedStats = [...validSelectedStats, ...additionalStats];

      if (JSON.stringify(newSelectedStats) !== JSON.stringify(selectedStats)) {
        setSelectedStats(newSelectedStats);
      }
    } else if (
      JSON.stringify(validSelectedStats) !== JSON.stringify(selectedStats)
    ) {
      setSelectedStats(validSelectedStats);
    }
  }, [activity]); // Only depend on activity, not selectedStats to avoid infinite loop

  // Load Strava logo, font, and icon images
  useEffect(() => {
    const loadAssets = async () => {
      // Load Strava logo
      const img = new Image();
      img.onload = () => {
        setLogoImage(img);
      };
      img.src = stravaLogoWhite;
      logoImageRef.current = img;

      // Load icon images with appropriate colors based on glass style
      const iconNames = [
        "MapPin",
        "Zap",
        "Clock",
        "Timer",
        "Gauge",
        "Mountain",
        "Calendar",
        "Heart",
      ];

      // Use different colors based on glass style
      const iconColor = glassStyle === "light" ? "#2D3047" : "white";

      const iconImagePromises = iconNames.map(async (iconName) => {
        const iconImage = await createIconImage(iconName, iconColor, 16);
        return { iconName, iconImage };
      });

      try {
        const iconResults = await Promise.all(iconImagePromises);
        const iconImageMap: { [key: string]: HTMLImageElement } = {};
        iconResults.forEach(({ iconName, iconImage }) => {
          iconImageMap[iconName] = iconImage;
        });
        setIconImages(iconImageMap);
      } catch (error) {
        console.error("Error loading icon images:", error);
      }
    };

    loadAssets();
  }, [glassStyle]); // Add glassStyle as dependency

  // Generate image when parameters change
  useEffect(() => {
    if (logoImage && Object.keys(iconImages).length > 0) {
      generateImage();
    }
  }, [logoImage, iconImages, selectedStats, glassStyle, activity]);

  // Helper functions for formatting
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatPace = (activity: StravaActivity) => {
    // Use average_speed from Strava if available, otherwise fall back to calculation
    if (activity.average_speed && activity.average_speed > 0) {
      // average_speed is in m/s, convert to min/km
      // Formula: 1000 / (average_speed * 60) = minutes per km
      const paceMinPerKm = 1000 / (activity.average_speed * 60);
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
    } else {
      // Fallback to total distance / total time calculation
      const minutes = activity.moving_time / 60;
      const km = activity.distance / 1000;
      const paceMinPerKm = minutes / km;
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
    }
  };

  const formatSpeed = (distanceMeters: number, timeSeconds: number) => {
    const kmh = distanceMeters / 1000 / (timeSeconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatElevation = (meters: number) => `${meters.toFixed(0)}m`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatHeartRate = (bpm: number) => `${Math.round(bpm)} BPM`;

  // Track download
  const trackDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-lg-download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // Silent fail
    }
  };

  // Available stats for selection with Lucide icons
  const availableStats = {
    distance: {
      label: "DISTANCE",
      value: formatDistance(activity.distance),
      shortLabel: "DISTANCE",
      icon: MapPin,
      iconName: "MapPin",
    },
    pace: {
      label: "AVG PACE",
      value: formatPace(activity), // Pass the whole activity object
      shortLabel: "AVG PACE",
      icon: Zap,
      iconName: "Zap",
    },
    time: {
      label: "MOVING TIME",
      value: formatTime(activity.moving_time),
      shortLabel: "MOVING TIME",
      icon: Clock,
      iconName: "Clock",
    },
    elapsed: {
      label: "ELAPSED TIME",
      value: formatTime(activity.elapsed_time),
      shortLabel: "ELAPSED TIME",
      icon: Clock,
      iconName: "Clock",
    },
    speed: {
      label: "AVG SPEED",
      value: formatSpeed(activity.distance, activity.moving_time),
      shortLabel: "AVG SPEED",
      icon: Gauge,
      iconName: "Gauge",
    },
    elevation: {
      label: "ELEVATION GAIN",
      value: formatElevation(activity.total_elevation_gain),
      shortLabel: "ELEVATION",
      icon: Mountain,
      iconName: "Mountain",
    },
    date: {
      label: "DATE",
      value: formatDate(activity.start_date),
      shortLabel: "DATE",
      icon: Calendar,
      iconName: "Calendar",
    },
    ...(activity.has_heartrate && activity.average_heartrate
      ? {
          heartrate: {
            label: "AVG HEART RATE",
            value: formatHeartRate(activity.average_heartrate),
            shortLabel: "HEART RATE",
            icon: Heart,
            iconName: "Heart",
          },
        }
      : {}),
  };

  // Process polyline data for route visualization
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

      // Define the card dimensions
      const cardPadding = 15;
      const cardWidth = CANVAS_DIMENSIONS.width - cardPadding * 2;
      const cardHeight = CANVAS_DIMENSIONS.height - cardPadding * 2;
      const cardX = cardPadding;
      const cardY = cardPadding;

      // Right section for route (1/3 of the card)
      const rightSectionWidth = cardWidth * 0.33;
      const rightSectionX = cardX + cardWidth - rightSectionWidth;

      // Route area within right section with padding
      const routePadding = 20;
      const routeAreaWidth = rightSectionWidth - routePadding * 2;
      const routeAreaHeight = cardHeight - routePadding * 2;
      const routeAreaX = rightSectionX + routePadding;
      const routeAreaY = cardY + routePadding;

      // Calculate the scale to fit the route
      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;

      // Add padding around the route
      const latPadding = latRange * 0.1;
      const lngPadding = lngRange * 0.1;

      const paddedLatRange = latRange + latPadding * 2;
      const paddedLngRange = lngRange + lngPadding * 2;

      // Calculate scale factors
      const scaleX = routeAreaWidth / paddedLngRange;
      const scaleY = routeAreaHeight / paddedLatRange;
      const routeScale = Math.min(scaleX, scaleY);

      // Calculate actual dimensions and centering
      const mapWidth = paddedLngRange * routeScale;
      const mapHeight = paddedLatRange * routeScale;

      const offsetX = routeAreaX + (routeAreaWidth - mapWidth) / 2;
      const offsetY = routeAreaY + (routeAreaHeight - mapHeight) / 2;

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

  // Generate the glass card image
  const generateImage = async () => {
    if (!logoImage || Object.keys(iconImages).length === 0) return null;

    setIsGenerating(true);
    try {
      const Konva = (await import("konva")).default;

      // Create temporary stage with transparent background
      const tempStage = new Konva.Stage({
        container: document.createElement("div"),
        width: CANVAS_DIMENSIONS.width,
        height: CANVAS_DIMENSIONS.height,
      });

      const tempLayer = new Konva.Layer();
      tempStage.add(tempLayer);

      const colors = GLASS_COLORS[glassStyle];

      // Card dimensions and position
      const cardPadding = 15;
      const cardWidth = CANVAS_DIMENSIONS.width - cardPadding * 2;
      const cardHeight = CANVAS_DIMENSIONS.height - cardPadding * 2;
      const cardX = cardPadding;
      const cardY = cardPadding;
      const cornerRadius = 15;

      // Create glass card background with gradient
      const gradient = new Konva.Rect({
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        cornerRadius: cornerRadius,
        fill: colors.cardBg,
        stroke: colors.cardBorder,
        strokeWidth: 1,
        shadowColor: "rgba(0, 0, 0, 0.1)",
        shadowBlur: 50,
        shadowOffset: { x: 0, y: 4 },
      });

      tempLayer.add(gradient);

      // Add subtle inner glow effect
      const innerGlow = new Konva.Rect({
        x: cardX + 1,
        y: cardY + 1,
        width: cardWidth - 2,
        height: cardHeight - 2,
        cornerRadius: cornerRadius - 1,
        stroke: colors.accent,
        strokeWidth: 0.5,
      });

      tempLayer.add(innerGlow);

      // Left section (2/3 of the card)
      const leftSectionWidth = cardWidth * 0.6;

      // Activity title - positioned in left section, aligned left
      const titleFontSize = 18;
      const title =
        activity.name.length > 35
          ? activity.name.substring(0, 35) + "..."
          : activity.name;

      tempLayer.add(
        new Konva.Text({
          x: cardX + 28,
          y: cardY + 20,
          text: title,
          fontSize: titleFontSize,
          fontFamily: "'Funnel Display', sans-serif",
          fontStyle: "bold",
          fill: colors.textPrimary,
          width: leftSectionWidth - 40,
          align: "left",
        })
      );

      // Stats grid - positioned in left section with tighter spacing
      const statsStartY = cardY + 60;
      const maxStats = Math.min(selectedStats.length, 4);
      const statsPerRow = 2;

      selectedStats.slice(0, maxStats).forEach((statKey, index) => {
        const stat = availableStats[statKey as keyof typeof availableStats];
        if (!stat) return;

        const row = Math.floor(index / statsPerRow);
        const col = index % statsPerRow;
        const statWidth = (leftSectionWidth - 80) / statsPerRow;
        const statHeight = 90;

        const statX = cardX + 20 + col * (statWidth + 30);
        let statY = statsStartY + row * statHeight;
        if (index === 2 || index === 3) {
          statY -= 20;
        }

        // Stat icon
        const iconImage = iconImages[stat.iconName];
        if (iconImage) {
          tempLayer.add(
            new Konva.Image({
              image: iconImage,
              x: statX + 8,
              y: statY,
              width: 14,
              height: 14,
            })
          );
        }

        // Stat label
        tempLayer.add(
          new Konva.Text({
            x: statX + 8,
            y: statY + 22,
            text: stat.label,
            fontSize: 12,
            fontFamily: "'Funnel Display', sans-serif",
            fill: colors.textSecondary,
            width: statWidth - 16,
            align: "left",
          })
        );

        // Stat value
        tempLayer.add(
          new Konva.Text({
            x: statX + 8,
            y: statY + 36,
            text: stat.value,
            fontSize: 16,
            fontFamily: "'Funnel Display', sans-serif",
            fontStyle: "bold",
            fill: colors.textPrimary,
            width: statWidth - 16,
            align: "left",
          })
        );
      });

      // Draw route path in right section if available
      if (pathPoints.length > 1) {
        const strokeWidth = 2.5;
        tempLayer.add(
          new Konva.Line({
            points: pathPoints.flatMap((p) => [p.x, p.y]),
            stroke: colors.routePath,
            strokeWidth: strokeWidth,
            lineJoin: "round",
            lineCap: "round",
            shadowColor: "rgba(0, 0, 0, 0.2)",
            shadowBlur: 2,
            shadowOffset: { x: 0, y: 1 },
          })
        );

        // Add start and end points
        if (pathPoints.length > 0) {
          // Start point (green)
          tempLayer.add(
            new Konva.Circle({
              x: pathPoints[0].x,
              y: pathPoints[0].y,
              radius: 4,
              fill: "rgba(34, 197, 94, 0.9)",
              stroke: colors.textPrimary,
              strokeWidth: 1,
            })
          );

          // End point (red)
          tempLayer.add(
            new Konva.Circle({
              x: pathPoints[pathPoints.length - 1].x,
              y: pathPoints[pathPoints.length - 1].y,
              radius: 4,
              fill: "rgba(239, 68, 68, 0.9)",
              stroke: colors.textPrimary,
              strokeWidth: 1,
            })
          );
        }
      }

      // Add Strava logo - positioned in bottom right
      const logoWidth = 40;
      const logoHeight = logoWidth * (30 / 88);

      tempLayer.add(
        new Konva.Image({
          image: logoImage,
          x: cardX + cardWidth - logoWidth - 12,
          y: cardY + cardHeight - logoHeight - 12,
          width: logoWidth,
          height: logoHeight,
          opacity: 1,
        })
      );

      // Draw and export with transparent background
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

  // Download handler
  const handleDownload = async () => {
    const imageUrl = generatedImageUrl || (await generateImage());
    if (!imageUrl) return;

    await trackDownload();

    const link = document.createElement("a");
    link.download = `${activity.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_liquid_glass_wide.png`;
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
            <span className="text-blue-500">🧊</span>
            {language === "en"
              ? "Liquid Glass Activity Card"
              : "Kartu Aktivitas Kaca Cair"}
            {isStravaData(activity) && (
              <img
                src={stravaLogoOrange}
                alt="Powered by Strava"
                className="h-4 w-auto ml-2"
              />
            )}
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
                ? "Select exactly 4 stats for your glass card:"
                : "Pilih tepat 4 statistik untuk kartu kaca Anda:"}
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(availableStats).map(([key, stat]) => {
                const IconComponent = stat.icon;
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStats.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked && selectedStats.length < 4) {
                          setSelectedStats([...selectedStats, key]);
                        } else if (!e.target.checked) {
                          setSelectedStats(
                            selectedStats.filter((s) => s !== key)
                          );
                        }
                      }}
                      disabled={
                        !selectedStats.includes(key) &&
                        selectedStats.length >= 4
                      }
                      className="rounded"
                    />
                    <IconComponent className="w-4 h-4" />
                    <span className="text-sm">{stat.shortLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === "en" ? "Glass Style:" : "Gaya Kaca:"}
            </label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="glassStyle"
                  value="light"
                  checked={glassStyle === "light"}
                  onChange={(e) =>
                    setGlassStyle(e.target.value as "light" | "dark")
                  }
                />
                <span className="text-sm">
                  {language === "en" ? "Light Glass" : "Kaca Terang"}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="glassStyle"
                  value="dark"
                  checked={glassStyle === "dark"}
                  onChange={(e) =>
                    setGlassStyle(e.target.value as "light" | "dark")
                  }
                />
                <span className="text-sm">
                  {language === "en" ? "Dark Glass" : "Kaca Gelap"}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="w-full">
          <div className="border rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 min-h-[300px]">
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm text-white">
                    {language === "en"
                      ? "Creating glass effect..."
                      : "Membuat efek kaca..."}
                  </p>
                </div>
              </div>
            ) : generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt="Liquid Glass Activity Card"
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

          {/* Info */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {pathPoints.length === 0 && (
              <p className="mt-2 text-orange-600">
                ⚠️{" "}
                {language === "en"
                  ? "No GPS data available - showing stats only"
                  : "Tidak ada data GPS - hanya menampilkan statistik"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
