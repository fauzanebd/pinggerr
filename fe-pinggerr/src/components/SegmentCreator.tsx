import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ActivityTrackpoint, ActivitySegment } from "@/types/strava";

interface SegmentCreatorProps {
  trackpoints: ActivityTrackpoint[];
  segments: ActivitySegment[];
  onSegmentCreate: (segment: Omit<ActivitySegment, "id" | "createdAt">) => void;
  language: "en" | "id";
  onRefUpdate?: (
    ref: {
      handleTrackpointClick: (
        index: number,
        trackpoint: ActivityTrackpoint
      ) => void;
    } | null
  ) => void;
}

interface SegmentDraft {
  startIndex: number | null;
  endIndex: number | null;
  startTrackpoint: ActivityTrackpoint | null;
  endTrackpoint: ActivityTrackpoint | null;
}

export const SegmentCreator: React.FC<SegmentCreatorProps> = ({
  trackpoints,
  segments,
  onSegmentCreate,
  language,
  onRefUpdate,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({
    startIndex: null,
    endIndex: null,
    startTrackpoint: null,
    endTrackpoint: null,
  });

  const texts = {
    en: {
      title: "Segment Creation",
      instructions: "Click on the path to create segments:",
      step1: "1. Click first point (A) to mark segment start",
      step2: "2. Click second point (B) to mark segment end",
      step3: "3. Confirm to create segment",
      selectStart: "Select Start Point (A)",
      selectEnd: "Select End Point (B)",
      cancel: "Cancel",
      createSegment: "Create Segment",
      currentSegments: "Current Segments",
      noSegments: "No segments created yet",
      distance: "Distance",
      startCreating: "Start Creating Segment",
      stopCreating: "Stop Creating",
      pointA: "Point A",
      pointB: "Point B",
      selected: "Selected",
      segmentPreview: "Segment Preview",
    },
    id: {
      title: "Pembuatan Segmen",
      instructions: "Klik pada jalur untuk membuat segmen:",
      step1: "1. Klik titik pertama (A) untuk menandai awal segmen",
      step2: "2. Klik titik kedua (B) untuk menandai akhir segmen",
      step3: "3. Konfirmasi untuk membuat segmen",
      selectStart: "Pilih Titik Awal (A)",
      selectEnd: "Pilih Titik Akhir (B)",
      cancel: "Batal",
      createSegment: "Buat Segmen",
      currentSegments: "Segmen Saat Ini",
      noSegments: "Belum ada segmen yang dibuat",
      distance: "Jarak",
      startCreating: "Mulai Membuat Segmen",
      stopCreating: "Berhenti Membuat",
      pointA: "Titik A",
      pointB: "Titik B",
      selected: "Dipilih",
      segmentPreview: "Pratinjau Segmen",
    },
  };

  const t = texts[language];

  // Handle trackpoint click from map
  const handleTrackpointClick = useCallback(
    (index: number, trackpoint: ActivityTrackpoint) => {
      if (!isCreating) return;

      setSegmentDraft((prev) => {
        // If no start point selected, set this as start
        if (prev.startIndex === null) {
          return {
            startIndex: index,
            endIndex: null,
            startTrackpoint: trackpoint,
            endTrackpoint: null,
          };
        }

        // If start point exists but no end point, set this as end
        if (prev.endIndex === null) {
          // Ensure end point is after start point
          const startIdx = prev.startIndex;
          const endIdx = index;

          if (endIdx <= startIdx) {
            // Swap points: new click becomes start, previous start becomes end
            return {
              startIndex: endIdx,
              endIndex: startIdx,
              startTrackpoint: trackpoint,
              endTrackpoint: prev.startTrackpoint,
            };
          }

          return {
            ...prev,
            endIndex: endIdx,
            endTrackpoint: trackpoint,
          };
        }

        // Both points exist, start new segment
        return {
          startIndex: index,
          endIndex: null,
          startTrackpoint: trackpoint,
          endTrackpoint: null,
        };
      });
    },
    [isCreating]
  );

  // Expose handleTrackpointClick function via ref when in creation mode
  useEffect(() => {
    if (onRefUpdate) {
      if (isCreating) {
        onRefUpdate({ handleTrackpointClick });
      } else {
        onRefUpdate(null);
      }
    }
  }, [isCreating, onRefUpdate, handleTrackpointClick]);

  // Start creating a new segment
  const startCreating = () => {
    setIsCreating(true);
    setSegmentDraft({
      startIndex: null,
      endIndex: null,
      startTrackpoint: null,
      endTrackpoint: null,
    });
  };

  // Cancel segment creation
  const cancelCreating = () => {
    setIsCreating(false);
    setSegmentDraft({
      startIndex: null,
      endIndex: null,
      startTrackpoint: null,
      endTrackpoint: null,
    });
  };

  // Create the segment
  const createSegment = () => {
    if (segmentDraft.startIndex === null || segmentDraft.endIndex === null)
      return;

    const segmentName = `${t.segmentPreview} ${segments.length + 1}`;

    onSegmentCreate({
      name: segmentName,
      startIndex: segmentDraft.startIndex,
      endIndex: segmentDraft.endIndex,
    });

    // Reset draft
    setSegmentDraft({
      startIndex: null,
      endIndex: null,
      startTrackpoint: null,
      endTrackpoint: null,
    });
    setIsCreating(false);
  };

  // Calculate distance between two trackpoints
  const calculateDistance = (
    start: ActivityTrackpoint,
    end: ActivityTrackpoint
  ): number => {
    if (!start.distance || !end.distance) return 0;
    return Math.abs(end.distance - start.distance);
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-blue-600">✂️</span>
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="font-medium text-blue-800 mb-2">{t.instructions}</p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>{t.step1}</li>
            <li>{t.step2}</li>
            <li>{t.step3}</li>
          </ul>
        </div>

        {/* Creation Controls */}
        <div className="flex gap-2">
          {!isCreating ? (
            <Button
              onClick={startCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {t.startCreating}
            </Button>
          ) : (
            <Button onClick={cancelCreating} variant="outline">
              {t.stopCreating}
            </Button>
          )}
        </div>

        {/* Segment Draft Preview */}
        {isCreating && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-medium mb-3">{t.segmentPreview}</h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  {t.pointA}
                </label>
                <div className="mt-1">
                  {segmentDraft.startIndex !== null ? (
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      {t.selected} #{segmentDraft.startIndex}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t.selectStart}</Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">
                  {t.pointB}
                </label>
                <div className="mt-1">
                  {segmentDraft.endIndex !== null ? (
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      {t.selected} #{segmentDraft.endIndex}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t.selectEnd}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Segment Stats Preview */}
            {segmentDraft.startTrackpoint && segmentDraft.endTrackpoint && (
              <div className="bg-white p-3 rounded border">
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">{t.distance}:</span>{" "}
                    {formatDistance(
                      calculateDistance(
                        segmentDraft.startTrackpoint,
                        segmentDraft.endTrackpoint
                      )
                    )}
                  </div>
                  {segmentDraft.startTrackpoint.timeOffset !== undefined &&
                    segmentDraft.endTrackpoint.timeOffset !== undefined && (
                      <div>
                        <span className="font-medium">Time:</span>{" "}
                        {formatTime(
                          segmentDraft.endTrackpoint.timeOffset -
                            segmentDraft.startTrackpoint.timeOffset
                        )}
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Create Button */}
            {segmentDraft.startIndex !== null &&
              segmentDraft.endIndex !== null && (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={createSegment}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {t.createSegment}
                  </Button>
                  <Button onClick={cancelCreating} variant="outline">
                    {t.cancel}
                  </Button>
                </div>
              )}
          </div>
        )}

        {/* Current Segments List */}
        <div>
          <h4 className="font-medium mb-3">{t.currentSegments}</h4>
          {segments.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.noSegments}</p>
          ) : (
            <div className="space-y-2">
              {segments.map((segment, index) => {
                const startTrackpoint = trackpoints[segment.startIndex];
                const endTrackpoint = trackpoints[segment.endIndex];
                const distance =
                  startTrackpoint && endTrackpoint
                    ? calculateDistance(startTrackpoint, endTrackpoint)
                    : 0;

                return (
                  <div
                    key={segment.id}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {segment.name || `Segment ${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t.distance}: {formatDistance(distance)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      #{segment.startIndex} → #{segment.endIndex}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
