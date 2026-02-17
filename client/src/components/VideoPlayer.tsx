import { useEffect, useState, useRef } from "react";

function dataUriToBlob(dataUri: string): Blob {
  const [header, base64] = dataUri.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "video/webm";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

interface VideoPlayerProps {
  src: string;
  controls?: boolean;
  autoPlay?: boolean;
  className?: string;
}

export function VideoPlayer({ src, controls = true, autoPlay = false, className }: VideoPlayerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src) return;

    if (src.startsWith("blob:")) {
      setBlobUrl(src);
      return;
    }

    if (src.startsWith("data:")) {
      try {
        const blob = dataUriToBlob(src);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        console.error("Failed to convert video data URI to blob:", e);
        setBlobUrl(src);
      }
    } else {
      setBlobUrl(src);
    }

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [src]);

  if (!blobUrl) {
    return (
      <div className={`flex items-center justify-center bg-black text-muted-foreground ${className || ""}`}>
        <p className="text-sm">Loading video...</p>
      </div>
    );
  }

  return (
    <video
      src={blobUrl}
      controls={controls}
      autoPlay={autoPlay}
      playsInline
      className={className}
    />
  );
}
