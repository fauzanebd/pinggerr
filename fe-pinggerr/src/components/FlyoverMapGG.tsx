import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { config } from "@/config/env";
import { useMapLoadGuard } from "@/hooks/useMapLoadGuard";
import { useVideoExport } from "@/hooks/useVideoExport";
import type {
  StravaActivity,
  ActivityTrackpoint,
  ActivitySegment,
  FlyoverState,
} from "@/types/strava";
import constants from "@/lib/constants";
import { StatsOverlay } from "@/components/StatsOverlay";
import { SiksorogoStatsOverlay } from "./SiksorogoStatsOverlay";

interface FlyoverMapProps {
  activity: StravaActivity;
  segments?: ActivitySegment[];
  flyoverState: FlyoverState;
  onFlyoverEnd?: () => void;
  className?: string;
  orientation?: "landscape" | "portrait" | "square" | "fourFive";
  resetSignal?: number;
  onExportProgress?: (progress: {
    frame: number;
    totalFrames: number;
    percentage: number;
    isExporting: boolean;
  }) => void;
  onExportComplete?: (videoBlob: Blob) => void;
  onExportError?: (error: string) => void;
}

export interface FlyoverMapHandle {
  exportVideo: (quality: "high" | "fast") => Promise<void>;
  cancelExport: () => void;
  isExporting: boolean;
}

export const FlyoverMap = forwardRef<FlyoverMapHandle, FlyoverMapProps>(
  (
    {
      activity,
      flyoverState,
      onFlyoverEnd,
      className = "",
      orientation = "landscape",
      resetSignal,
      onExportProgress,
      onExportComplete,
      onExportError,
    },
    ref
  ) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const {
      canLoadMap,
      trackMapLoad,
      isLoading: isCheckingLimit,
    } = useMapLoadGuard();

    // Video export
    const { exportProgress, exportVideo, cancelExport } = useVideoExport();

    // Animation refs
    const animationFrame = useRef<number | null>(null);
    const pathDistance = useRef<number>(0);
    const previousCameraPosition = useRef<{ lng: number; lat: number } | null>(
      null
    );
    const validTrackpoints = useRef<ActivityTrackpoint[]>([]);
    const isAnimating = useRef<boolean>(false);

    // Add state for current trackpoint index to trigger re-renders
    const [currentTrackpointIndex, setCurrentTrackpointIndex] = useState(0);
    // Keep the ref for internal animation logic that needs immediate access
    const currentTrackpointIndexRef = useRef<number>(0);

    // Also make isInFinalView a state to trigger re-renders
    const [isInFinalView, setIsInFinalView] = useState(false);

    // Linear interpolation function for smooth camera movement
    const lerp = (start: number, end: number, amt: number): number => {
      return (1 - amt) * start + amt * end;
    };

    // const lerp2 = (a: number, b: number, t: number): number => {
    //   return a + (b - a) * t;
    // };

    // Compute camera position with dynamic lat/lng degree calculations
    const computeCameraPosition = useCallback(
      (
        pitch: number,
        bearing: number,
        targetPosition: { lng: number; lat: number },
        altitude: number,
        smooth: boolean = false
      ) => {
        const bearingInRadian = bearing / 57.29;
        const pitchInRadian = (90 - pitch) / 57.29;

        // Dynamic calculation based on latitude
        const metersPerDegreeLatitude = 110574;
        const metersPerDegreeLongitudeAtLatitude = (latDeg: number) =>
          111320 * Math.cos((latDeg * Math.PI) / 180);

        const metersPerDegreeLongitude = metersPerDegreeLongitudeAtLatitude(
          targetPosition.lat
        );

        const horizonDist = altitude / Math.tan(pitchInRadian);
        const lngDiff =
          (horizonDist * Math.sin(-bearingInRadian)) / metersPerDegreeLongitude;
        const latDiff =
          (horizonDist * Math.cos(-bearingInRadian)) / metersPerDegreeLatitude;

        const correctedLng = targetPosition.lng + lngDiff;
        const correctedLat = targetPosition.lat - latDiff;

        let newCameraPosition = {
          lng: correctedLng,
          lat: correctedLat,
        };

        // Apply smoothing with LERP if enabled and we have a previous position
        if (smooth && previousCameraPosition.current) {
          const alpha = 0.2;
          newCameraPosition = {
            lng: lerp(
              previousCameraPosition.current.lng,
              newCameraPosition.lng,
              alpha
            ),
            lat: lerp(
              previousCameraPosition.current.lat,
              newCameraPosition.lat,
              alpha
            ),
          };
        }

        previousCameraPosition.current = newCameraPosition;
        return newCameraPosition;
      },
      []
    );

    // Enhanced animation function for export (no smoothing, precise positioning)
    const animateExportFrame = useCallback(
      async (frame: number, totalFrames: number): Promise<void> => {
        if (
          !map.current ||
          !validTrackpoints.current.length ||
          pathDistance.current === 0
        ) {
          throw new Error("Map or trackpoints not ready");
        }

        const coordinates = validTrackpoints.current.map((tp) => [
          tp.longitude!,
          tp.latitude!,
        ]);
        const pathLineString = turf.lineString(coordinates);
        const startBearing = constants.BEARING_START;
        const pitch = constants.PITCH_START;
        const altitude = constants.ALTITUDE_START;

        const animationPhase = Math.min(frame / (totalFrames - 1), 1);

        // Calculate current trackpoint index based on animation phase
        const targetIndex = Math.floor(
          animationPhase * (validTrackpoints.current.length - 1)
        );
        // Update both ref and state
        currentTrackpointIndexRef.current = targetIndex;
        setCurrentTrackpointIndex(targetIndex);

        const currentDistance = pathDistance.current * animationPhase;
        const alongPath = turf.along(pathLineString, currentDistance, {
          units: "kilometers",
        });

        if (!alongPath?.geometry?.coordinates) {
          throw new Error("Invalid path coordinates");
        }

        const [lng, lat] = alongPath.geometry.coordinates;
        const targetPosition = { lng, lat };

        // Update progress line geometry (fast!) instead of paint property (slow)
        const progressLineSource = map.current.getSource(
          "progress-line"
        ) as mapboxgl.GeoJSONSource;
        if (progressLineSource) {
          // Find all coordinates that come before the current distance
          const progressCoords: number[][] = [];
          let accumulatedDist = 0;

          for (let i = 0; i < coordinates.length; i++) {
            if (i === 0) {
              progressCoords.push(coordinates[i]);
              continue;
            }

            const segmentDist = turf.distance(
              turf.point(coordinates[i - 1]),
              turf.point(coordinates[i]),
              { units: "kilometers" }
            );

            if (accumulatedDist + segmentDist <= currentDistance) {
              progressCoords.push(coordinates[i]);
              accumulatedDist += segmentDist;
            } else {
              break;
            }
          }

          // Add the exact current position at the end
          progressCoords.push([lng, lat]);

          progressLineSource.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: progressCoords },
          });
        }

        const progressSource = map.current.getSource(
          "progress-point"
        ) as mapboxgl.GeoJSONSource;
        if (progressSource) {
          progressSource.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [lng, lat] },
          });
        }

        const bearing = startBearing - animationPhase * 200.0;
        const cameraPosition = computeCameraPosition(
          pitch,
          bearing,
          targetPosition,
          altitude,
          false
        );

        if (
          map.current &&
          isFinite(cameraPosition.lng) &&
          isFinite(cameraPosition.lat)
        ) {
          let targetElevation = 0;
          const elev = map.current.queryTerrainElevation([lng, lat]);
          if (typeof elev === "number" && isFinite(elev)) {
            targetElevation = elev;
          }

          const cameraAltitudeAboveSea = targetElevation + altitude;

          const camera = map.current.getFreeCameraOptions();
          camera.setPitchBearing(pitch, bearing);
          camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
            cameraPosition,
            cameraAltitudeAboveSea
          );
          map.current.setFreeCameraOptions(camera);
        }
      },
      [computeCameraPosition]
    );

    const showFinalViewForExport = useCallback((): Promise<void> => {
      return new Promise((resolve) => {
        if (!map.current || !validTrackpoints.current.length) {
          resolve();
          return;
        }

        // Set final view flag
        setIsInFinalView(true);

        const bounds = new mapboxgl.LngLatBounds();
        validTrackpoints.current.forEach((tp) => {
          if (tp.latitude && tp.longitude) {
            bounds.extend([tp.longitude, tp.latitude]);
          }
        });

        const { center, zoom } =
          map.current.cameraForBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
          }) ?? {};

        if (!center || zoom === undefined) {
          resolve();
          return;
        }

        // Use smooth flyTo animation
        map.current.flyTo({
          center,
          zoom,
          pitch: 0,
          bearing: constants.BEARING_START,
          speed: 1.0, // Adjust speed for export timing
          curve: 1.2,
          easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
          essential: true,
        });

        // Don't wait for completion - let the export loop capture the transition
        setTimeout(() => resolve(), 100);
      });
    }, []);

    // Export handler
    const handleExport = useCallback(
      async (quality: "high" | "fast" = "high") => {
        if (!map.current || !isMapLoaded) {
          onExportError?.("Map not ready for export");
          return;
        }

        const settings = {
          width:
            orientation === "landscape"
              ? 1920
              : orientation === "portrait"
              ? 1080
              : orientation === "fourFive"
              ? 1080
              : 1080, // square
          height:
            orientation === "landscape"
              ? 1080
              : orientation === "portrait"
              ? 1920
              : orientation === "fourFive"
              ? 1350 // 4:5
              : 1080, // square
          fps: quality === "high" ? 60 : 24,
          duration: constants.DEFAULT_DURATION_SECONDS, // Main animation duration
          quality,
        };

        try {
          const videoBlob = await exportVideo(
            map.current,
            animateExportFrame,
            showFinalViewForExport, // Add the final view function
            settings
          );
          onExportComplete?.(videoBlob);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Export failed";
          onExportError?.(errorMessage);
        }
      },
      [
        map,
        isMapLoaded,
        orientation,
        exportVideo,
        animateExportFrame,
        showFinalViewForExport,
        onExportComplete,
        onExportError,
      ]
    );

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportVideo: handleExport,
      cancelExport,
      isExporting: exportProgress.isExporting,
    }));

    // Report export progress to parent
    useEffect(() => {
      onExportProgress?.(exportProgress);
    }, [exportProgress, onExportProgress]);

    const animatePreview = useCallback(
      async (duration: number): Promise<void> => {
        return new Promise((resolve) => {
          if (
            !map.current ||
            !validTrackpoints.current.length ||
            pathDistance.current === 0
          ) {
            resolve();
            return;
          }

          setIsInFinalView(false); // Reset final view flag

          const coordinates = validTrackpoints.current.map((tp) => [
            tp.longitude!,
            tp.latitude!,
          ]);
          const pathLineString = turf.lineString(coordinates);
          const startBearing = constants.BEARING_START;
          const pitch = constants.PITCH_START;
          const altitude = constants.ALTITUDE_START;

          let startTime: number | null = null;
          let lastFrameTime = 0;
          const targetFrameTime = 1000 / 30;

          const animateFrame = async (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            if (currentTime - lastFrameTime < targetFrameTime) {
              animationFrame.current = requestAnimationFrame(animateFrame);
              return;
            }
            lastFrameTime = currentTime;

            const animationPhase = Math.min(
              (currentTime - startTime) / duration,
              1
            );

            if (!flyoverState.isPlaying) {
              resolve();
              return;
            }

            if (animationPhase >= 1) {
              resolve();
              return;
            }

            // Update current trackpoint index
            const targetIndex = Math.floor(
              animationPhase * (validTrackpoints.current.length - 1)
            );
            // Update both ref and state
            currentTrackpointIndexRef.current = targetIndex;
            setCurrentTrackpointIndex(targetIndex);

            const currentDistance = pathDistance.current * animationPhase;
            const alongPath = turf.along(pathLineString, currentDistance, {
              units: "kilometers",
            });

            if (!alongPath?.geometry?.coordinates) {
              resolve();
              return;
            }

            const [lng, lat] = alongPath.geometry.coordinates;
            const targetPosition = { lng, lat };

            if (map.current) {
              // Update progress line geometry (fast!) instead of paint property (slow)
              const progressLineSource = map.current.getSource(
                "progress-line"
              ) as mapboxgl.GeoJSONSource;
              if (progressLineSource) {
                // Find all coordinates that come before the current distance
                // and add the exact current position at the end
                const progressCoords: number[][] = [];
                let accumulatedDist = 0;

                for (let i = 0; i < coordinates.length; i++) {
                  if (i === 0) {
                    progressCoords.push(coordinates[i]);
                    continue;
                  }

                  const segmentDist = turf.distance(
                    turf.point(coordinates[i - 1]),
                    turf.point(coordinates[i]),
                    { units: "kilometers" }
                  );

                  if (accumulatedDist + segmentDist <= currentDistance) {
                    progressCoords.push(coordinates[i]);
                    accumulatedDist += segmentDist;
                  } else {
                    break;
                  }
                }

                // Add the exact current position at the end
                progressCoords.push([lng, lat]);

                progressLineSource.setData({
                  type: "Feature",
                  properties: {},
                  geometry: { type: "LineString", coordinates: progressCoords },
                });
              }

              const progressSource = map.current.getSource(
                "progress-point"
              ) as mapboxgl.GeoJSONSource;
              if (progressSource) {
                progressSource.setData({
                  type: "Feature",
                  properties: {},
                  geometry: { type: "Point", coordinates: [lng, lat] },
                });
              }
            }

            const bearing = startBearing - animationPhase * 200.0;
            const cameraPosition = computeCameraPosition(
              pitch,
              bearing,
              targetPosition,
              altitude,
              true
            );

            if (
              map.current &&
              isFinite(cameraPosition.lng) &&
              isFinite(cameraPosition.lat)
            ) {
              try {
                let targetElevation = 0;
                const elev = map.current.queryTerrainElevation([lng, lat]);
                if (typeof elev === "number" && isFinite(elev)) {
                  targetElevation = elev;
                }

                const cameraAltitudeAboveSea = targetElevation + altitude;

                const camera = map.current.getFreeCameraOptions();
                camera.setPitchBearing(pitch, bearing);
                camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
                  cameraPosition,
                  cameraAltitudeAboveSea
                );
                map.current.setFreeCameraOptions(camera);
              } catch (error) {
                console.warn("Camera update failed, skipping frame:", error);
              }
            }

            animationFrame.current = requestAnimationFrame(animateFrame);
          };

          animationFrame.current = requestAnimationFrame(animateFrame);
        });
      },
      [flyoverState.isPlaying, computeCameraPosition]
    );

    // Effect: Initialize map
    useEffect(() => {
      if (
        !mapContainer.current ||
        map.current ||
        !canLoadMap ||
        isCheckingLimit
      )
        return;

      const initializeMap = async () => {
        try {
          await trackMapLoad();
          mapboxgl.accessToken = config.mapbox.accessToken;

          if (!config.mapbox.accessToken) {
            throw new Error("Mapbox access token is required");
          }

          const trackpoints = activity.trackpoints || [];
          if (trackpoints.length === 0) {
            throw new Error("No GPS data available for 3D visualization");
          }

          validTrackpoints.current = trackpoints.filter(
            (tp) => tp.latitude && tp.longitude
          );
          if (validTrackpoints.current.length === 0) {
            throw new Error("No valid GPS coordinates found");
          }

          const startCoord = validTrackpoints.current[0];
          const mapInstance = new mapboxgl.Map({
            container: mapContainer.current!,
            // style: "mapbox://styles/mapbox/satellite-v9",
            style: "mapbox://styles/mapbox/satellite-streets-v12",
            // style: "mapbox://styles/mapbox/standard-satellite",
            center: [startCoord.longitude!, startCoord.latitude!],
            zoom:
              orientation === "portrait" || orientation === "fourFive"
                ? 16
                : 17,
            pitch: constants.PITCH_START,
            bearing: constants.BEARING_START,
            antialias: true,
            preserveDrawingBuffer: true,
          });

          map.current = mapInstance;

          mapInstance.on("load", () => {
            mapInstance.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.terrain-rgb",
              tileSize: 512,
              // maxzoom: 14,
            });
            mapInstance.setTerrain({ source: "mapbox-dem" });

            mapInstance.setFog({
              range: [0.5, 10],
              color: "white",
              "horizon-blend": 0.2,
            });

            mapInstance.addLayer({
              id: "sky",
              type: "sky",
              paint: {
                "sky-type": "atmosphere",
                "sky-atmosphere-sun": [0.0, 0.0],
                "sky-atmosphere-sun-intensity": 15,
                "sky-atmosphere-color": "rgba(85, 151, 210, 0.5)",
              },
            });

            addGpsPath(mapInstance, validTrackpoints.current);
            setIsMapLoaded(true);
          });

          mapInstance.on("error", (e) => {
            console.error("Map error:", e);
            setMapError("Failed to load map");
          });
        } catch (error) {
          console.error("Map initialization error:", error);
          setMapError(
            error instanceof Error ? error.message : "Failed to initialize map"
          );
        }
      };

      initializeMap();

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current);
        }
        isAnimating.current = false;
        pathDistance.current = 0;
        previousCameraPosition.current = null;
      };
    }, [
      canLoadMap,
      isCheckingLimit,
      activity.trackpoints,
      trackMapLoad,
      orientation,
    ]);

    // Add GPS path to map
    const addGpsPath = useCallback(
      (mapInstance: mapboxgl.Map, trackpoints: ActivityTrackpoint[]) => {
        const coordinates = trackpoints.map((tp) => [
          tp.longitude!,
          tp.latitude!,
        ]);
        if (coordinates.length === 0) return;

        const lineString = turf.lineString(coordinates);
        const calculatedDistance = turf.length(lineString, {
          units: "kilometers",
        });
        pathDistance.current = calculatedDistance;

        mapInstance.addSource("gps-path", {
          type: "geojson",
          lineMetrics: true,
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          },
        });

        mapInstance.addLayer({
          id: "gps-path-background",
          type: "line",
          source: "gps-path",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#FFEC51",
            "line-width": 2,
            "line-opacity": 0.3,
          },
        });

        // Progress line - separate source for smooth updates via geometry changes
        mapInstance.addSource("progress-line", {
          type: "geojson",
          lineMetrics: true,
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [coordinates[0], coordinates[0]],
            },
          },
        });

        mapInstance.addLayer({
          id: "gps-path-line",
          type: "line",
          source: "progress-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#EEB11A",
            "line-width": 4,
            "line-opacity": 0.9,
            // Static gradient - cycles from #EEB11A to #FFDD5C repeatedly
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0,
              "#EEB11A",
              0.05,
              "#FFDD5C",
              0.1,
              "#EEB11A",
              0.15,
              "#FFDD5C",
              0.2,
              "#EEB11A",
              0.25,
              "#FFDD5C",
              0.3,
              "#EEB11A",
              0.35,
              "#FFDD5C",
              0.4,
              "#EEB11A",
              0.45,
              "#FFDD5C",
              0.5,
              "#EEB11A",
              0.55,
              "#FFDD5C",
              0.6,
              "#EEB11A",
              0.65,
              "#FFDD5C",
              0.7,
              "#EEB11A",
              0.75,
              "#FFDD5C",
              0.8,
              "#EEB11A",
              0.85,
              "#FFDD5C",
              0.9,
              "#EEB11A",
              0.95,
              "#FFDD5C",
              1.0,
              "#EEB11A",
            ],
          },
        });

        mapInstance.addSource("progress-point", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: coordinates[0] },
          },
        });

        mapInstance.addLayer({
          id: "progress-point-layer",
          type: "circle",
          source: "progress-point",
          paint: {
            "circle-radius": 8,
            "circle-color": "#628141",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#FFFFFF",
          },
        });
      },
      []
    );

    // Reset animation state
    const resetAnimationState = useCallback(() => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
      isAnimating.current = false;
      previousCameraPosition.current = null;
    }, []);

    const showFinalView = useCallback(
      (validTrackpoints: ActivityTrackpoint[]) => {
        if (!map.current || !validTrackpoints?.length) return;

        setIsInFinalView(true);

        const bounds = new mapboxgl.LngLatBounds();
        validTrackpoints.forEach((tp) => {
          if (tp.latitude && tp.longitude) {
            bounds.extend([tp.longitude, tp.latitude]);
          }
        });

        const { center, zoom } =
          map.current.cameraForBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
          }) ?? {};

        if (!center || zoom === undefined) return;

        map.current.flyTo({
          center,
          zoom,
          pitch: 0,
          bearing: constants.BEARING_START,
          speed: 0.8,
          curve: 1.2,
          easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
          essential: true,
        });
      },
      []
    );

    // Handle reset signal: reset state and visuals back to start
    useEffect(() => {
      if (!map.current || !isMapLoaded) return;
      if (resetSignal === undefined) return;

      resetAnimationState();
      setIsInFinalView(false);
      // Reset both ref and state
      currentTrackpointIndexRef.current = 0;
      setCurrentTrackpointIndex(0);

      try {
        // Reset progress line to start
        const first = validTrackpoints.current[0];
        if (first?.longitude && first?.latitude) {
          const progressLineSource = map.current.getSource(
            "progress-line"
          ) as mapboxgl.GeoJSONSource;
          if (progressLineSource) {
            progressLineSource.setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [first.longitude, first.latitude],
                  [first.longitude, first.latitude],
                ],
              },
            });
          }
        }

        const firstTp = validTrackpoints.current[0];
        if (firstTp?.longitude && firstTp?.latitude) {
          const source = map.current.getSource(
            "progress-point"
          ) as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [firstTp.longitude, firstTp.latitude],
              },
            });
          }
          const camera = map.current.getFreeCameraOptions();
          camera.setPitchBearing(constants.PITCH_START, 0);
          const cameraPos = computeCameraPosition(
            constants.PITCH_START,
            constants.BEARING_START,
            { lng: firstTp.longitude, lat: firstTp.latitude },
            constants.ALTITUDE_START,
            false
          );
          camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
            cameraPos,
            constants.ALTITUDE_START
          );
          map.current.setFreeCameraOptions(camera);
        }
      } catch {}
    }, [resetSignal, isMapLoaded, resetAnimationState, computeCameraPosition]);

    // Start animation when flyover state changes - use preview animation
    useEffect(() => {
      if (!map.current || !isMapLoaded || !validTrackpoints.current.length)
        return;

      if (
        flyoverState.isPlaying &&
        !isAnimating.current &&
        !exportProgress.isExporting
      ) {
        isAnimating.current = true;
        const duration = constants.DEFAULT_DURATION_SECONDS * 1000; // 60 seconds

        animatePreview(duration).then(() => {
          isAnimating.current = false;
          showFinalView(validTrackpoints.current);
          onFlyoverEnd?.();
        });
      } else if (!flyoverState.isPlaying && isAnimating.current) {
        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current);
          animationFrame.current = null;
        }
        isAnimating.current = false;
      }
    }, [
      flyoverState.isPlaying,
      isMapLoaded,
      animatePreview,
      showFinalView,
      onFlyoverEnd,
      exportProgress.isExporting,
    ]);

    if (isCheckingLimit) {
      return (
        <div
          className={`flex items-center justify-center h-full bg-gray-100 rounded-lg ${className}`}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Checking map availability...</p>
          </div>
        </div>
      );
    }

    if (!canLoadMap) {
      return (
        <div
          className={`flex items-center justify-center h-full bg-red-50 border border-red-200 rounded-lg ${className}`}
        >
          <div className="text-center p-6">
            <div className="text-red-600 text-4xl mb-4">🚫</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Map Unavailable
            </h3>
            <p className="text-red-700 max-w-md">
              Cannot load map right now. Monthly limit reached. Please wait
              until next month.
            </p>
          </div>
        </div>
      );
    }

    if (mapError) {
      return (
        <div
          className={`flex items-center justify-center h-full bg-red-50 border border-red-200 rounded-lg ${className}`}
        >
          <div className="text-center p-6">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Map Error
            </h3>
            <p className="text-red-700">{mapError}</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative ${className}`}>
        <div
          ref={mapContainer}
          className="w-full h-full rounded-lg overflow-hidden"
        />
        {/* Stats Overlay - now receives reactive state */}
        {isMapLoaded && validTrackpoints.current.length > 0 && (
          <SiksorogoStatsOverlay
            activity={activity}
            currentTrackpoint={
              validTrackpoints.current[currentTrackpointIndex] // Use state instead of ref
            }
            currentIndex={currentTrackpointIndex} // Use state instead of ref
            isInFinalView={isInFinalView} // Use state instead of ref
          />
        )}
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading 3D terrain...</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FlyoverMap.displayName = "FlyoverMap";
