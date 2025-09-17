import React, { useRef, useEffect, useState, useCallback } from "react";
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
          zoom: 12,
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
  }, [
    canLoadMap,
    isCheckingLimit,
    activity.trackpoints,
    segments,
    trackMapLoad,
  ]);

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
          "line-color": "#FF6B6B",
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
          "circle-color": "#4ECDC4",
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
        background: #FF6B6B;
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

  // Calculate bearing based on movement direction
  const getBearing = useCallback(
    (trackpoint: ActivityTrackpoint): number | null => {
      if (!activity.trackpoints) return null;

      const trackpoints = activity.trackpoints.filter(
        (tp) => tp.latitude && tp.longitude
      );
      const currentIndex = trackpoints.findIndex((tp) => tp === trackpoint);

      if (currentIndex < 0 || currentIndex >= trackpoints.length - 1)
        return null;

      const nextTrackpoint = trackpoints[currentIndex + 1];
      if (!nextTrackpoint?.latitude || !nextTrackpoint?.longitude) return null;

      // Calculate bearing between two points
      const lat1 = (trackpoint.latitude! * Math.PI) / 180;
      const lat2 = (nextTrackpoint.latitude * Math.PI) / 180;
      const deltaLng =
        ((nextTrackpoint.longitude - trackpoint.longitude!) * Math.PI) / 180;

      const y = Math.sin(deltaLng) * Math.cos(lat2);
      const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

      return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    },
    [activity.trackpoints]
  );

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

  // Update camera position for flyover effect
  const updateCameraPosition = useCallback(
    (trackpoint: ActivityTrackpoint) => {
      if (!map.current || !trackpoint.latitude || !trackpoint.longitude) return;

      const cameraOptions = {
        center: [trackpoint.longitude, trackpoint.latitude] as [number, number],
        zoom: 15, // Slightly zoomed out for better scenery visibility
        pitch: 60, // Reduced pitch for better overview
        bearing: getBearing(trackpoint) || 0,
      };

      // Smooth camera transition
      map.current.easeTo({
        ...cameraOptions,
        duration: 1000 / flyoverState.playbackSpeed,
        easing: (t) => t,
      });
    },
    [flyoverState.playbackSpeed, getBearing]
  );

  // Update progress indicator during flyover
  useEffect(() => {
    if (!map.current || !isMapLoaded || !activity.trackpoints) return;

    const trackpoints = activity.trackpoints.filter(
      (tp) => tp.latitude && tp.longitude
    );
    if (trackpoints.length === 0) return;

    const currentTrackpoint = trackpoints[flyoverState.currentTrackpointIndex];
    if (!currentTrackpoint?.latitude || !currentTrackpoint?.longitude) return;

    // Update progress point
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

    // Update camera position if playing
    if (flyoverState.isPlaying) {
      updateCameraPosition(currentTrackpoint);
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
