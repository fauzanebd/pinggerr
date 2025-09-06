import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useSharing } from "@/hooks/useSharing";
import type { ShareDialogProps } from "@/types/strava";

export const ShareDialog: React.FC<ShareDialogProps> = ({
  activity,
  imageUrl,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const {
    shareToTwitter,
    shareToFacebook,
    shareToInstagram,
    shareNative,
    copyToClipboard,
    generateShareText,
    isSharing,
  } = useSharing();

  const handleNativeShare = async () => {
    const success = await shareNative(activity, imageUrl);
    if (success) {
      setOpen(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(activity, imageUrl);
    if (success) {
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  const shareText = generateShareText(activity);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-brand-pink">📤</span>
            Share Your Activity
          </DialogTitle>
          <DialogDescription>
            Share your beautiful {activity.type.toLowerCase()} visualization
            with the world!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Text */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Share text:</p>
            <p className="text-sm">{shareText}</p>
          </div>

          {/* Native Share (if supported) */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              onClick={handleNativeShare}
              disabled={isSharing}
              className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
            >
              {isSharing ? "Sharing..." : "📱 Share (Native)"}
            </Button>
          )}

          {/* Social Media Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => shareToTwitter(activity, imageUrl)}
              className="flex items-center gap-2"
            >
              🐦 Twitter
            </Button>
            <Button
              variant="outline"
              onClick={() => shareToFacebook(activity)}
              className="flex items-center gap-2"
            >
              📘 Facebook
            </Button>
          </div>

          {/* Instagram (copy to clipboard) */}
          <Button
            variant="outline"
            onClick={() => shareToInstagram(activity)}
            className="w-full flex items-center gap-2"
          >
            📷 Instagram (Copy Caption)
          </Button>

          {/* Copy to Clipboard */}
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            className={`w-full flex items-center gap-2 ${
              copiedToClipboard
                ? "bg-brand-green text-white"
                : "text-brand-pink border-brand-pink hover:bg-brand-pink hover:text-brand-green"
            }`}
          >
            {copiedToClipboard ? "✅ Copied!" : "📋 Copy to Clipboard"}
          </Button>

          {/* Tips */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              💡 Tip: Download the image first, then share it with your post!
            </p>
            <div className="flex justify-center gap-2 mt-2">
              <Badge
                variant="outline"
                className="text-xs border-brand-pink text-brand-pink"
              >
                Pink: #F99FD2
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-brand-green text-brand-green"
              >
                Green: #165027
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
