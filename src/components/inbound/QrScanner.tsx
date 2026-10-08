import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useApp } from '@/contexts/AppContext';

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onResult: (value: string) => void;
  error?: string;
}

export function QrScanner({ open, onClose, onResult, error }: QrScannerProps) {
  const { t } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState(false);
  const [manual, setManual] = useState('');
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!open) return;
    setManual('');
    setCameraError(false);
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let lastValue = '';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const scale = Math.min(1, 640 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data && code.data !== lastValue) {
          lastValue = code.data;
          navigator.vibrate?.(80);
          onResultRef.current(code.data);
          setTimeout(() => { lastValue = ''; }, 1500);
        }
      }
      frame = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) { stream.getTracks().forEach(tr => tr.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        frame = requestAnimationFrame(tick);
      } catch {
        if (!stopped) setCameraError(true);
      }
    })();

    setTimeout(() => inputRef.current?.focus(), 100);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(tr => tr.stop());
    };
  }, [open]);

  const submitManual = () => {
    if (manual.trim()) onResult(manual.trim());
    setManual('');
  };

  return (
    <Modal open={open} onClose={onClose} title={t('scannerTitle')} size="sm">
      <div className="space-y-4">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-950">
          {cameraError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <CameraOff className="h-10 w-10 text-slate-500" />
              <p className="text-sm text-slate-300">{t('cameraUnavailable')}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
              <ScanLine className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-pulse text-white/80" />
            </>
          )}
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <Camera className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {t('scannerHint')}
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('manualCode')}</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitManual(); } }}
              className="input-field font-mono uppercase"
              placeholder="A-01-01"
            />
            <button onClick={submitManual} className="btn-primary">{t('use')}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
