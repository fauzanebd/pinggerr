import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { config } from "@/config/env";
import { useMapLoadGuard } from "@/hooks/useMapLoadGuard";
import type {
  StravaActivity,
  ActivityTrackpoint,
  ActivitySegment,
  FlyoverState,
} from "@/types/strava";

// Dynamic import for video encoder
let loadEncoder: any = null;
let simdSupport: any = null;

// Load encoder dynamically
const initializeEncoder = async () => {
  if (!loadEncoder) {
    const [encoderModule, simdModule] = await Promise.all([
      // @ts-ignore - External CDN import
      import("https://unpkg.com/mp4-h264@1.0.7/build/mp4-encoder.js"),
      // @ts-ignore - External CDN import
      import("https://unpkg.com/wasm-feature-detect?module"),
    ]);
    loadEncoder = encoderModule.default;
    simdSupport = simdModule.simd;
  }
  return { loadEncoder, simdSupport };
};

interface FramePosition {
  frame: number;
  animationPhase: number;
  targetPosition: { lng: number; lat: number };
  cameraPosition: { lng: number; lat: number };
  bearing: number;
  pitch: number;
}

interface FlyoverMapProps {
  activity: StravaActivity;
  segments?: ActivitySegment[];
  flyoverState: FlyoverState;
  onTrackpointClick?: (index: number, trackpoint: ActivityTrackpoint) => void;
  onFlyoverEnd?: () => void;
  onVideoExportStart?: () => void;
  onVideoExportProgress?: (progress: number) => void;
  onVideoExportComplete?: (videoBlob: Blob) => void;
  className?: string;
  enableVideoExport?: boolean;
  triggerVideoExport?: boolean;
  triggerOrdinaryExport?: boolean; // NEW: separate trigger for ordinary export
  isExporting?: boolean;
  exportDuration?: number;
  exportType?: "high-quality" | "ordinary"; // NEW: export type
}

export const FlyoverMap: React.FC<FlyoverMapProps> = ({
  activity,
  flyoverState,
  onFlyoverEnd,
  onVideoExportStart,
  onVideoExportProgress,
  onVideoExportComplete,
  className = "",
  triggerVideoExport = false,
  triggerOrdinaryExport = false,
  isExporting = false,
  exportDuration = 30,
  exportType = "high-quality",
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const {
    canLoadMap,
    trackMapLoad,
    isLoading: isCheckingLimit,
  } = useMapLoadGuard();

  // Animation refs
  const animationFrame = useRef<number | null>(null);
  const pathDistance = useRef<number>(0);
  const previousCameraPosition = useRef<{ lng: number; lat: number } | null>(
    null
  );
  const validTrackpoints = useRef<ActivityTrackpoint[]>([]);
  const isAnimating = useRef<boolean>(false);
  const animationStartTime = useRef<number | null>(null);

  // Tile loading state - removed unused refs

  // Video export refs
  const encoder = useRef<any>(null);
  const encoderInitialized = useRef<boolean>(false);

  // Linear interpolation function for smooth camera movement
  const lerp = (start: number, end: number, amt: number): number => {
    return (1 - amt) * start + amt * end;
  };

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
        const smoothingFactor = 0.95;
        newCameraPosition = {
          lng: lerp(
            newCameraPosition.lng,
            previousCameraPosition.current.lng,
            smoothingFactor
          ),
          lat: lerp(
            newCameraPosition.lat,
            previousCameraPosition.current.lat,
            smoothingFactor
          ),
        };
      }

      previousCameraPosition.current = newCameraPosition;
      return newCameraPosition;
    },
    []
  );

  // Initialize video encoder
  const initVideoEncoder = useCallback(
    async (fps: number = 30) => {
      if (encoderInitialized.current || !map.current) return null;

      try {
        const { loadEncoder: LoadEncoder, simdSupport } =
          await initializeEncoder();
        const supportsSIMD = await simdSupport();

        const gl = map.current.painter.context.gl;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        const Encoder = await LoadEncoder({ simd: supportsSIMD });

        // Adjust quality based on export type
        const kbps = exportType === "high-quality" ? 64000 : 32000;

        const newEncoder = Encoder.create({
          width,
          height,
          fps,
          kbps,
          rgbFlipY: true,
        });

        encoder.current = newEncoder;
        encoderInitialized.current = true;

        return newEncoder;
      } catch (error) {
        console.error("Failed to initialize video encoder:", error);
        return null;
      }
    },
    [exportType]
  );

  // NEW: Tile loading strategies based on mode
  const waitForTilesStrategy = useCallback(
    async (
      position: { lng: number; lat: number },
      mode: "preview" | "high-quality" | "ordinary"
    ): Promise<void> => {
      if (!map.current) return;

      return new Promise((resolve) => {
        let attempts = 0;
        let maxAttempts: number;
        let checkInterval: number;

        // Different strategies for different modes
        switch (mode) {
          case "preview":
            // Preview: Allow some skipping, prioritize smooth playback
            maxAttempts = 1; // 1 second max wait
            checkInterval = 1000;
            break;
          case "high-quality":
            // High quality: Wait as long as necessary for perfect tiles
            maxAttempts = 100; // 10 seconds max wait
            checkInterval = 100;
            break;
          case "ordinary":
            // Ordinary: Quick export, minimal waiting
            maxAttempts = 5; // 0.5 seconds max wait
            checkInterval = 100;
            break;
        }

        const checkTiles = () => {
          attempts++;

          // First, set the map center to the position we're checking
          // This ensures tiles for this specific position are prioritized
          if (map.current && attempts === 1) {
            map.current.setCenter([position.lng, position.lat]);
          }

          const sourceLoaded = map.current!.isSourceLoaded("mapbox-dem");
          const tilesLoaded = map.current!.areTilesLoaded();
          const isIdle =
            !map.current!.isMoving() &&
            !map.current!.isZooming() &&
            !map.current!.isRotating();

          // For high-quality mode, also check if specific terrain data is available at this position
          let terrainReady = true;
          if (mode === "high-quality" && map.current!.getTerrain()) {
            try {
              // Try to query elevation at this position - if it fails, terrain might not be loaded
              const elevation = map.current!.queryTerrainElevation([
                position.lng,
                position.lat,
              ]);
              terrainReady = elevation !== null && !isNaN(elevation!);
            } catch {
              terrainReady = false;
            }
          }

          if (sourceLoaded && tilesLoaded && isIdle && terrainReady) {
            resolve();
            return;
          }

          if (attempts >= maxAttempts) {
            if (mode === "high-quality") {
              console.warn(
                `High-quality export: tiles not fully loaded at ${position.lng.toFixed(
                  4
                )}, ${position.lat.toFixed(4)} after ${
                  attempts * checkInterval
                }ms`
              );
            }
            resolve();
            return;
          }

          setTimeout(checkTiles, checkInterval);
        };
        checkTiles();
      });
    },
    []
  );

  // Preview animation (30fps, can skip frames)
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

        const coordinates = validTrackpoints.current.map((tp) => [
          tp.longitude!,
          tp.latitude!,
        ]);
        const pathLineString = turf.lineString(coordinates);
        const startBearing = 0;
        const pitch = 60;
        const altitude = 1000;

        let startTime: number | null = null;
        let lastFrameTime = 0;
        const targetFrameTime = 1000 / 30; // 30 fps for preview

        const animateFrame = async (currentTime: number) => {
          if (!startTime) startTime = currentTime;

          // Throttle frame rate
          if (currentTime - lastFrameTime < targetFrameTime) {
            animationFrame.current = requestAnimationFrame(animateFrame);
            return;
          }
          lastFrameTime = currentTime;

          const animationPhase = Math.min(
            (currentTime - startTime) / duration,
            1
          );

          if (!flyoverState.isPlaying && !isExporting) {
            resolve();
            return;
          }

          if (animationPhase >= 1) {
            resolve();
            return;
          }

          // Calculate position along path
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

          // For preview: light tile waiting, can skip if necessary
          await waitForTilesStrategy(targetPosition, "preview");

          // Update visual elements
          if (map.current) {
            map.current.setPaintProperty("gps-path-line", "line-gradient", [
              "step",
              ["line-progress"],
              "#F99FD2",
              animationPhase,
              "rgba(0, 0, 0, 0)",
            ]);

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
              const camera = map.current.getFreeCameraOptions();
              camera.setPitchBearing(pitch, bearing);
              camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
                cameraPosition,
                altitude
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
    [
      flyoverState.isPlaying,
      isExporting,
      computeCameraPosition,
      waitForTilesStrategy,
    ]
  );

  // High Quality Export (60fps, perfect tiles)
  const exportHighQualityVideo = useCallback(async () => {
    if (!map.current || !validTrackpoints.current.length || isExporting) return;

    try {
      onVideoExportStart?.();
      console.log("Starting high-quality export (60fps, perfect quality)...");

      const videoEncoder = await initVideoEncoder(60); // 60fps
      if (!videoEncoder) throw new Error("Failed to initialize video encoder");

      const coordinates = validTrackpoints.current.map((tp) => [
        tp.longitude!,
        tp.latitude!,
      ]);
      const pathLineString = turf.lineString(coordinates);
      const startBearing = 0;
      const pitch = 60;
      const altitude = 1000;

      const gl = map.current.painter.context.gl;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const ptr = videoEncoder.getRGBPointer();

      const totalFrames = exportDuration * 60; // 60fps
      const framePositions: FramePosition[] = [];

      // Pre-calculate all positions
      for (let frame = 0; frame < totalFrames; frame++) {
        const animationPhase = frame / (totalFrames - 1);
        const currentDistance = pathDistance.current * animationPhase;
        const alongPath = turf.along(pathLineString, currentDistance, {
          units: "kilometers",
        });

        if (alongPath?.geometry?.coordinates) {
          const [lng, lat] = alongPath.geometry.coordinates;
          const bearing = startBearing - animationPhase * 200.0;
          const cameraPosition = computeCameraPosition(
            pitch,
            bearing,
            { lng, lat },
            altitude,
            false
          );

          framePositions.push({
            frame,
            animationPhase,
            targetPosition: { lng, lat },
            cameraPosition,
            bearing,
            pitch,
          });
        }
      }

      console.log(
        `Rendering ${framePositions.length} frames at 60fps with perfect quality...`
      );

      // Render each frame with maximum quality
      for (let i = 0; i < framePositions.length; i++) {
        const frameData = framePositions[i];

        // Update visual elements
        map.current.setPaintProperty("gps-path-line", "line-gradient", [
          "step",
          ["line-progress"],
          "#F99FD2",
          frameData.animationPhase,
          "rgba(0, 0, 0, 0)",
        ]);

        const progressSource = map.current.getSource(
          "progress-point"
        ) as mapboxgl.GeoJSONSource;
        if (progressSource) {
          progressSource.setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [
                frameData.targetPosition.lng,
                frameData.targetPosition.lat,
              ],
            },
          });
        }

        // Set camera position
        if (
          isFinite(frameData.cameraPosition.lng) &&
          isFinite(frameData.cameraPosition.lat)
        ) {
          const camera = map.current.getFreeCameraOptions();
          camera.setPitchBearing(frameData.pitch, frameData.bearing);
          camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
            frameData.cameraPosition,
            altitude
          );
          map.current.setFreeCameraOptions(camera);
        }

        // HIGH QUALITY: Wait for perfect tiles
        await waitForTilesStrategy(frameData.targetPosition, "high-quality");

        // Additional wait for perfect rendering
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Force render and wait for completion
        map.current.triggerRepaint();
        await new Promise((resolve) => {
          const onRender = () => {
            map.current!.off("render", onRender);
            resolve(undefined);
          };
          map.current!.on("render", onRender);
        });

        // Capture perfect frame
        const pixels = videoEncoder.memory().subarray(ptr);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        videoEncoder.encodeRGBPointer();

        const progress = (i + 1) / framePositions.length;
        onVideoExportProgress?.(progress);

        if (i % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }

      const mp4 = videoEncoder.end();
      const videoBlob = new Blob([mp4], { type: "video/mp4" });
      console.log(
        `High-quality export complete! Size: ${(
          videoBlob.size /
          1024 /
          1024
        ).toFixed(2)}MB`
      );
      onVideoExportComplete?.(videoBlob);
    } catch (error) {
      console.error("High-quality video export failed:", error);
      onVideoExportComplete?.(new Blob());
    }
  }, [
    isExporting,
    exportDuration,
    computeCameraPosition,
    waitForTilesStrategy,
    initVideoEncoder,
    onVideoExportStart,
    onVideoExportProgress,
    onVideoExportComplete,
  ]);

  // Ordinary Export (24fps, fast)
  const exportOrdinaryVideo = useCallback(async () => {
    if (!map.current || !validTrackpoints.current.length || isExporting) return;

    try {
      onVideoExportStart?.();
      console.log("Starting ordinary export (24fps, fast)...");

      const videoEncoder = await initVideoEncoder(24); // 24fps
      if (!videoEncoder) throw new Error("Failed to initialize video encoder");

      const coordinates = validTrackpoints.current.map((tp) => [
        tp.longitude!,
        tp.latitude!,
      ]);
      const pathLineString = turf.lineString(coordinates);
      const startBearing = 0;
      const pitch = 60;
      const altitude = 1000;

      const gl = map.current.painter.context.gl;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const ptr = videoEncoder.getRGBPointer();

      const totalFrames = exportDuration * 24; // 24fps
      console.log(`Rendering ${totalFrames} frames at 24fps (fast export)...`);

      for (let frame = 0; frame < totalFrames; frame++) {
        const animationPhase = frame / (totalFrames - 1);
        const currentDistance = pathDistance.current * animationPhase;
        const alongPath = turf.along(pathLineString, currentDistance, {
          units: "kilometers",
        });

        if (!alongPath?.geometry?.coordinates) continue;

        const [lng, lat] = alongPath.geometry.coordinates;
        const bearing = startBearing - animationPhase * 200.0;
        const cameraPosition = computeCameraPosition(
          pitch,
          bearing,
          { lng, lat },
          altitude,
          false
        );

        // Update visual elements
        map.current.setPaintProperty("gps-path-line", "line-gradient", [
          "step",
          ["line-progress"],
          "#F99FD2",
          animationPhase,
          "rgba(0, 0, 0, 0)",
        ]);

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

        // Set camera
        if (isFinite(cameraPosition.lng) && isFinite(cameraPosition.lat)) {
          const camera = map.current.getFreeCameraOptions();
          camera.setPitchBearing(pitch, bearing);
          camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
            cameraPosition,
            altitude
          );
          map.current.setFreeCameraOptions(camera);
        }

        // ORDINARY: Minimal tile waiting for speed
        await waitForTilesStrategy({ lng, lat }, "ordinary");

        // Minimal wait for rendering
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Capture frame quickly
        const pixels = videoEncoder.memory().subarray(ptr);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        videoEncoder.encodeRGBPointer();

        const progress = (frame + 1) / totalFrames;
        onVideoExportProgress?.(progress);
      }

      const mp4 = videoEncoder.end();
      const videoBlob = new Blob([mp4], { type: "video/mp4" });
      console.log(
        `Ordinary export complete! Size: ${(
          videoBlob.size /
          1024 /
          1024
        ).toFixed(2)}MB`
      );
      onVideoExportComplete?.(videoBlob);
    } catch (error) {
      console.error("Ordinary video export failed:", error);
      onVideoExportComplete?.(new Blob());
    }
  }, [
    isExporting,
    exportDuration,
    computeCameraPosition,
    waitForTilesStrategy,
    initVideoEncoder,
    onVideoExportStart,
    onVideoExportProgress,
    onVideoExportComplete,
  ]);

  // Effect: Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !canLoadMap || isCheckingLimit)
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
          style: "mapbox://styles/mapbox/satellite-v9",
          center: [startCoord.longitude!, startCoord.latitude!],
          zoom: 15,
          pitch: 60,
          bearing: 0,
          antialias: true,
        });

        map.current = mapInstance;

        mapInstance.on("load", () => {
          mapInstance.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.terrain-rgb",
            tileSize: 512,
            maxzoom: 14,
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
      animationStartTime.current = null;
      pathDistance.current = 0;
      previousCameraPosition.current = null;
      encoderInitialized.current = false;
    };
  }, [canLoadMap, isCheckingLimit, activity.trackpoints, trackMapLoad]);

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
          "line-color": "#F99FD2",
          "line-width": 2,
          "line-opacity": 0.3,
        },
      });

      mapInstance.addLayer({
        id: "gps-path-line",
        type: "line",
        source: "gps-path",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#F99FD2",
          "line-width": 4,
          "line-opacity": 0.8,
          "line-gradient": [
            "step",
            ["line-progress"],
            "#F99FD2",
            0,
            "rgba(0, 0, 0, 0)",
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
          "circle-color": "#165027",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
        },
      });
    },
    []
  );

  // Function to preload tiles along the path (for now not used yet, lets comment this out)
  //   const preloadTilesAlongPath = useCallback(
  //     (mapInstance: mapboxgl.Map, trackpoints: ActivityTrackpoint[]) => {
  //       if (!trackpoints.length) return;

  //       // Sample key points along the path for preloading
  //       const sampleInterval = Math.max(1, Math.floor(trackpoints.length / 20));
  //       const keyPoints = trackpoints.filter(
  //         (_, index) => index % sampleInterval === 0
  //       );

  //       keyPoints.forEach((point, index) => {
  //         setTimeout(() => {
  //           if (!mapInstance || !point.latitude || !point.longitude) return;

  //           // Briefly move camera to preload tiles (invisible to user)
  //           const tempCamera = mapInstance.getFreeCameraOptions();
  //           const preloadPosition = computeCameraPosition(
  //             60, // pitch
  //             index * 10, // varying bearing
  //             { lng: point.longitude, lat: point.latitude },
  //             1000, // altitude
  //             false // no smoothing needed for preload
  //           );

  //           tempCamera.position = mapboxgl.MercatorCoordinate.fromLngLat(
  //             preloadPosition,
  //             1000
  //           );

  //           // This triggers tile loading but happens too fast for user to see
  //           mapInstance.setFreeCameraOptions(tempCamera);
  //         }, index * 50); // Stagger the preloading
  //       });
  //     },
  //     []
  //   );

  // Handle different export triggers
  useEffect(() => {
    if (triggerVideoExport && !isExporting) {
      exportHighQualityVideo();
    }
  }, [triggerVideoExport, isExporting, exportHighQualityVideo]);

  useEffect(() => {
    if (triggerOrdinaryExport && !isExporting) {
      exportOrdinaryVideo();
    }
  }, [triggerOrdinaryExport, isExporting, exportOrdinaryVideo]);

  // Show final overview
  const showFinalView = useCallback(
    (validTrackpoints: ActivityTrackpoint[]) => {
      if (!map.current || !validTrackpoints?.length) return;

      const bounds = new mapboxgl.LngLatBounds();
      validTrackpoints.forEach((tp) => {
        if (tp.latitude && tp.longitude) {
          bounds.extend([tp.longitude, tp.latitude]);
        }
      });

      map.current.flyTo({
        center: bounds.getCenter(),
        zoom: Math.max(10, map.current.getZoom() - 3),
        pitch: 0,
        bearing: 0,
        speed: 0.8,
        curve: 1.2,
        easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
        essential: true,
      });

      setTimeout(() => {
        if (map.current) {
          map.current.fitBounds(bounds, {
            padding: 100,
            pitch: 0,
            bearing: 0,
            duration: 2000,
          });
        }
      }, 1000);
    },
    []
  );

  // Start animation when flyover state changes - use preview animation
  useEffect(() => {
    if (!map.current || !isMapLoaded || !validTrackpoints.current.length)
      return;

    if (flyoverState.isPlaying && !isAnimating.current) {
      isAnimating.current = true;
      const duration = 60 * 1000; // 60 seconds

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
  ]);

  if (isCheckingLimit) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] bg-gray-100 rounded-lg ${className}`}
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
        className={`flex items-center justify-center min-h-[400px] bg-red-50 border border-red-200 rounded-lg ${className}`}
      >
        <div className="text-center p-6">
          <div className="text-red-600 text-4xl mb-4">🚫</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Map Unavailable
          </h3>
          <p className="text-red-700 max-w-md">
            Cannot load map right now. Monthly limit reached. Please wait until
            next month.
          </p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] bg-red-50 border border-red-200 rounded-lg ${className}`}
      >
        <div className="text-center p-6">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Map Error</h3>
          <p className="text-red-700">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainer}
        className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
        style={{ minHeight: "500px" }}
      />
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading 3D terrain...</p>
          </div>
        </div>
      )}

      {/* Export progress overlay */}
      {isExporting && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-700 font-medium">
              {exportType === "high-quality"
                ? "Exporting High-Quality Video..."
                : "Exporting Video..."}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {exportType === "high-quality"
                ? "Perfect quality, please wait"
                : "Fast export in progress"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
