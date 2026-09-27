import { useEffect, useRef, useState } from 'react';
import {audioService, mediaErrorMessage, type AudioAsset} from '../../services/audioService';

type Notice = { tone: 'success' | 'error'; text: string } | null;

interface CreatorPreviewPlayerProps {
  audio: AudioAsset;
  onNotice: (notice: Notice) => void;
}

// This deliberately remains separate from the public global player. A creator
// preview needs a short-lived, authenticated capability before a browser audio
// element can redeem the stable backend playback route.
export function CreatorPreviewPlayer({audio, onNotice}: CreatorPreviewPlayerProps) {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => () => {
    const element = elementRef.current;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !sourceUrl) return;
    element.load();
    void element.play().catch(() => {
      // Native controls remain available if a browser requires an additional
      // explicit media gesture after the authenticated capability request.
    });
  }, [sourceUrl]);

  if (audio.processingStatus !== 'READY') {
    return <p className="mt-3 text-[11px] text-outline">Audio chưa sẵn sàng để xem trước.</p>;
  }

  const requestPreview = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const capability = await audioService.requestPlaybackCapability(audio.id);
      // This URL is intentionally only held by this mounted component. It is
      // never copied to persistent storage, logging, routing, or a toast.
      setSourceUrl(capability.playbackUrl);
    } catch (error) {
      onNotice({tone: 'error', text: mediaErrorMessage(error)});
    } finally {
      setRequesting(false);
    }
  };

  return <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void requestPreview()} disabled={requesting} className="creator-action">
        {requesting ? 'Đang chuẩn bị…' : sourceUrl ? 'Tải lại bản xem trước' : 'Phát xem trước'}
      </button>
      <span className="text-[11px] text-outline">Chỉ dành cho tác giả; phiên xem trước được cấp khi bấm phát.</span>
    </div>
    {sourceUrl && <audio
      ref={elementRef}
      className="mt-3 w-full"
      controls
      autoPlay
      preload="metadata"
      src={sourceUrl}
      aria-label={`Xem trước ${audio.title}`}
      onError={() => {
        setSourceUrl(null);
        onNotice({tone: 'error', text: 'Không thể phát bản xem trước. Vui lòng thử phát lại.'});
      }}
    />}
  </div>;
}
