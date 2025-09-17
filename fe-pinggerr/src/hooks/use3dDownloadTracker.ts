import { config } from "@/config/env";

/**
 * Hook to track 3D Stories downloads
 */
export const use3dDownloadTracker = () => {
  // Track 3D download in the backend
  const track3dDownload = async () => {
    try {
      await fetch(`${config.workerUrl}/count-3ds-download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // Do nothing if counting download fails
      console.warn("Failed to track 3D download:", error);
    }
  };

  return { track3dDownload };
};
