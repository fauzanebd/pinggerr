/**
 * Strava API types and interfaces
 */

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

/**
 * Common lap interface for both TCX and Strava lap data
 */
export interface ActivityLap {
  id?: number; // Strava lap ID (not available in TCX)
  startTime: string; // ISO timestamp
  elapsedTime: number; // seconds
  movingTime?: number; // seconds (Strava only)
  distance: number; // meters
  averageSpeed?: number; // m/s
  maxSpeed?: number; // m/s
  averageHeartrate?: number; // bpm
  maxHeartrate?: number; // bpm
  averageCadence?: number; // steps/min or rpm
  averageWatts?: number; // watts
  maxWatts?: number; // watts
  calories?: number;
  totalElevationGain?: number; // meters
  startIndex?: number; // index in trackpoint array (TCX)
  endIndex?: number; // index in trackpoint array (TCX)
  lapIndex: number; // 1-based lap number
}

/**
 * Common trackpoint interface for both TCX and Strava streams data
 */
export interface ActivityTrackpoint {
  time?: string; // ISO timestamp
  timeOffset?: number; // seconds from start (Strava streams)
  latitude?: number;
  longitude?: number;
  altitude?: number; // meters
  distance?: number; // cumulative meters
  heartRate?: number; // bpm
  speed?: number; // m/s (velocity_smooth from Strava)
  cadence?: number; // steps/min or rpm
  watts?: number; // power in watts
  moving?: boolean; // Strava streams: was athlete moving
  grade?: number; // Strava streams: grade percentage
  temperature?: number; // Strava streams: celsius
}

export interface StravaActivity {
  resource_state: number;
  athlete: {
    id: number;
    resource_state: number;
  };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  workout_type?: number | null;
  id: number;
  external_id?: string;
  upload_id?: number;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  start_latlng?: number[] | null;
  end_latlng?: number[] | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map?: {
    id?: string;
    polyline?: string;
    summary_polyline?: string | null;
    resource_state?: number;
  };
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  flagged?: boolean;
  gear_id?: string | null;
  from_accepted_tag?: boolean;
  average_speed?: number;
  max_speed?: number;
  average_cadence?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  has_heartrate?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  max_watts?: number;
  pr_count?: number;
  total_photo_count?: number;
  has_kudoed?: boolean;
  suffer_score?: number;
  // Lap data - populated when fetched separately or parsed from TCX
  laps?: ActivityLap[];
  // Trackpoint data - populated when fetched from streams API or parsed from TCX
  trackpoints?: ActivityTrackpoint[];
}

export interface ActivityListProps {
  onSelectActivity: (activity: StravaActivity) => void;
}

export interface ShareDialogProps {
  activity: StravaActivity;
  imageUrl?: string;
  children: React.ReactNode;
}

/**
 * 3D Stories specific types
 */

export interface ActivitySegment {
  id: string;
  name?: string;
  description?: string;
  startIndex: number; // index in trackpoints array
  endIndex: number; // index in trackpoints array
  videoFile?: File;
  videoUrl?: string;
  createdAt: Date;
}

export interface SegmentOverlayData {
  segment: ActivitySegment;
  currentProgress: number; // 0-1 progress through the segment
  stats: {
    distance: number;
    pace?: string;
    heartRate?: number;
    elevation?: number;
    speed?: number;
    cadence?: number;
    watts?: number;
  };
}

export interface FlyoverState {
  isPlaying: boolean;
  currentTrackpointIndex: number;
  playbackSpeed: number; // 1x, 2x, etc.
  currentSegment?: ActivitySegment;
  showingSegmentOverlay: boolean;
}
