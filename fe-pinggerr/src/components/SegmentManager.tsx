import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Play, Upload, Download } from "lucide-react";
import type { ActivitySegment, ActivityTrackpoint } from "@/types/strava";

interface SegmentManagerProps {
  segments: ActivitySegment[];
  trackpoints: ActivityTrackpoint[];
  onSegmentUpdate: (
    segmentId: string,
    updates: Partial<ActivitySegment>
  ) => void;
  onSegmentDelete: (segmentId: string) => void;
  onSegmentPlay: (segment: ActivitySegment) => void;
  onVideoUpload: (segmentId: string, file: File) => void;
  language: "en" | "id";
}

interface EditingSegment {
  id: string;
  name: string;
  description: string;
}

export const SegmentManager: React.FC<SegmentManagerProps> = ({
  segments,
  trackpoints,
  onSegmentUpdate,
  onSegmentDelete,
  onSegmentPlay,
  onVideoUpload,
  language,
}) => {
  const [editingSegment, setEditingSegment] = useState<EditingSegment | null>(
    null
  );
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const texts = {
    en: {
      title: "Segment Manager",
      noSegments: "No segments created yet",
      edit: "Edit",
      delete: "Delete",
      play: "Play",
      upload: "Upload Video",
      download: "Export",
      name: "Name",
      description: "Description",
      distance: "Distance",
      save: "Save",
      cancel: "Cancel",
      editSegment: "Edit Segment",
      deleteConfirm: "Are you sure you want to delete this segment?",
      videoUploaded: "Video uploaded",
      noVideo: "No video",
      points: "Points",
      duration: "Duration",
      namePlaceholder: "Enter segment name",
      descriptionPlaceholder: "Enter segment description (optional)",
    },
    id: {
      title: "Pengelola Segmen",
      noSegments: "Belum ada segmen yang dibuat",
      edit: "Edit",
      delete: "Hapus",
      play: "Putar",
      upload: "Unggah Video",
      download: "Ekspor",
      name: "Nama",
      description: "Deskripsi",
      distance: "Jarak",
      save: "Simpan",
      cancel: "Batal",
      editSegment: "Edit Segmen",
      deleteConfirm: "Apakah Anda yakin ingin menghapus segmen ini?",
      videoUploaded: "Video terunggah",
      noVideo: "Tidak ada video",
      points: "Titik",
      duration: "Durasi",
      namePlaceholder: "Masukkan nama segmen",
      descriptionPlaceholder: "Masukkan deskripsi segmen (opsional)",
    },
  };

  const t = texts[language];

  // Calculate segment statistics
  const getSegmentStats = (segment: ActivitySegment) => {
    const startTrackpoint = trackpoints[segment.startIndex];
    const endTrackpoint = trackpoints[segment.endIndex];

    if (!startTrackpoint || !endTrackpoint) {
      return { distance: 0, duration: 0 };
    }

    const distance =
      startTrackpoint.distance && endTrackpoint.distance
        ? Math.abs(endTrackpoint.distance - startTrackpoint.distance)
        : 0;

    const duration =
      startTrackpoint.timeOffset !== undefined &&
      endTrackpoint.timeOffset !== undefined
        ? endTrackpoint.timeOffset - startTrackpoint.timeOffset
        : 0;

    return { distance, duration };
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Handle edit segment
  const handleEdit = (segment: ActivitySegment) => {
    setEditingSegment({
      id: segment.id,
      name: segment.name || "",
      description: segment.description || "",
    });
    setIsEditDialogOpen(true);
  };

  // Save segment changes
  const handleSave = () => {
    if (!editingSegment) return;

    onSegmentUpdate(editingSegment.id, {
      name: editingSegment.name,
      description: editingSegment.description,
    });

    setEditingSegment(null);
    setIsEditDialogOpen(false);
  };

  // Handle delete segment
  const handleDelete = (segmentId: string) => {
    if (window.confirm(t.deleteConfirm)) {
      onSegmentDelete(segmentId);
    }
  };

  // Handle video upload
  const handleVideoUpload = (
    segmentId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      onVideoUpload(segmentId, file);
    }
    // Reset input
    event.target.value = "";
  };

  if (segments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-purple-600">🎬</span>
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">{t.noSegments}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-purple-600">🎬</span>
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {segments.map((segment, index) => {
            const stats = getSegmentStats(segment);

            return (
              <div key={segment.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-lg">
                      {segment.name || `Segment ${index + 1}`}
                    </h4>
                    {segment.description && (
                      <p className="text-gray-600 text-sm mt-1">
                        {segment.description}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSegmentPlay(segment)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Play className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(segment)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(segment.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t.distance}
                    </label>
                    <div className="text-sm font-medium">
                      {formatDistance(stats.distance)}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t.duration}
                    </label>
                    <div className="text-sm font-medium">
                      {formatDuration(stats.duration)}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t.points}
                    </label>
                    <div className="text-sm font-medium">
                      #{segment.startIndex} → #{segment.endIndex}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Video
                    </label>
                    <div className="text-sm">
                      {segment.videoFile || segment.videoUrl ? (
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800"
                        >
                          {t.videoUploaded}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t.noVideo}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Video Upload */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleVideoUpload(segment.id, e)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-600 hover:text-orange-700"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {t.upload}
                    </Button>
                  </label>

                  {/* Export Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      /* TODO: Implement export - use track3dDownload() from use3dDownloadTracker hook */
                    }}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {t.download}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.editSegment}</DialogTitle>
            </DialogHeader>

            {editingSegment && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t.name}
                  </label>
                  <Input
                    value={editingSegment.name}
                    onChange={(e) =>
                      setEditingSegment({
                        ...editingSegment,
                        name: e.target.value,
                      })
                    }
                    placeholder={t.namePlaceholder}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t.description}
                  </label>
                  <Input
                    value={editingSegment.description}
                    onChange={(e) =>
                      setEditingSegment({
                        ...editingSegment,
                        description: e.target.value,
                      })
                    }
                    placeholder={t.descriptionPlaceholder}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    {t.cancel}
                  </Button>
                  <Button onClick={handleSave}>{t.save}</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
