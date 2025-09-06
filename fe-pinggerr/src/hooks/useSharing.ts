import { useState } from "react";
import type { StravaActivity } from "@/types/strava";

export const useSharing = () => {
  const [isSharing, setIsSharing] = useState(false);

  const generateShareText = (activity: StravaActivity) => {
    const distance = (activity.distance / 1000).toFixed(1);
    const time = Math.floor(activity.moving_time / 60);

    return `Just completed a ${distance}km ${activity.type.toLowerCase()} in ${time} minutes! 🏃‍♂️💪 #Strava #Running #Fitness`;
  };

  const shareToTwitter = (activity: StravaActivity, _imageUrl?: string) => {
    const text = generateShareText(activity);
    const url = window.location.href;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`;

    window.open(shareUrl, "_blank", "width=550,height=420");
  };

  const shareToFacebook = (_activity: StravaActivity) => {
    const url = window.location.href;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url
    )}`;

    window.open(shareUrl, "_blank", "width=600,height=400");
  };

  const shareToInstagram = (activity: StravaActivity) => {
    // Instagram doesn't support direct web sharing, so we'll copy text to clipboard
    const text = generateShareText(activity);

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          alert(
            "Caption copied to clipboard! You can now paste it in Instagram."
          );
        })
        .catch(() => {
          prompt("Copy this text for Instagram:", text);
        });
    } else {
      prompt("Copy this text for Instagram:", text);
    }
  };

  const shareNative = async (activity: StravaActivity, imageUrl?: string) => {
    if (!navigator.share) {
      return false; // Web Share API not supported
    }

    setIsSharing(true);
    try {
      const shareData: ShareData = {
        title: `${activity.name} - Strava Activity`,
        text: generateShareText(activity),
        url: window.location.href,
      };

      // If we have an image URL, try to add it
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], "strava-activity.png", {
            type: "image/png",
          });
          shareData.files = [file];
        } catch (error) {
          console.warn("Could not add image to share:", error);
        }
      }

      await navigator.share(shareData);
      return true;
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing:", error);
      }
      return false;
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async (
    activity: StravaActivity,
    _imageUrl?: string
  ) => {
    const text = generateShareText(activity);

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        return true;
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  };

  return {
    isSharing,
    shareToTwitter,
    shareToFacebook,
    shareToInstagram,
    shareNative,
    copyToClipboard,
    generateShareText,
  };
};
