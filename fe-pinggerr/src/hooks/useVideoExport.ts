// hooks/useVideoExport.ts
import { useCallback, useState, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';

interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  duration: number;
  quality?: 'high' | 'fast';
}

interface ExportProgress {
  frame: number;
  totalFrames: number;
  percentage: number;
  isExporting: boolean;
  error?: string;
}

export const useVideoExport = () => {
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    frame: 0,
    totalFrames: 0,
    percentage: 0,
    isExporting: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameImagesRef = useRef<string[]>([]);

  const waitForTilesLoaded = useCallback(
    (map: mapboxgl.Map, timeout = 5000): Promise<void> => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkTiles = () => {
          const isReady = map.loaded() && map.areTilesLoaded();
          
          if (isReady) {
            setTimeout(() => resolve(), 100);
          } else if (Date.now() - startTime > timeout) {
            console.warn('Timeout waiting for tiles, proceeding anyway');
            resolve();
          } else {
            setTimeout(checkTiles, 50);
          }
        };
        
        checkTiles();
      });
    },
    []
  );

  // Convert frames to video using MediaRecorder with proper timing
  const createVideoFromFrames = useCallback(
    (frames: string[], fps: number): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Load first frame to get dimensions
        const firstImg = new Image();
        firstImg.onload = () => {
          canvas.width = firstImg.width;
          canvas.height = firstImg.height;

          const stream = canvas.captureStream(fps);
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 5000000,
          });

          const chunks: Blob[] = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
          };

          mediaRecorder.onerror = (error) => {
            reject(error);
          };

          mediaRecorder.start();

          // Play frames at correct timing
          let frameIndex = 0;
          const frameInterval = 1000 / fps;

          const playNextFrame = () => {
            if (frameIndex >= frames.length) {
              mediaRecorder.stop();
              return;
            }

            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              frameIndex++;
              setTimeout(playNextFrame, frameInterval);
            };
            img.src = frames[frameIndex];
          };

          playNextFrame();
        };
        firstImg.src = frames[0];
      });
    },
    []
  );

  const exportVideo = useCallback(
    async (
      mapInstance: mapboxgl.Map,
      animateFunction: (frame: number, totalFrames: number) => Promise<void>,
      showFinalViewFunction: () => Promise<void>,
      settings: ExportSettings
    ): Promise<Blob> => {
      const { fps, duration } = settings;
      const mainFrames = Math.floor(fps * duration);
      const finalViewFrames = Math.floor(fps * 3); // 3 seconds for final view
      const totalFrames = mainFrames + finalViewFrames;
      
      setExportProgress({
        frame: 0,
        totalFrames,
        percentage: 0,
        isExporting: true,
      });

      try {
        const canvas = mapInstance.getCanvasContainer().querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas not found');

        // Store original dimensions
        const container = mapInstance.getContainer();
        const containerRect = container.getBoundingClientRect();
        const originalContainerWidth = container.style.width;
        const originalContainerHeight = container.style.height;

        // Resize container to match target aspect ratio
        const targetAspectRatio = settings.width / settings.height;
        const currentAspectRatio = containerRect.width / containerRect.height;
        
        let newContainerWidth = containerRect.width;
        let newContainerHeight = containerRect.height;

        if (Math.abs(targetAspectRatio - currentAspectRatio) > 0.01) {
          if (targetAspectRatio > currentAspectRatio) {
            newContainerHeight = newContainerWidth / targetAspectRatio;
          } else {
            newContainerWidth = newContainerHeight * targetAspectRatio;
          }
        }

        container.style.width = `${newContainerWidth}px`;
        container.style.height = `${newContainerHeight}px`;
        mapInstance.resize();
        await new Promise(resolve => setTimeout(resolve, 200));

        const capturedFrames: string[] = [];

        // Capture main animation frames
        for (let frame = 0; frame < mainFrames; frame++) {
          try {
            // Execute animation for this frame
            await animateFunction(frame, mainFrames);
            
            // Wait for tiles and rendering to complete
            await waitForTilesLoaded(mapInstance);
            
            // Additional wait to ensure rendering is complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Capture frame as data URL
            const dataURL = canvas.toDataURL('image/webp', settings.quality === 'high' ? 0.95 : 0.8);
            capturedFrames.push(dataURL);
            
            // Update progress
            setExportProgress({
              frame: frame + 1,
              totalFrames,
              percentage: Math.round(((frame + 1) / totalFrames) * 100),
              isExporting: true,
            });
          } catch (error) {
            console.error(`Error at frame ${frame}:`, error);
            throw error;
          }
        }

        // Show final view and capture those frames
        await showFinalViewFunction();
        
        // Wait for final view transition to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Capture final view frames (static frames showing the complete route)
        for (let frame = 0; frame < finalViewFrames; frame++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const dataURL = canvas.toDataURL('image/webp', settings.quality === 'high' ? 0.95 : 0.8);
          capturedFrames.push(dataURL);
          
          setExportProgress({
            frame: mainFrames + frame + 1,
            totalFrames,
            percentage: Math.round(((mainFrames + frame + 1) / totalFrames) * 100),
            isExporting: true,
          });
        }

        // Restore original dimensions
        container.style.width = originalContainerWidth;
        container.style.height = originalContainerHeight;
        mapInstance.resize();

        // Convert captured frames to video
        const videoBlob = await createVideoFromFrames(capturedFrames, fps);
        
        setExportProgress({
          frame: 0,
          totalFrames: 0,
          percentage: 0,
          isExporting: false,
        });

        return videoBlob;
      } catch (error) {
        setExportProgress({
          frame: 0,
          totalFrames: 0,
          percentage: 0,
          isExporting: false,
          error: error instanceof Error ? error.message : 'Export failed',
        });
        throw error;
      }
    },
    [waitForTilesLoaded, createVideoFromFrames]
  );

  const cancelExport = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setExportProgress({
      frame: 0,
      totalFrames: 0,
      percentage: 0,
      isExporting: false,
    });
  }, []);

  return {
    exportProgress,
    exportVideo,
    cancelExport,
  };
};