import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { config } from "@/config/env";
import { useMapLoadGuard } from "@/hooks/useMapLoadGuard";
import type {
  StravaActivity,
  ActivityTrackpoint,
  ActivitySegment,
  FlyoverState,
} from "@/types/strava";

interface FlyoverMapProps {
  activity: StravaActivity;
  segments?: ActivitySegment[];
  flyoverState: FlyoverState;
  onTrackpointClick?: (index: number, trackpoint: ActivityTrackpoint) => void;
  onSegmentReach?: (segment: ActivitySegment) => void;
  onFlyoverEnd?: () => void;
  className?: string;
}

export const FlyoverMap: React.FC<FlyoverMapProps> = ({
  activity,
  segments = [],
  flyoverState,
  onTrackpointClick,
  onSegmentReach,
  onFlyoverEnd,
  className = "",
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

  // Path and camera animation refs
  const animationFrame = useRef<number | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !canLoadMap || isCheckingLimit)
      return;

    const initializeMap = async () => {
      try {
        // Track map load
        await trackMapLoad();

        // Set Mapbox access token
        mapboxgl.accessToken = config.mapbox.accessToken;

        if (!config.mapbox.accessToken) {
          throw new Error("Mapbox access token is required");
        }

        // Calculate bounds from trackpoints
        const trackpoints = activity.trackpoints || [];
        if (trackpoints.length === 0) {
          throw new Error("No GPS data available for 3D visualization");
        }

        const validTrackpoints = trackpoints.filter(
          (tp) => tp.latitude && tp.longitude
        );
        if (validTrackpoints.length === 0) {
          throw new Error("No valid GPS coordinates found");
        }

        const bounds = new mapboxgl.LngLatBounds();
        validTrackpoints.forEach((tp) => {
          if (tp.latitude && tp.longitude) {
            bounds.extend([tp.longitude, tp.latitude]);
          }
        });

        // Initialize map with 3D terrain
        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/satellite-v9",
          center: bounds.getCenter(),
          zoom: 10,
          pitch: 60,
          bearing: 0,
          antialias: true,
        });

        map.current = mapInstance;

        mapInstance.on("load", () => {
          // Add terrain source and layer
          mapInstance.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });

          mapInstance.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

          // Add sky layer for better 3D effect
          mapInstance.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 0.0],
              "sky-atmosphere-sun-intensity": 15,
            },
          });

          // Add GPS path
          addGpsPath(mapInstance, validTrackpoints);

          // Add segment markers
          addSegmentMarkers(mapInstance, segments, validTrackpoints);

          // Add click handler for trackpoint selection
          addTrackpointClickHandler(mapInstance, validTrackpoints);

          // Fit to bounds with padding
          mapInstance.fitBounds(bounds, {
            padding: 50,
            pitch: 60,
            bearing: 0,
          });

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
    };
  }, [canLoadMap, isCheckingLimit, activity.trackpoints, trackMapLoad]);

  // Add GPS path to map
  const addGpsPath = useCallback(
    (mapInstance: mapboxgl.Map, trackpoints: ActivityTrackpoint[]) => {
      const coordinates = trackpoints
        .filter((tp) => tp.latitude && tp.longitude)
        .map((tp) => [tp.longitude!, tp.latitude!]);

      if (coordinates.length === 0) return;

      // Add path source
      mapInstance.addSource("gps-path", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });

      // Add path layer
      mapInstance.addLayer({
        id: "gps-path-line",
        type: "line",
        source: "gps-path",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#F99FD2",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // Add progress indicator
      mapInstance.addSource("progress-point", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: coordinates[0],
          },
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

  // Add segment markers
  const addSegmentMarkers = useCallback(
    (
      mapInstance: mapboxgl.Map,
      segments: ActivitySegment[],
      trackpoints: ActivityTrackpoint[]
    ) => {
      segments.forEach((segment, index) => {
        const startTrackpoint = trackpoints[segment.startIndex];

        if (!startTrackpoint?.latitude || !startTrackpoint?.longitude) return;

        // Create marker element
        const markerElement = document.createElement("div");
        markerElement.className = "segment-marker";
        markerElement.style.cssText = `
        background: #EAF2D7;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
        markerElement.textContent = (index + 1).toString();

        // Add click handler
        markerElement.addEventListener("click", () => {
          if (onTrackpointClick) {
            onTrackpointClick(segment.startIndex, startTrackpoint);
          }
        });

        // Create marker
        new mapboxgl.Marker(markerElement)
          .setLngLat([startTrackpoint.longitude!, startTrackpoint.latitude!])
          .addTo(mapInstance);
      });
    },
    [onTrackpointClick]
  );

  // Update segment markers when segments change (without reinitializing map)
  useEffect(() => {
    if (!map.current || !isMapLoaded || !activity.trackpoints) return;

    const trackpoints = activity.trackpoints.filter(
      (tp) => tp.latitude && tp.longitude
    );
    if (trackpoints.length === 0) return;

    // Remove existing segment markers
    const existingMarkers = document.querySelectorAll(".segment-marker");
    existingMarkers.forEach((marker) => {
      const parent = marker.parentElement;
      if (parent && parent.classList.contains("mapboxgl-marker")) {
        parent.remove();
      }
    });

    // Add new segment markers
    addSegmentMarkers(map.current, segments, trackpoints);
  }, [segments, isMapLoaded, activity.trackpoints, addSegmentMarkers]);

  // Add click handler for trackpoint selection
  const addTrackpointClickHandler = useCallback(
    (mapInstance: mapboxgl.Map, trackpoints: ActivityTrackpoint[]) => {
      mapInstance.on("click", "gps-path-line", (e) => {
        if (!onTrackpointClick) return;

        const coordinates = e.lngLat;

        // Find closest trackpoint to the clicked location
        let closestIndex = 0;
        let minDistance = Infinity;

        trackpoints.forEach((tp, index) => {
          if (!tp.latitude || !tp.longitude) return;

          const distance = Math.sqrt(
            Math.pow(coordinates.lng - tp.longitude, 2) +
              Math.pow(coordinates.lat - tp.latitude, 2)
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        });

        onTrackpointClick(closestIndex, trackpoints[closestIndex]);
      });

      // Change cursor to pointer when hovering over the path
      mapInstance.on("mouseenter", "gps-path-line", () => {
        mapInstance.getCanvas().style.cursor = "pointer";
      });

      mapInstance.on("mouseleave", "gps-path-line", () => {
        mapInstance.getCanvas().style.cursor = "";
      });
    },
    [onTrackpointClick]
  );

  // Simplify trackpoints using Ramer-Douglas-Peucker algorithm
  const simplifyTrackpoints = useCallback(
    (
      trackpoints: ActivityTrackpoint[],
      tolerance: number = 0.0001
    ): ActivityTrackpoint[] => {
      if (trackpoints.length <= 2) return trackpoints;

      // Find the point with maximum distance from line between first and last points
      const firstPoint = trackpoints[0];
      const lastPoint = trackpoints[trackpoints.length - 1];
      let maxDistance = 0;
      let maxIndex = 0;

      for (let i = 1; i < trackpoints.length - 1; i++) {
        const point = trackpoints[i];
        if (!point.latitude || !point.longitude) continue;

        // Calculate perpendicular distance from point to line
        const distance = perpendicularDistance(
          { lat: point.latitude, lng: point.longitude },
          { lat: firstPoint.latitude!, lng: firstPoint.longitude! },
          { lat: lastPoint.latitude!, lng: lastPoint.longitude! }
        );

        if (distance > maxDistance) {
          maxDistance = distance;
          maxIndex = i;
        }
      }

      // If max distance is greater than tolerance, recursively simplify
      if (maxDistance > tolerance) {
        const leftPart = simplifyTrackpoints(
          trackpoints.slice(0, maxIndex + 1),
          tolerance
        );
        const rightPart = simplifyTrackpoints(
          trackpoints.slice(maxIndex),
          tolerance
        );

        // Combine results (remove duplicate point at junction)
        return [...leftPart.slice(0, -1), ...rightPart];
      } else {
        // All points between first and last are within tolerance, just keep endpoints
        return [firstPoint, lastPoint];
      }
    },
    []
  );

  // Calculate perpendicular distance from point to line
  const perpendicularDistance = (
    point: { lat: number; lng: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number }
  ): number => {
    const A = point.lat - lineStart.lat;
    const B = point.lng - lineStart.lng;
    const C = lineEnd.lat - lineStart.lat;
    const D = lineEnd.lng - lineStart.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = Math.max(0, Math.min(1, dot / lenSq));
    const projection = {
      lat: lineStart.lat + param * C,
      lng: lineStart.lng + param * D,
    };

    const dx = point.lat - projection.lat;
    const dy = point.lng - projection.lng;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate smoothed bearing with lookahead
  const getSmoothedBearing = useCallback(
    (
      trackpoints: ActivityTrackpoint[],
      currentIndex: number,
      lookahead: number = 5
    ): number => {
      if (trackpoints.length <= 1) return 0;

      // Look ahead several points for more stable bearing calculation
      const startIndex = Math.max(0, currentIndex - 1);
      const endIndex = Math.min(
        trackpoints.length - 1,
        currentIndex + lookahead
      );

      const startPoint = trackpoints[startIndex];
      const endPoint = trackpoints[endIndex];

      if (
        !startPoint?.latitude ||
        !startPoint?.longitude ||
        !endPoint?.latitude ||
        !endPoint?.longitude
      ) {
        return 0;
      }

      // Calculate bearing between start and end points
      const lat1 = (startPoint.latitude * Math.PI) / 180;
      const lat2 = (endPoint.latitude * Math.PI) / 180;
      const deltaLng =
        ((endPoint.longitude - startPoint.longitude) * Math.PI) / 180;

      const y = Math.sin(deltaLng) * Math.cos(lat2);
      const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

      return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    },
    []
  );

  // Pre-compute simplified trackpoints for flyover
  const simplifiedTrackpoints = useMemo(() => {
    if (!activity.trackpoints) return [];

    const validTrackpoints = activity.trackpoints.filter(
      (tp) => tp.latitude && tp.longitude
    );

    if (validTrackpoints.length === 0) return [];

    // Use different tolerance based on trackpoint density
    const baseTolerance = 0.0002; // ~11 meters
    const tolerance =
      validTrackpoints.length > 1000 ? baseTolerance * 2 : baseTolerance;

    const simplified = simplifyTrackpoints(validTrackpoints, tolerance);

    // Ensure we have at least some points for a meaningful flyover
    if (simplified.length < 10 && validTrackpoints.length >= 10) {
      // If too aggressive, use a smaller tolerance
      return simplifyTrackpoints(validTrackpoints, tolerance * 0.5);
    }

    return simplified;
  }, [activity.trackpoints, simplifyTrackpoints]);

  // Pre-compute smoothed bearings for simplified trackpoints
  const trackpointBearings = useMemo(() => {
    console.log("length of original trackpoints", activity.trackpoints?.length);
    console.log(
      "length of simplified trackpoints",
      simplifiedTrackpoints.length
    );
    return simplifiedTrackpoints.map((_: ActivityTrackpoint, index: number) =>
      getSmoothedBearing(simplifiedTrackpoints, index, 10)
    );
  }, [simplifiedTrackpoints, getSmoothedBearing]);

  // Show final overview of the entire course
  const showFinalView = useCallback(() => {
    if (!map.current || !activity.trackpoints) return;

    const trackpoints = activity.trackpoints.filter(
      (tp) => tp.latitude && tp.longitude
    );
    if (trackpoints.length === 0) return;

    // Calculate bounds for the entire course
    const bounds = new mapboxgl.LngLatBounds();
    trackpoints.forEach((tp) => {
      if (tp.latitude && tp.longitude) {
        bounds.extend([tp.longitude, tp.latitude]);
      }
    });

    // Fly to overview of entire course
    map.current.flyTo({
      center: bounds.getCenter(),
      zoom: Math.max(10, map.current.getZoom() - 3), // Zoom out to show more context
      pitch: 0, // Top-down view
      bearing: 0, // North-up orientation
      speed: 0.8, // Smooth transition
      curve: 1.2, // Curved flyover path
      easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t), // Ease in-out
      essential: true,
    });

    // Fit bounds to show entire course with padding
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
  }, [activity.trackpoints]);

  // Track initial flyover start
  const hasStartedFlyover = useRef(false);
  const isTransitioningToStart = useRef(false);

  // Smooth transition to starting point
  const flyToStartingPoint = useCallback(() => {
    if (!map.current || simplifiedTrackpoints.length === 0)
      return Promise.resolve();

    const startTrackpoint = simplifiedTrackpoints[0];
    if (!startTrackpoint.latitude || !startTrackpoint.longitude)
      return Promise.resolve();

    isTransitioningToStart.current = true;

    return new Promise<void>((resolve) => {
      const startOptions = {
        center: [startTrackpoint.longitude!, startTrackpoint.latitude!] as [
          number,
          number
        ],
        zoom: 15,
        pitch: 60,
        bearing: trackpointBearings[0] || 0, // Use pre-computed smooth bearing
        speed: 0.8,
        curve: 1.4,
        easing: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
      };

      map.current!.flyTo({
        ...startOptions,
        essential: true,
      });

      // Wait for transition to complete
      setTimeout(() => {
        isTransitioningToStart.current = false;
        hasStartedFlyover.current = true;
        resolve();
      }, 0); // 1 second transition to start
    });
  }, [simplifiedTrackpoints, trackpointBearings]);

  // Find interpolated bearing between simplified trackpoints for smoother transitions
  const getInterpolatedBearing = useCallback(
    (allTrackpoints: ActivityTrackpoint[], currentIndex: number): number => {
      if (simplifiedTrackpoints.length === 0 || trackpointBearings.length === 0)
        return 0;

      // Calculate progress through the route (0 to 1)
      const routeProgress =
        currentIndex / Math.max(1, allTrackpoints.length - 1);

      // Map progress to simplified trackpoint indices
      const simplifiedProgress =
        routeProgress * Math.max(1, simplifiedTrackpoints.length - 1);
      const lowerIndex = Math.floor(simplifiedProgress);
      const upperIndex = Math.min(
        lowerIndex + 1,
        trackpointBearings.length - 1
      );

      if (lowerIndex === upperIndex) {
        return trackpointBearings[lowerIndex] || 0;
      }

      // Interpolate between bearings for smoother transitions
      const t = simplifiedProgress - lowerIndex;
      const bearing1 = trackpointBearings[lowerIndex] || 0;
      const bearing2 = trackpointBearings[upperIndex] || 0;

      // Handle bearing wrapping (shortest path between angles)
      let diff = bearing2 - bearing1;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const interpolatedBearing = bearing1 + diff * t;
      return ((interpolatedBearing % 360) + 360) % 360; // Normalize to 0-360
    },
    [simplifiedTrackpoints, trackpointBearings]
  );

  // Update camera position for flyover effect with smooth transitions
  const updateCameraPosition = useCallback(
    (trackpointIndex: number) => {
      if (!map.current || isTransitioningToStart.current) return;

      const allTrackpoints =
        activity.trackpoints?.filter((tp) => tp.latitude && tp.longitude) || [];
      if (trackpointIndex >= allTrackpoints.length) return;

      // Use original trackpoint for camera POSITION (follows progress circle exactly)
      const currentTrackpoint = allTrackpoints[trackpointIndex];
      if (!currentTrackpoint?.latitude || !currentTrackpoint?.longitude) return;

      // Use interpolated bearing from simplified trackpoints (prevents spinning, smoother transitions)
      const bearing = getInterpolatedBearing(allTrackpoints, trackpointIndex);

      const cameraOptions = {
        center: [currentTrackpoint.longitude, currentTrackpoint.latitude] as [
          number,
          number
        ],
        zoom: 15,
        pitch: 60,
        bearing: bearing,
      };

      // Use flyTo for smoother transitions instead of easeTo
      map.current.flyTo({
        ...cameraOptions,
        speed: 1.2 / flyoverState.playbackSpeed, // Adjust speed based on playback rate
        curve: 1.2, // Smooth curved path
        easing: (t) => t, // Linear easing for consistent movement
        essential: true,
      });
    },
    [flyoverState.playbackSpeed, activity.trackpoints, getInterpolatedBearing]
  );

  // Handle flyover start with smooth transition to starting point
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (!flyoverState.isPlaying) {
      // Only reset hasStartedFlyover when we're at the beginning (true reset)
      // Don't reset it during pause (mid-flyover)
      if (flyoverState.currentTrackpointIndex === 0) {
        hasStartedFlyover.current = false;
      }
      return;
    }

    // If just started playing and we're at the beginning
    if (
      !hasStartedFlyover.current &&
      flyoverState.currentTrackpointIndex === 0
    ) {
      flyToStartingPoint();
    } else if (
      !hasStartedFlyover.current &&
      flyoverState.currentTrackpointIndex > 0
    ) {
      // If resuming from middle of flyover, mark as started without transition
      hasStartedFlyover.current = true;
      // Immediately update camera to current position when resuming
      updateCameraPosition(flyoverState.currentTrackpointIndex);
    }
  }, [
    flyoverState.isPlaying,
    flyoverState.currentTrackpointIndex,
    isMapLoaded,
    flyToStartingPoint,
    updateCameraPosition,
  ]);

  // Update progress indicator during flyover
  useEffect(() => {
    if (!map.current || !isMapLoaded || !activity.trackpoints) return;

    const trackpoints = activity.trackpoints.filter(
      (tp) => tp.latitude && tp.longitude
    );
    if (trackpoints.length === 0) return;

    const currentTrackpoint = trackpoints[flyoverState.currentTrackpointIndex];
    if (!currentTrackpoint?.latitude || !currentTrackpoint?.longitude) return;

    // Update progress point (use original trackpoint for accurate progress visualization)
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
            currentTrackpoint.longitude,
            currentTrackpoint.latitude,
          ],
        },
      });
    }

    // Update camera position if playing and after initial transition (use simplified trackpoints for smooth camera)
    if (flyoverState.isPlaying && hasStartedFlyover.current) {
      updateCameraPosition(flyoverState.currentTrackpointIndex);
    }

    // Check if we've reached a segment
    const currentSegment = segments.find(
      (segment) =>
        flyoverState.currentTrackpointIndex >= segment.startIndex &&
        flyoverState.currentTrackpointIndex <= segment.endIndex
    );

    if (
      currentSegment &&
      currentSegment !== flyoverState.currentSegment &&
      onSegmentReach
    ) {
      onSegmentReach(currentSegment);
    }

    // Check if flyover has ended
    if (
      flyoverState.isPlaying &&
      flyoverState.currentTrackpointIndex >= trackpoints.length - 1
    ) {
      // Reset flyover state
      hasStartedFlyover.current = false;
      // Show final overview
      showFinalView();
      if (onFlyoverEnd) {
        onFlyoverEnd();
      }
    }
  }, [
    flyoverState.currentTrackpointIndex,
    flyoverState.isPlaying,
    isMapLoaded,
    activity.trackpoints,
    segments,
    onSegmentReach,
    onFlyoverEnd,
    flyoverState.currentSegment,
    showFinalView,
    updateCameraPosition,
  ]);

  // Render loading state
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

  // Render limit exceeded state
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

  // Render error state
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
    </div>
  );
};
